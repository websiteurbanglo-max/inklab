/**
 * InkCanvas Canvas Customizer – Storefront popup widget
 * Requires Fabric.js v6 loaded via asset_url in the Liquid block.
 */
/* global fabric */
(function () {
  'use strict';

  var MAX_PREVIEW_PX = 200; // max preview thumbnail size in px (for largest variant)

  // ── Boot: wait for DOM, then init each block ──────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootAll);
  } else {
    bootAll();
  }

  function bootAll() {
    var configs = window.InkCanvasConfig;
    if (!configs || typeof configs !== 'object') return;

    Object.keys(configs).forEach(function (blockId) {
      var cfg = configs[blockId];
      if (cfg && cfg.blockId) {
        initBlock(cfg);
      }
    });
  }

  // ── Per-block init ────────────────────────────────────────────────────────
  function initBlock(cfg) {
    var blockId    = cfg.blockId;
    var root       = document.getElementById('inkcanvas-root-' + blockId);
    if (!root) return;

    var APP_URL    = (cfg.appUrl  || '').replace(/\/$/, '');
    var PROXY_BASE = (cfg.proxyBase || '/apps/inkcanvas').replace(/\/$/, '');
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
    var saveBtn     = document.getElementById('ikc-save-btn-' + blockId);
    var editBtn     = document.getElementById('ikc-edit-btn-' + blockId);
    var previewArea = document.getElementById('ikc-preview-' + blockId);
    var previewImg  = document.getElementById('ikc-preview-img-' + blockId);
    var errorMsg    = document.getElementById('ikc-modal-error-' + blockId);
    var popupVariantSel = document.getElementById('ikc-variant-select-' + blockId);

    if (!openBtn || !modal) return;

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
    };

    // ── Fetch per-product config from App Proxy ──────────────────────────
    var configUrl = PROXY_BASE + '/config?shop=' + encodeURIComponent(SHOP) + '&product_id=' + encodeURIComponent(PRODUCT_ID);

    fetch(configUrl)
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (remoteConfig) {
        if (remoteConfig) {
          if (remoteConfig.canvasSize) CANVAS_SZ = parseInt(remoteConfig.canvasSize, 10) || CANVAS_SZ;
          state.remoteFonts = remoteConfig.fonts || null;
        }
      })
      .catch(function () {
        // Config fetch failure is non-fatal — use defaults
      });

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

    // Close on Escape key
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal();
    });

    function openModal() {
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';

      if (!state.fc) {
        if (window.fabric) {
          initCanvas();
        } else {
          var attempts = 0;
          var poll = setInterval(function () {
            attempts++;
            if (window.fabric) {
              clearInterval(poll);
              initCanvas();
            } else if (attempts > 50) {
              clearInterval(poll);
              showError('Canvas engine failed to load. Please refresh.');
            }
          }, 100);
        }
      }
    }

    function closeModal() {
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }

    // ── Canvas init ───────────────────────────────────────────────────────
    function initCanvas() {
      if (typeof fabric === 'undefined') { showError('Canvas engine not loaded.'); return; }
      if (state.fc) return;

      var canvasEl = document.getElementById('ikc-canvas-' + blockId);
      if (!canvasEl) return;

      // Measure popup canvas column width for responsive sizing
      var col = canvasEl.closest('.ikc-canvas-col');
      var colWidth = col ? col.clientWidth : 0;
      var sz = Math.min(CANVAS_SZ, colWidth > 40 ? colWidth - 8 : CANVAS_SZ);
      sz = Math.max(sz, 220);

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

      if (SHOW_FONTS)  setupFonts(fc, state, blockId, APP_URL, SHOP);
      setupText(fc, state, blockId);
      setupColorPicker(fc, state, blockId);
      if (SHOW_UPLOAD) setupImageUpload(fc, state, blockId);

      if (saveBtn) {
        saveBtn.addEventListener('click', function () {
          handleSave(fc, state, blockId);
        });
      }

      setupCartInterception(fc, state, blockId, APP_URL, SHOP);
    }

    // ── Save handler ─────────────────────────────────────────────────────
    function handleSave(fc, state, blockId) {
      var textInput = document.getElementById('ikc-text-input-' + blockId);
      var hasText   = textInput && textInput.value.trim().length > 0;
      var hasImage  = Boolean(state.rawFile);

      if (!hasText && !hasImage) {
        showError('Please add some text or upload an image first.');
        return;
      }
      clearError();

      if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving…'; }

      state.savedDataUrl = fc.toDataURL({ format: 'png', multiplier: 3 });

      var previewSize = computePreviewSize(state.selectedVariantTitle);

      if (previewImg) {
        previewImg.src = state.savedDataUrl;
        previewImg.style.width  = previewSize + 'px';
        previewImg.style.height = previewSize + 'px';
      }

      if (previewArea) previewArea.style.display = '';

      closeModal();
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save Design'; }
    }

    // ── Preview size computation ──────────────────────────────────────────
    function computePreviewSize(variantTitle) {
      var parsed = parseInches(variantTitle);
      if (!parsed) return 160;

      var maxInches = parsed;
      if (popupVariantSel) {
        for (var i = 0; i < popupVariantSel.options.length; i++) {
          var title = popupVariantSel.options[i].getAttribute('data-title') || popupVariantSel.options[i].text;
          var v = parseInches(title);
          if (v && v > maxInches) maxInches = v;
        }
      }

      return Math.round((parsed / maxInches) * MAX_PREVIEW_PX);
    }

    function parseInches(str) {
      if (!str) return null;
      var m = str.match(/(\d+(?:\.\d+)?)\s*(?:inch(?:es)?|in\b|")/i);
      if (m) return parseFloat(m[1]);
      var n = str.match(/^(\d+(?:\.\d+)?)/);
      return n ? parseFloat(n[1]) : null;
    }

    function showError(msg) {
      if (errorMsg) { errorMsg.textContent = msg; errorMsg.style.display = ''; }
    }
    function clearError() {
      if (errorMsg) { errorMsg.textContent = ''; errorMsg.style.display = 'none'; }
    }

    // ── Font manager ──────────────────────────────────────────────────────
    function setupFonts(fc, state, blockId, APP_URL, SHOP) {
      var select = document.getElementById('ikc-font-select-' + blockId);
      if (!select) return;

      var fontsPromise;
      if (state.remoteFonts && state.remoteFonts.length > 0) {
        fontsPromise = Promise.resolve(state.remoteFonts);
      } else {
        fontsPromise = fetch(APP_URL + '/api/fonts?shop=' + encodeURIComponent(SHOP))
          .then(function (r) { return r.json(); });
      }

      fontsPromise
        .then(function (fonts) {
          if (!Array.isArray(fonts) || fonts.length === 0) {
            select.innerHTML = '<option value="">No fonts configured</option>';
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
        .catch(function () {
          select.innerHTML = '<option value="">Default font</option>';
        });
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
      var sz = state.canvasSz;

      input.addEventListener('input', function () {
        var val = input.value;
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

    // ── Color picker ──────────────────────────────────────────────────────
    function setupColorPicker(fc, state, blockId) {
      var picker   = document.getElementById('ikc-color-input-' + blockId);
      var hexLabel = document.getElementById('ikc-color-hex-' + blockId);
      if (!picker) return;

      picker.addEventListener('input', function () {
        var color = picker.value;
        state.textColor = color;
        if (hexLabel) hexLabel.textContent = color;
        if (state.textObj) { state.textObj.set({ fill: color }); fc.renderAll(); }
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

    // ── Cart intercept ────────────────────────────────────────────────────
    function setupCartInterception(fc, state, blockId, APP_URL, SHOP) {
      var form = findProductForm(root);
      if (!form) return;

      form.addEventListener('submit', function (e) {
        if (!state.savedDataUrl) return;

        e.preventDefault();
        var submitBtn = form.querySelector('[type="submit"]');
        var origLabel = submitBtn ? submitBtn.textContent : '';
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Processing…'; }

        var dataUrl = state.savedDataUrl;

        var designUpload = fetch(APP_URL + '/api/upload?shop=' + encodeURIComponent(SHOP) + '&type=design', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dataUrl: dataUrl }),
        }).then(function (r) {
          if (!r.ok) throw new Error('Design upload error: ' + r.status);
          return r.json();
        });

        var rawUpload = state.rawFile
          ? (function () {
              var fd = new FormData();
              fd.append('file', state.rawFile);
              return fetch(APP_URL + '/api/upload?shop=' + encodeURIComponent(SHOP) + '&type=raw', {
                method: 'POST', body: fd,
              }).then(function (r) {
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

            var textInput = document.getElementById('ikc-text-input-' + blockId);
            var props = {
              '_custom_text':      (textInput && textInput.value.trim()) || '',
              '_custom_font':      state.fontName || '',
              '_raw_image_url':    rawData.url || '',
              '_design_image_url': designData.url || '',
              '_variant_title':    state.selectedVariantTitle || '',
              '_print_size':       state.selectedVariantTitle || '',
            };

            injectLineItemProps(form, props);
            form.submit();
          })
          .catch(function (err) {
            console.error('[InkCanvas] Cart upload failed:', err);
            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = origLabel || 'Add to cart'; }
            showError('Failed to save your design. Please try again.');
          });
      });
    }

    function findProductForm(root) {
      var el = root;
      while (el && el !== document.body) {
        el = el.parentElement;
        if (el && el.matches('form[action*="/cart/add"]')) return el;
      }
      return document.querySelector('form[action*="/cart/add"]');
    }

    function injectLineItemProps(form, props) {
      for (var key in props) {
        if (!Object.prototype.hasOwnProperty.call(props, key)) continue;
        var val = props[key];
        if (val === null || val === undefined) continue;
        var name  = 'properties[' + key + ']';
        var input = form.querySelector('input[name="' + name + '"]');
        if (!input) {
          input = document.createElement('input');
          input.type = 'hidden';
          input.name = name;
          form.appendChild(input);
        }
        input.value = val;
      }
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
