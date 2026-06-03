/**
 * InkCanvas Canvas Customizer – Storefront popup widget
 * Requires Fabric.js v6 loaded via asset_url in the Liquid block.
 */
/* global fabric */
(function () {
  'use strict';

  function isDebugEnabled() {
    if (/(?:^|[?&])inkcanvas_debug=1(?:&|$)/.test(window.location.search)) {
      return true;
    }
    try {
      return window.localStorage && window.localStorage.getItem('inkcanvas_debug') === '1';
    } catch (_) {
      return false;
    }
  }

  var debugEnabled = isDebugEnabled();

  function markStart(name) {
    if (!debugEnabled || !window.performance) return null;
    var mark = 'ikc:' + name + ':start:' + Math.random().toString(36).slice(2);
    performance.mark(mark);
    return mark;
  }

  function markEnd(name, startMark, detail) {
    if (!debugEnabled || !window.performance || !startMark) return;
    var endMark = startMark.replace(':start:', ':end:');
    performance.mark(endMark);
    try {
      var measureName = 'ikc:' + name;
      performance.measure(measureName, startMark, endMark);
      var entries = performance.getEntriesByName(measureName);
      var last = entries[entries.length - 1];
      console.debug('[InkCanvas timing]', name, Math.round(last.duration) + 'ms', detail || '');
    } catch (_) {
      console.debug('[InkCanvas timing]', name, detail || '');
    }
  }

  // ── Boot: wait for DOM, then init each block ──────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootAll);
  } else {
    bootAll();
  }

  function bootAll() {
    var configs = window.InkCanvasConfig;
    if (!configs || typeof configs !== 'object') return;

    setupViewportHeightVar();

    Object.keys(configs).forEach(function (blockId) {
      var cfg = configs[blockId];
      if (cfg && cfg.blockId) {
        initBlock(cfg);
      }
    });
  }

  function setupViewportHeightVar() {
    var root = document.documentElement;
    function apply() {
      var h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      if (!h) return;
      root.style.setProperty('--ikc-vh', (h * 0.01) + 'px');
    }
    apply();
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', apply);
      window.visualViewport.addEventListener('scroll', apply);
    } else {
      window.addEventListener('resize', apply);
    }
  }

  // ── Per-block init ────────────────────────────────────────────────────────
  function loadFabric(src) {
    if (window.fabric) return Promise.resolve(window.fabric);
    if (!src) return Promise.reject(new Error('Fabric URL missing'));
    if (window.InkCanvasFabricPromise) return window.InkCanvasFabricPromise;

    window.InkCanvasFabricPromise = new Promise(function (resolve, reject) {
      function rejectFabricLoad(err, scriptEl) {
        if (scriptEl && scriptEl.parentNode) {
          scriptEl.parentNode.removeChild(scriptEl);
        }
        window.InkCanvasFabricPromise = null;
        reject(err);
      }

      var existing = document.querySelector('script[data-inkcanvas-fabric="true"]');
      if (existing) {
        if (window.fabric) {
          resolve(window.fabric);
          return;
        }
        if (existing.dataset.inkcanvasLoaded === 'true' || existing.readyState === 'complete') {
          if (existing.parentNode) {
            existing.parentNode.removeChild(existing);
          }
          window.InkCanvasFabricPromise = null;
        } else {
          existing.addEventListener('load', function () {
            existing.dataset.inkcanvasLoaded = 'true';
            if (window.fabric) {
              resolve(window.fabric);
            } else {
              rejectFabricLoad(new Error('Fabric did not initialize'), existing);
            }
          });
          existing.addEventListener('error', function () {
            rejectFabricLoad(new Error('Fabric failed to load'), existing);
          });
          return;
        }
      }

      var script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.dataset.inkcanvasFabric = 'true';
      script.onload = function () {
        script.dataset.inkcanvasLoaded = 'true';
        if (window.fabric) {
          resolve(window.fabric);
        } else {
          rejectFabricLoad(new Error('Fabric did not initialize'), script);
        }
      };
      script.onerror = function () {
        rejectFabricLoad(new Error('Fabric failed to load'), script);
      };
      document.head.appendChild(script);
    });

    return window.InkCanvasFabricPromise;
  }

  function getShopifyRoot() {
    if (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) {
      return window.Shopify.routes.root;
    }
    return '/';
  }

  function initBlock(cfg) {
    var blockId    = cfg.blockId;
    var root       = document.getElementById('inkcanvas-root-' + blockId);
    if (!root) return;

    var APP_URL    = (cfg.appUrl  || '').replace(/\/$/, '');
    var PROXY_BASE = (cfg.proxyBase || '/apps/inkcanvas').replace(/\/$/, '');
    var FABRIC_URL = cfg.fabricUrl || '';
    var SHOP       = cfg.shop || (window.Shopify && window.Shopify.shop) || '';
    var PRODUCT_ID = cfg.productId || '';
    var CANVAS_SZ  = parseInt(cfg.canvasSize, 10) || 500;
    var SHOW_FONTS  = cfg.showFonts  !== false && cfg.showFonts  !== 'false';
    var SHOW_UPLOAD = cfg.showUpload !== false && cfg.showUpload !== 'false';

    // Element references (all scoped by blockId)
    var openBtn     = document.getElementById('ikc-open-btn-' + blockId);
    var modal       = document.getElementById('ikc-modal-' + blockId);
    var closeBtn    = document.getElementById('ikc-close-btn-' + blockId);
    var cancelBtn   = document.getElementById('ikc-cancel-btn-' + blockId);
    var addToCartBtn = document.getElementById('ikc-add-to-cart-btn-' + blockId);
    var editBtn     = document.getElementById('ikc-edit-btn-' + blockId);
    var errorMsg    = document.getElementById('ikc-modal-error-' + blockId);
    var popupVariantSel = document.getElementById('ikc-variant-select-' + blockId);
    var canvasFrame = document.querySelector('#ikc-modal-' + blockId + ' .ikc-canvas-frame');

    if (!openBtn || !modal) return;

    // Ensure modal overlay is mounted at <body> level.
    // Some themes apply transforms to page wrappers on mobile; fixed-position children inside
    // transformed ancestors may not overlay sticky/fixed UI reliably.
    if (modal.parentElement !== document.body) {
      document.body.appendChild(modal);
    }

    // Hide native purchase buttons on the product page (InkCanvas-enabled products only)
    hideNativePurchaseButtons(root);

    // Per-block state
    var state = {
      fc:         null,   // Fabric.js canvas instance
      textObj:    null,
      imageObj:   null,
      hintObj:    null,
      fontFamily: 'sans-serif',
      fontName:   '',
      textColor:  '#1a1a1a',
      rawFile:    null,
      blobUrl:    '',
      savedDataUrl: '',   // last saved canvas PNG (data URL)
      selectedVariantId:    '',
      selectedVariantTitle: '',
      canvasSz:   CANVAS_SZ,
      remoteFonts: null,
      previouslyFocused: null,
    };

    // ── Fetch per-product config from App Proxy ──────────────────────────
    var configUrl = PROXY_BASE + '/config?shop=' + encodeURIComponent(SHOP) + '&product_id=' + encodeURIComponent(PRODUCT_ID);

    var configPromise = loadRemoteConfig(configUrl, state);

    function loadRemoteConfig(url, state) {
      var timing = markStart('config');
      return fetch(url)
        .then(function (r) {
          if (!r.ok) throw new Error('Config error: ' + r.status);
          return r.json();
        })
        .then(function (remoteConfig) {
          if (remoteConfig) {
            if (remoteConfig.canvasSize) CANVAS_SZ = parseInt(remoteConfig.canvasSize, 10) || CANVAS_SZ;
            state.remoteFonts = Array.isArray(remoteConfig.fonts) ? remoteConfig.fonts : null;
            markEnd('config', timing, 'proxy');
            return remoteConfig;
          }
          markEnd('config', timing, 'empty');
          return null;
        })
        .catch(function (err) {
          markEnd('config', timing, 'failed');
          if (debugEnabled) console.debug('[InkCanvas] Config fetch failed:', err);
          return null;
        });
    }

    // ── Variant sync setup ────────────────────────────────────────────────
    var pageVariantInput = findPageVariantInput();

    function findPageVariantInput() {
      var form = document.querySelector('form[action*="/cart/add"]');
      if (!form) return null;
      return form.querySelector('select[name="id"], input[name="id"][type="hidden"]');
    }

    // Set initial selected variant from page
    if (popupVariantSel) {
      if (pageVariantInput && pageVariantInput.value) {
        popupVariantSel.value = pageVariantInput.value;
      }
      var firstOpt = popupVariantSel.options[popupVariantSel.selectedIndex];
      if (firstOpt) {
        state.selectedVariantId    = firstOpt.value;
        state.selectedVariantTitle = firstOpt.getAttribute('data-title') || firstOpt.text;
      }

      // Sync popup variant → page variant
      popupVariantSel.addEventListener('change', function () {
        var opt = popupVariantSel.options[popupVariantSel.selectedIndex];
        if (!opt) return;
        state.selectedVariantId    = opt.value;
        state.selectedVariantTitle = opt.getAttribute('data-title') || opt.text;
        if (pageVariantInput) {
          pageVariantInput.value = opt.value;
          pageVariantInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
    }

    // Sync page variant → popup variant selector
    if (pageVariantInput) {
      pageVariantInput.addEventListener('change', function () {
        if (popupVariantSel && pageVariantInput.value) {
          popupVariantSel.value = pageVariantInput.value;
          var opt = popupVariantSel.options[popupVariantSel.selectedIndex];
          if (opt) {
            state.selectedVariantId    = opt.value;
            state.selectedVariantTitle = opt.getAttribute('data-title') || opt.text;
          }
        }
      });
    }

    // ── Modal open/close ─────────────────────────────────────────────────
    openBtn.addEventListener('click', function () { openModal(); });
    if (closeBtn)  closeBtn.addEventListener('click',  function () { closeModal(); });
    if (cancelBtn) cancelBtn.addEventListener('click', function () { closeModal(); });
    if (editBtn)   editBtn.addEventListener('click',   function () { openModal(); });

    // Close on overlay click (outside the modal box)
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeModal();
    });

    // Close on Escape key + trap focus inside the open modal
    document.addEventListener('keydown', function (e) {
      if (!modal.classList.contains('is-open')) return;
      if (e.key === 'Escape') closeModal();
      trapModalFocus(e);
    });

    function warmFabric() {
      if (!FABRIC_URL || window.fabric) return;
      loadFabric(FABRIC_URL).catch(function (err) {
        if (debugEnabled) console.debug('[InkCanvas] Fabric warm load failed:', err);
      });
    }

    openBtn.addEventListener('pointerenter', warmFabric, { once: true });
    openBtn.addEventListener('touchstart', warmFabric, { once: true, passive: true });
    openBtn.addEventListener('focus', warmFabric, { once: true });

    function openModal() {
      state.previouslyFocused = document.activeElement;
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      setTimeout(focusFirstModalControl, 0);

      if (!state.fc) {
        setCanvasLoading(true);
        var fabricTiming = markStart('fabric');
        loadFabric(FABRIC_URL)
          .then(function () {
            markEnd('fabric', fabricTiming, 'loaded');
            requestAnimationFrame(function () {
              requestAnimationFrame(function () {
                setCanvasLoading(false);
                if (!modal.classList.contains('is-open')) return;
                initCanvas();
              });
            });
          })
          .catch(function () {
            setCanvasLoading(false);
            markEnd('fabric', fabricTiming, 'failed');
            showError('Canvas engine failed to load. Please refresh.');
          });
      } else {
        // Ensure canvas fits after reopen/orientation changes
        scheduleResize();
      }
    }

    function closeModal() {
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      restoreFocusAfterClose();
    }

    function getFocusableModalElements() {
      return Array.prototype.slice.call(modal.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )).filter(function (el) {
        return !el.disabled && el.offsetParent !== null;
      });
    }

    function focusFirstModalControl() {
      var focusable = getFocusableModalElements();
      var first = focusable[0];
      if (first && typeof first.focus === 'function') {
        first.focus({ preventScroll: true });
      }
    }

    function trapModalFocus(e) {
      if (e.key !== 'Tab' || !modal.classList.contains('is-open')) return;
      var focusable = getFocusableModalElements();
      if (focusable.length === 0) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    function restoreFocusAfterClose() {
      var target = state.previouslyFocused || openBtn;
      if (target && typeof target.focus === 'function') {
        target.focus({ preventScroll: true });
      }
      state.previouslyFocused = null;
    }

    // ── Canvas init ───────────────────────────────────────────────────────
    function initCanvas() {
      if (typeof fabric === 'undefined') { showError('Canvas engine not loaded.'); return; }
      if (state.fc) return;

      var canvasEl = document.getElementById('ikc-canvas-' + blockId);
      if (!canvasEl) return;

      var sz = computeCanvasSize();

      canvasEl.width  = sz;
      canvasEl.height = sz;

      var fc = new fabric.Canvas(canvasEl, {
        backgroundColor: '#f8f9fa',
        preserveObjectStacking: true,
        width: sz,
        height: sz,
      });

      if (fc.wrapperEl) {
        fc.wrapperEl.style.width  = sz + 'px';
        fc.wrapperEl.style.height = sz + 'px';
      }

      state.fc = fc;
      state.canvasSz = sz;

      // Hint text
      state.hintObj = new fabric.Text('Add text or image to preview', {
        left: sz / 2, top: sz / 2,
        originX: 'center', originY: 'center',
        fontSize: Math.max(13, Math.round(sz * 0.033)),
        fontFamily: 'sans-serif', fill: '#c4c9d4',
        selectable: false, evented: false,
      });
      fc.add(state.hintObj);
      fc.renderAll();

      if (SHOW_FONTS)  setupFonts(fc, state, blockId, APP_URL, SHOP, configPromise);
      setupText(fc, state, blockId);
      if (SHOW_UPLOAD) setupImageUpload(fc, state, blockId);

      setupCanvasResizeHandling();
    }

    if (addToCartBtn) {
      addToCartBtn.addEventListener('click', function () {
        handleAddToCart(state, blockId);
      });
    }

    function handleAddToCart(state, blockId) {
      var textInput = document.getElementById('ikc-text-input-' + blockId);
      var hasText   = textInput && textInput.value.trim().length > 0;
      var hasImage  = Boolean(state.rawFile);

      if (!hasText && !hasImage) {
        showError('Please add some text or upload an image first.');
        return;
      }
      clearError();

      if (state.fc) {
        var exportTiming = markStart('design-export');
        state.savedDataUrl = state.fc.toDataURL({ format: 'png', multiplier: 3 });
        markEnd('design-export', exportTiming);
      }

      var origLabel = setPrimaryButtonBusy(addToCartBtn, 'Processing...');

      // Upload design + raw image, then add to cart via Ajax API
      var dataUrl = state.savedDataUrl;
      var cartTiming = null;

      var designTiming = markStart('design-upload');
      var designUpload = fetch(APP_URL + '/api/upload?shop=' + encodeURIComponent(SHOP) + '&type=design', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl: dataUrl }),
      }).then(function (r) {
        markEnd('design-upload', designTiming, String(r.status));
        if (!r.ok) throw new Error('Design upload error: ' + r.status);
        return r.json();
      });

      var rawUpload = state.rawFile
        ? (function () {
            var fd = new FormData();
            fd.append('file', state.rawFile);
            var rawTiming = markStart('raw-upload');
            return fetch(APP_URL + '/api/upload?shop=' + encodeURIComponent(SHOP) + '&type=raw', {
              method: 'POST', body: fd,
            }).then(function (r) {
              markEnd('raw-upload', rawTiming, String(r.status));
              if (!r.ok) throw new Error('Raw upload error: ' + r.status);
              return r.json();
            });
          })()
        : Promise.resolve({ url: '' });

      Promise.all([designUpload, rawUpload])
        .then(function (results) {
          var designData = results[0];
          var rawData    = results[1];
          if (state.blobUrl) URL.revokeObjectURL(state.blobUrl);

          var properties = {
            '_custom_text':      (textInput && textInput.value.trim()) || '',
            '_custom_font':      state.fontName || '',
            '_raw_image_url':    rawData.url || '',
            '_design_image_url': designData.url || '',
            '_variant_title':    state.selectedVariantTitle || '',
            '_print_size':       state.selectedVariantTitle || '',
          };

          // Use Shopify Ajax Cart API for full control over post-add behavior
          cartTiming = markStart('cart-add');
          return fetch(getShopifyRoot() + 'cart/add.js', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: parseInt(state.selectedVariantId, 10),
              quantity: 1,
              properties: properties,
            }),
          });
        })
        .then(function (r) {
          markEnd('cart-add', cartTiming, String(r.status));
          if (!r.ok) throw new Error('Cart add error: ' + r.status);
          return r.json();
        })
        .then(function () {
          // Redirect to cart page
          window.location.href = '/cart';
        })
        .catch(function (err) {
          console.error('[InkCanvas] Add to cart failed:', err);
          restorePrimaryButton(addToCartBtn, origLabel, 'Add to cart');
          showError('Failed to add to cart. Please try again.');
        });
    }

    function showError(msg) {
      if (errorMsg) { errorMsg.textContent = msg; errorMsg.style.display = ''; }
    }
    function clearError() {
      if (errorMsg) { errorMsg.textContent = ''; errorMsg.style.display = 'none'; }
    }

    function setPrimaryButtonBusy(button, label) {
      if (!button) return '';
      var previous = button.textContent;
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      button.textContent = label;
      return previous;
    }

    function restorePrimaryButton(button, previousLabel, fallbackLabel) {
      if (!button) return;
      button.disabled = false;
      button.removeAttribute('aria-busy');
      button.textContent = previousLabel || fallbackLabel;
    }

    function setCanvasLoading(isLoading) {
      var frame = canvasFrame || document.querySelector('#ikc-modal-' + blockId + ' .ikc-canvas-frame');
      if (!frame) return;
      frame.classList.toggle('is-loading', Boolean(isLoading));
      frame.setAttribute('aria-busy', isLoading ? 'true' : 'false');
    }

    // ── Font manager ──────────────────────────────────────────────────────
    function setupFonts(fc, state, blockId, APP_URL, SHOP, configPromise) {
      var select = document.getElementById('ikc-font-select-' + blockId);
      if (!select) return;

      select.innerHTML = '<option value="">Default font</option>';

      var fontsTiming = markStart('fonts');
      var fontsPromise = withTimeout(configPromise, 1200)
        .then(function (configResult) {
          if (Array.isArray(state.remoteFonts)) {
            return { source: 'proxy', fonts: state.remoteFonts };
          }
          if (configResult.timedOut && debugEnabled) {
            console.debug('[InkCanvas] Config fetch timed out before fonts fallback');
          }

          return fetch(APP_URL + '/api/fonts?shop=' + encodeURIComponent(SHOP))
            .then(function (r) {
              if (!r.ok) throw new Error('Fonts error: ' + r.status);
              return r.json();
            })
            .then(function (fonts) {
              return { source: 'direct-fallback', fonts: fonts };
            });
        });

      fontsPromise
        .then(function (result) {
          var fonts = result.fonts;
          markEnd('fonts', fontsTiming, result.source);
          if (!Array.isArray(fonts) || fonts.length === 0) {
            select.innerHTML = '<option value="">Default font</option>';
            return;
          }
          select.innerHTML = fonts.map(function (f) {
            return '<option value="' + escAttr(f.url) + '" data-name="' + escAttr(f.name) + '">' + escHtml(f.name) + '</option>';
          }).join('');

          var first = fonts[0];
          loadAndApplyFont(fc, state, first.url, first.name);

          select.addEventListener('change', function () {
            var opt = select.options[select.selectedIndex];
            if (opt && opt.value) loadAndApplyFont(fc, state, opt.value, opt.dataset.name || opt.text);
          });
        })
        .catch(function (err) {
          markEnd('fonts', fontsTiming, 'failed');
          if (debugEnabled) console.debug('[InkCanvas] Fonts load failed:', err);
          select.innerHTML = '<option value="">Default font</option>';
        });

      function withTimeout(promise, ms) {
        return new Promise(function (resolve) {
          var settled = false;
          var timer = setTimeout(function () {
            if (settled) return;
            settled = true;
            resolve({ timedOut: true });
          }, ms);

          promise.then(function (value) {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve({ timedOut: false, value: value });
          }).catch(function () {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve({ timedOut: false, value: null });
          });
        });
      }
    }

    function loadAndApplyFont(fc, state, url, name) {
      var safeName = 'ikc-' + name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
      if (!document.getElementById('ikc-ff-' + safeName)) {
        var style = document.createElement('style');
        style.id  = 'ikc-ff-' + safeName;
        style.textContent = '@font-face { font-family: "' + safeName + '"; src: url("' + url + '"); font-display: swap; }';
        document.head.appendChild(style);
      }
      if (typeof FontFace !== 'undefined') {
        new FontFace(safeName, 'url(' + url + ')')
          .load()
          .then(function (loaded) {
            document.fonts.add(loaded);
            applyFontToCanvas(fc, state, safeName, name);
          })
          .catch(function () {
            setTimeout(function () { applyFontToCanvas(fc, state, safeName, name); }, 600);
          });
      } else {
        setTimeout(function () { applyFontToCanvas(fc, state, safeName, name); }, 600);
      }
    }

    function applyFontToCanvas(fc, state, safeName, displayName) {
      state.fontFamily = safeName;
      state.fontName   = displayName;
      if (state.textObj) { state.textObj.set('fontFamily', safeName); fc.renderAll(); }
    }

    // ── Text layer ────────────────────────────────────────────────────────
    function setupText(fc, state, blockId) {
      var input = document.getElementById('ikc-text-input-' + blockId);
      if (!input) return;

      input.addEventListener('input', function () {
        var val = input.value;
        var sz = state.canvasSz;
        if (!state.textObj) {
          if (!val) return;
          if (state.hintObj) { fc.remove(state.hintObj); state.hintObj = null; }
          state.textObj = new fabric.Text(val, {
            left: sz / 2, top: Math.round(sz * 0.78),
            originX: 'center', originY: 'center',
            fontSize: Math.round(sz * 0.075),
            fontFamily: state.fontFamily, fill: state.textColor, textAlign: 'center',
          });
          fc.add(state.textObj);
          fc.setActiveObject(state.textObj);
        } else {
          state.textObj.set({ text: val, fontFamily: state.fontFamily });
        }
        fc.renderAll();
      });
    }

    // ── Image upload ──────────────────────────────────────────────────────
    function setupImageUpload(fc, state, blockId) {
      var input     = document.getElementById('ikc-img-input-' + blockId);
      var labelSpan = document.getElementById('ikc-upload-label-' + blockId);
      if (!input) return;

      input.addEventListener('change', function () {
        var file = input.files && input.files[0];
        if (!file) return;
        if (file.size > 20 * 1024 * 1024) { showError('Image must be smaller than 20 MB.'); return; }
        clearError();
        if (state.blobUrl) URL.revokeObjectURL(state.blobUrl);
        state.rawFile = file;
        state.blobUrl = URL.createObjectURL(file);
        placeImageOnCanvas(fc, state, state.blobUrl, file.name, labelSpan);
      });
    }

    function placeImageOnCanvas(fc, state, url, fileName, labelSpan) {
      var sz = state.canvasSz;
      fabric.Image.fromURL(url, { crossOrigin: 'anonymous' })
        .then(function (img) {
          if (state.hintObj) { fc.remove(state.hintObj); state.hintObj = null; }
          if (state.imageObj) fc.remove(state.imageObj);
          var maxDim = sz * 0.85;
          var scale  = Math.min(maxDim / (img.width || 1), maxDim / (img.height || 1));
          img.set({ left: sz / 2, top: sz / 2, originX: 'center', originY: 'center', scaleX: scale, scaleY: scale });
          state.imageObj = img;
          fc.add(img);
          if (state.textObj) fc.bringObjectToFront(state.textObj);
          fc.renderAll();
          if (labelSpan) labelSpan.textContent = fileName;
        })
        .catch(function () { showError('Failed to display image. Please try again.'); });
    }

    function computeCanvasSize() {
      var frame = canvasFrame || document.querySelector('#ikc-modal-' + blockId + ' .ikc-canvas-frame');
      if (!frame) {
        return Math.min(CANVAS_SZ, 420);
      }

      var isMobile = window.matchMedia && window.matchMedia('(max-width: 600px)').matches;
      if (isMobile) {
        // Mobile: make it extremely simple and stable.
        // We want the canvas to match the remaining vertical space in the frame.
        var h = Math.floor(frame.clientHeight || 0);
        if (!Number.isFinite(h) || h <= 0) {
          h = Math.floor(frame.getBoundingClientRect().height || 0);
        }

        // During open/resize, measurements can temporarily be tiny; fall back to last good size.
        if (state.canvasSz && h < 20) h = Math.min(state.canvasSz, CANVAS_SZ);

        h = Math.min(h, CANVAS_SZ);
        return Math.max(1, h);
      }

      // Desktop/tablet: keep the existing measurement-based sizing.
      var padding = 10;
      var rect = frame.getBoundingClientRect();
      var maxFit = Math.floor(Math.min(rect.width, rect.height) - padding);
      if (!Number.isFinite(maxFit) || maxFit < 0) maxFit = 0;

      var sz = Math.min(maxFit, CANVAS_SZ);
      return Math.max(1, sz);
    }

    function scheduleResize() {
      if (scheduleResize._t) cancelAnimationFrame(scheduleResize._t);
      scheduleResize._t = requestAnimationFrame(function () {
        resizeCanvasIfNeeded();
      });
    }

    function resizeCanvasIfNeeded() {
      if (!state.fc) return;
      var newSz = computeCanvasSize();
      var oldSz = state.canvasSz || newSz;
      if (!newSz || Math.abs(newSz - oldSz) < 2) return;

      var scale = newSz / oldSz;

      var canvasEl = document.getElementById('ikc-canvas-' + blockId);
      if (!canvasEl) return;

      canvasEl.width = newSz;
      canvasEl.height = newSz;

      state.fc.setWidth(newSz);
      state.fc.setHeight(newSz);
      state.fc.setDimensions({ width: newSz, height: newSz }, { cssOnly: false });

      if (state.fc.wrapperEl) {
        state.fc.wrapperEl.style.width = newSz + 'px';
        state.fc.wrapperEl.style.height = newSz + 'px';
      }

      state.fc.getObjects().forEach(function (obj) {
        obj.scaleX = (obj.scaleX || 1) * scale;
        obj.scaleY = (obj.scaleY || 1) * scale;
        obj.left = (obj.left || 0) * scale;
        obj.top = (obj.top || 0) * scale;
        obj.setCoords();
      });

      state.canvasSz = newSz;
      state.fc.renderAll();
    }

    function setupCanvasResizeHandling() {
      var frame = canvasFrame || document.querySelector('#ikc-modal-' + blockId + ' .ikc-canvas-frame');
      if (!frame) return;

      if (typeof ResizeObserver !== 'undefined') {
        var ro = new ResizeObserver(function () { scheduleResize(); });
        ro.observe(frame);
      } else {
        window.addEventListener('resize', function () { scheduleResize(); });
      }
    }

    function findProductForm(root) {
      var el = root;
      while (el && el !== document.body) {
        el = el.parentElement;
        if (el && el.matches('form[action*="/cart/add"]')) return el;
      }
      return document.querySelector('form[action*="/cart/add"]');
    }

    function hideNativePurchaseButtons(root) {
      var form = findProductForm(root);
      if (!form) return;

      var elementsToHide = [];

      // Main add-to-cart buttons (varies by theme)
      elementsToHide = elementsToHide.concat(Array.prototype.slice.call(
        form.querySelectorAll('button[type="submit"], input[type="submit"], button[name="add"]')
      ));

      // Dynamic checkout (Shop Pay / accelerated checkouts) container
      var payButtons = [];
      payButtons = payButtons.concat(Array.prototype.slice.call(form.querySelectorAll('.shopify-payment-button')));
      if (form.parentElement) {
        payButtons = payButtons.concat(Array.prototype.slice.call(form.parentElement.querySelectorAll('.shopify-payment-button')));
      }
      elementsToHide = elementsToHide.concat(payButtons);

      elementsToHide.forEach(function (el) {
        if (!el || el.dataset.ikcHidden === 'true') return;
        el.dataset.ikcPrevDisplay = el.style.display || '';
        el.style.display = 'none';
        el.dataset.ikcHidden = 'true';
      });
    }
  } // end initBlock

  // ── Utilities ─────────────────────────────────────────────────────────
  function escAttr(str) { return String(str).replace(/"/g, '&quot;'); }
  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
})();
