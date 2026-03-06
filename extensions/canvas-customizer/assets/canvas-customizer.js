/**
 * InkCanvas Canvas Customizer – Storefront widget
 * Injected via Theme App Extension block.
 * Compatible with Fabric.js v6 (loaded from CDN at runtime).
 */
/* global fabric */
(function () {
  'use strict';

  // ── Read config written by the Liquid block ─────────────────────────────
  // Primary source: window.InkCanvasConfig (set by the Liquid block).
  // Fallback: read from the root .inkcanvas-root element's data-* attributes.
  var cfg = window.InkCanvasConfig || {};

  if (!cfg.appUrl || !cfg.shop || !cfg.rootId) {
    var rootEl = document.querySelector('.inkcanvas-root[data-shop]');
    if (rootEl) {
      cfg = {
        rootId: rootEl.id || 'inkcanvas-root',
        appUrl: 'https://inklab-production.up.railway.app',
        shop: rootEl.getAttribute('data-shop') || '',
        canvasSize: rootEl.getAttribute('data-canvas-size') || 500,
        showFonts: rootEl.getAttribute('data-show-fonts'),
        showUpload: rootEl.getAttribute('data-show-upload'),
        placeholder: rootEl.getAttribute('data-placeholder') || 'Enter your text here...',
      };
      window.InkCanvasConfig = cfg;
    }
  }

  var ROOT_ID   = cfg.rootId   || 'inkcanvas-root';
  var APP_URL   = (cfg.appUrl  || '').replace(/\/$/, '');
  var SHOP      = cfg.shop     || (window.Shopify && window.Shopify.shop) || '';
  var CANVAS_SZ = parseInt(cfg.canvasSize, 10) || 500;
  var SHOW_FONTS  = cfg.showFonts  !== false && cfg.showFonts  !== 'false';
  var SHOW_UPLOAD = cfg.showUpload !== false && cfg.showUpload !== 'false';
  var PLACEHOLDER = cfg.placeholder || 'Enter your text here...';
  // ── Boot ───────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  function boot() {
    var root = document.getElementById(ROOT_ID);
    if (!root) return;

    // Responsive: shrink canvas to fit narrow screens before Fabric initialises.
    // Fabric sets inline pixel dimensions on its wrapper div, so CSS alone can't rescue it.
    var vw = window.innerWidth || document.documentElement.clientWidth || 600;
    if (vw < 640) {
      CANVAS_SZ = Math.max(Math.min(CANVAS_SZ, vw - 40), 220);
    }

    root.innerHTML = buildSkeletonHTML();
    var canvas = root.querySelector('#ikc-canvas');
    if (canvas) canvas.style.background = '#f9fafb';
    // Fabric.js is loaded via asset_url in the Liquid template (served from Shopify CDN).
    // If for any reason it's not yet defined, wait briefly and retry.
    if (window.fabric) {
      initWidget(root);
    } else {
      var attempts = 0;
      var poll = setInterval(function () {
        attempts++;
        if (window.fabric) {
          clearInterval(poll);
          initWidget(root);
        } else if (attempts > 50) {
          clearInterval(poll);
          showWidgetError(root, 'Canvas failed to load. Please refresh the page.');
        }
      }, 100);
    }
  }

  function showWidgetError(root, msg) {
    var el = root.querySelector('#ikc-error-msg');
    if (!el) {
      el = document.createElement('p');
      el.id = 'ikc-error-msg';
      el.className = 'ikc-error-msg';
      root.insertBefore(el, root.firstChild);
    }
    el.textContent = msg;
  }

  function clearWidgetError(root) {
    var el = root.querySelector('#ikc-error-msg');
    if (el) el.textContent = '';
  }

  // ── HTML template ──────────────────────────────────────────────────────
  function buildSkeletonHTML() {
    var fontBlock = SHOW_FONTS
      ? '<div class="ikc-group">'
        + '<label class="ikc-label" for="ikc-font-select">Font style</label>'
        + '<select id="ikc-font-select" class="ikc-select"><option value="">Loading fonts…</option></select>'
        + '</div>'
      : '';

    var colorBlock = '<div class="ikc-group">'
      + '<label class="ikc-label" for="ikc-color-input">Text color</label>'
      + '<div class="ikc-color-row">'
      + '<input id="ikc-color-input" class="ikc-color-swatch" type="color" value="#1a1a1a" />'
      + '<span id="ikc-color-hex" class="ikc-color-hex">#1a1a1a</span>'
      + '</div>'
      + '</div>';

    var uploadBlock = SHOW_UPLOAD
      ? '<div class="ikc-group">'
        + '<label class="ikc-label">Upload image</label>'
        + '<label class="ikc-upload-btn" for="ikc-img-input">'
        + '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>'
        + '<span id="ikc-upload-label">Choose image (PNG / JPG)</span>'
        + '</label>'
        + '<input id="ikc-img-input" type="file" accept="image/png,image/jpeg,image/webp" style="display:none" />'
        + '</div>'
      : '';

    return '<p id="ikc-error-msg" class="ikc-error-msg" style="display:none"></p>'
      + '<div class="ikc-wrap">'
      + '<div class="ikc-canvas-col">'
      + '<canvas id="ikc-canvas"></canvas>'
      + '</div>'
      + '<div class="ikc-controls-col">'
      + '<h3 class="ikc-heading">Personalize your product</h3>'
      + '<div class="ikc-group">'
      + '<label class="ikc-label" for="ikc-text-input">Your text</label>'
      + '<input id="ikc-text-input" class="ikc-input" type="text" placeholder="' + PLACEHOLDER + '" maxlength="80" />'
      + '</div>'
      + colorBlock
      + fontBlock
      + uploadBlock
      + '<p class="ikc-note">Live preview updates as you type. Final design is printed in high resolution.</p>'
      + '</div>'
      + '</div>';
  }

  // ── Widget init ─────────────────────────────────────────────────────────
  function initWidget(root) {
    if (typeof fabric === 'undefined') {
      console.error('[InkCanvas] Fabric.js failed to load.');
      return;
    }

    var canvasEl = document.getElementById('ikc-canvas');
    canvasEl.width  = CANVAS_SZ;
    canvasEl.height = CANVAS_SZ;

    var fc = new fabric.Canvas('ikc-canvas', {
      backgroundColor: '#ffffff',
      preserveObjectStacking: true,
      width: CANVAS_SZ,
      height: CANVAS_SZ,
    });

    var state = {
      textObj:      null,
      imageObj:     null,
      fontFamily:   'sans-serif',
      fontName:     '',
      textColor:    '#1a1a1a',
      rawFile:      null,   // File object — set on file select, uploaded only at cart submit
      blobUrl:      '',    // revocable blob URL for canvas preview (no server needed)
      hintObj:      null,  // faint placeholder removed once content is added
    };

    // Show a faint hint so the user can see the canvas is ready
    state.hintObj = new fabric.IText('Add text or image to preview', {
      left:       CANVAS_SZ / 2,
      top:        CANVAS_SZ / 2,
      originX:    'center',
      originY:    'center',
      fontSize:   Math.max(13, Math.round(CANVAS_SZ * 0.033)),
      fontFamily: 'sans-serif',
      fill:       '#c4c9d4',
      selectable: false,
      evented:    false,
    });
    fc.add(state.hintObj);
    fc.renderAll();

    if (SHOW_FONTS)  setupFonts(fc, state);
    setupText(fc, state);
    setupColorPicker(fc, state);
    if (SHOW_UPLOAD) setupImageUpload(fc, state, root);
    setupCartInterception(fc, state, root);
  }

  // ── Font manager ────────────────────────────────────────────────────────
  function setupFonts(fc, state) {
    var select = document.getElementById('ikc-font-select');
    if (!select || !APP_URL || !SHOP) return;

    fetch(APP_URL + '/api/fonts?shop=' + encodeURIComponent(SHOP))
      .then(function (r) { return r.json(); })
      .then(function (fonts) {
        if (!Array.isArray(fonts) || fonts.length === 0) {
          select.innerHTML = '<option value="">No fonts configured</option>';
          return;
        }
        select.innerHTML = fonts.map(function (f) {
          return '<option value="' + escAttr(f.url) + '" data-name="' + escAttr(f.name) + '">' + escHtml(f.name) + '</option>';
        }).join('');

        // Load and apply the first font immediately
        var first = fonts[0];
        loadAndApplyFont(fc, state, first.url, first.name);

        select.addEventListener('change', function () {
          var opt = select.options[select.selectedIndex];
          if (opt && opt.value) {
            loadAndApplyFont(fc, state, opt.value, opt.dataset.name || opt.text);
          }
        });
      })
      .catch(function (err) {
        console.warn('[InkCanvas] Font fetch failed:', err);
        select.innerHTML = '<option value="">Default font</option>';
      });
  }

  function loadAndApplyFont(fc, state, url, name) {
    // Sanitize name for use as CSS font-family
    var safeName = 'ikc-' + name.replace(/[^a-z0-9]/gi, '-').toLowerCase();

    // Inject @font-face only once
    if (!document.getElementById('ikc-ff-' + safeName)) {
      var style = document.createElement('style');
      style.id  = 'ikc-ff-' + safeName;
      style.textContent = '@font-face { font-family: "' + safeName + '"; src: url("' + url + '"); font-display: swap; }';
      document.head.appendChild(style);
    }

    // Use FontFace API for reliable load detection
    if (typeof FontFace !== 'undefined') {
      var ff = new FontFace(safeName, 'url(' + url + ')');
      ff.load().then(function (loaded) {
        document.fonts.add(loaded);
        applyFontToCanvas(fc, state, safeName, name);
      }).catch(function () {
        // Fallback: delay and hope the font loaded via <style>
        setTimeout(function () { applyFontToCanvas(fc, state, safeName, name); }, 600);
      });
    } else {
      setTimeout(function () { applyFontToCanvas(fc, state, safeName, name); }, 600);
    }
  }

  function applyFontToCanvas(fc, state, safeName, displayName) {
    state.fontFamily = safeName;
    state.fontName   = displayName;
    if (state.textObj) {
      state.textObj.set('fontFamily', safeName);
      fc.renderAll();
    }
  }

  // ── Text layer ──────────────────────────────────────────────────────────
  function setupText(fc, state) {
    var input = document.getElementById('ikc-text-input');
    if (!input) return;

    input.addEventListener('input', function () {
      var val = input.value;
      if (!state.textObj) {
        if (!val) return;
        if (state.hintObj) { fc.remove(state.hintObj); state.hintObj = null; }
        state.textObj = new state.FabricText(val, {
          left:       CANVAS_SZ / 2,
          top:        Math.round(CANVAS_SZ * 0.78),
          originX:    'center',
          originY:    'center',
          fontSize:   Math.round(CANVAS_SZ * 0.075),
          fontFamily: state.fontFamily,
          fill:       state.textColor,
          textAlign:  'center',
          editable:   true,
        });
        fc.add(state.textObj);
        fc.setActiveObject(state.textObj);
      } else {
        state.textObj.set({ text: val, fontFamily: state.fontFamily });
      }
      fc.renderAll();
    });
  }

  // ── Color picker ────────────────────────────────────────────────────────
  function setupColorPicker(fc, state) {
    var picker = document.getElementById('ikc-color-input');
    var hexLabel = document.getElementById('ikc-color-hex');
    if (!picker) return;

    picker.addEventListener('input', function () {
      var color = picker.value;
      state.textColor = color;
      if (hexLabel) hexLabel.textContent = color;
      if (state.textObj) {
        state.textObj.set({ fill: color });
        fc.renderAll();
      }
    });
  }

  // ── Image upload ────────────────────────────────────────────────────────
  // The image is previewed on canvas instantly using a local blob URL.
  // The actual upload to Firebase only happens at cart submit time.
  function setupImageUpload(fc, state, root) {
    var input     = document.getElementById('ikc-img-input');
    var labelSpan = document.getElementById('ikc-upload-label');
    if (!input) return;

    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      if (!file) return;

      // Validate size (max 20 MB)
      if (file.size > 20 * 1024 * 1024) {
        showWidgetError(root, 'Image must be smaller than 20 MB.');
        return;
      }

      clearWidgetError(root);

      // Revoke previous blob URL to free memory
      if (state.blobUrl) URL.revokeObjectURL(state.blobUrl);

      // Create a local blob URL — no server call needed for preview
      var blobUrl = URL.createObjectURL(file);
      state.rawFile = file;
      state.blobUrl = blobUrl;

      placeImageOnCanvas(fc, state, blobUrl, file.name, labelSpan, root);
    });
  }

  function placeImageOnCanvas(fc, state, url, fileName, labelSpan, root) {
    // Fabric.js v6: fromURL returns a Promise
    fabric.Image.fromURL(url, { crossOrigin: 'anonymous' })
      .then(function (img) {
        if (state.hintObj) { fc.remove(state.hintObj); state.hintObj = null; }
        if (state.imageObj) fc.remove(state.imageObj);

        var maxDim = CANVAS_SZ * 0.85;
        var scale  = Math.min(maxDim / (img.width || 1), maxDim / (img.height || 1));

        img.set({
          left:    CANVAS_SZ / 2,
          top:     CANVAS_SZ / 2,
          originX: 'center',
          originY: 'center',
          scaleX:  scale,
          scaleY:  scale,
        });

        state.imageObj = img;
        fc.add(img);
        if (state.textObj) fc.bringObjectToFront(state.textObj);
        fc.renderAll();

        if (labelSpan) labelSpan.textContent = fileName;
      })
      .catch(function () {
        console.error('[InkCanvas] Failed to load image from URL:', url);
        if (labelSpan) labelSpan.textContent = 'Image load failed – try again';
        if (root) showWidgetError(root, 'Failed to display image on canvas.');
      });
  }

  // ── Add to Cart intercept ───────────────────────────────────────────────
  // At submit time we upload two things to Firebase in parallel:
  //   1. The raw customer image file (for merchant reference)
  //   2. The canvas export PNG (the actual print-ready design)
  // During the live preview phase, no server calls are made.
  function setupCartInterception(fc, state, root) {
    // Find the product form — works with most Shopify themes
    var form = findProductForm(root);
    if (!form) {
      console.warn('[InkCanvas] Could not find product form. Cart intercept skipped.');
      return;
    }

    form.addEventListener('submit', function (e) {
      var textInput = document.getElementById('ikc-text-input');
      var hasText   = textInput && textInput.value.trim().length > 0;
      var hasImage  = Boolean(state.rawFile);

      // If nothing was customized, let normal cart submission proceed
      if (!hasText && !hasImage) return;

      e.preventDefault();

      var submitBtn = form.querySelector('[type="submit"]');
      var origLabel = submitBtn ? submitBtn.textContent : '';
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Processing…'; }

      // Export canvas at 3× DPI for print quality (1500×1500 for a 500px canvas)
      var dataUrl = fc.toDataURL({ format: 'png', multiplier: 3 });

      // Upload canvas design PNG
      var designUpload = fetch(APP_URL + '/api/upload?shop=' + encodeURIComponent(SHOP) + '&type=design', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl: dataUrl }),
      }).then(function (r) {
        if (!r.ok) throw new Error('Design upload error: ' + r.status);
        return r.json();
      });

      // Upload raw customer image file (only if they uploaded one)
      var rawUpload = state.rawFile
        ? (function () {
            var fd = new FormData();
            fd.append('file', state.rawFile);
            return fetch(APP_URL + '/api/upload?shop=' + encodeURIComponent(SHOP) + '&type=raw', {
              method: 'POST',
              body: fd,
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

          // Revoke blob URL — we now have permanent Firebase URLs
          if (state.blobUrl) URL.revokeObjectURL(state.blobUrl);

          var props = {
            '_custom_text':       (textInput && textInput.value.trim()) || '',
            '_custom_font':       state.fontName || '',
            '_raw_image_url':     rawData.url || '',
            '_design_image_url':  designData.url || '',
          };

          injectLineItemProps(form, props);
          form.submit();
        })
        .catch(function (err) {
          console.error('[InkCanvas] Cart upload failed:', err);
          if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = origLabel || 'Add to cart'; }
          showWidgetError(root, 'Failed to save your design. Please try again.');
        });
    });
  }

  function findProductForm(root) {
    // Walk up the DOM looking for a Shopify product form
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
      if (!val) continue;
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

  // ── Utilities ───────────────────────────────────────────────────────────
  function escAttr(str) { return String(str).replace(/"/g, '&quot;'); }
  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
})();
