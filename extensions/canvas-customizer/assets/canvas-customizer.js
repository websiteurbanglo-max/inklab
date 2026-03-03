/**
 * InkCanvas Canvas Customizer – Storefront widget
 * Injected via Theme App Extension block.
 * Compatible with Fabric.js v5 (loaded from CDN at runtime).
 */
/* global fabric */
(function () {
  'use strict';

  // ── Read config written by the Liquid block ─────────────────────────────
  var cfg       = window.InkCanvasConfig || {};
  var ROOT_ID   = cfg.rootId   || 'inkcanvas-root';
  var APP_URL   = (cfg.appUrl  || '').replace(/\/$/, '');
  var SHOP      = cfg.shop     || '';
  var CANVAS_SZ = parseInt(cfg.canvasSize, 10) || 500;
  var SHOW_FONTS  = cfg.showFonts  !== false && cfg.showFonts  !== 'false';
  var SHOW_UPLOAD = cfg.showUpload !== false && cfg.showUpload !== 'false';
  var PLACEHOLDER = cfg.placeholder || 'Enter your text here...';
  var FABRIC_CDN  = 'https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.0/fabric.min.js';

  // ── Boot ───────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  function boot() {
    var root = document.getElementById(ROOT_ID);
    if (!root) return;
    root.innerHTML = buildSkeletonHTML();
    loadScript(FABRIC_CDN, function () { initWidget(root); });
  }

  // ── HTML template ──────────────────────────────────────────────────────
  function buildSkeletonHTML() {
    var fontBlock = SHOW_FONTS
      ? '<div class="ikc-group">'
        + '<label class="ikc-label" for="ikc-font-select">Font style</label>'
        + '<select id="ikc-font-select" class="ikc-select"><option value="">Loading fonts…</option></select>'
        + '</div>'
      : '';

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

    return '<div class="ikc-wrap">'
      + '<div class="ikc-canvas-col">'
      + '<canvas id="ikc-canvas"></canvas>'
      + '</div>'
      + '<div class="ikc-controls-col">'
      + '<h3 class="ikc-heading">Personalize your product</h3>'
      + '<div class="ikc-group">'
      + '<label class="ikc-label" for="ikc-text-input">Your text</label>'
      + '<input id="ikc-text-input" class="ikc-input" type="text" placeholder="' + PLACEHOLDER + '" maxlength="80" />'
      + '</div>'
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
      rawImageUrl:  '',
    };

    if (SHOW_FONTS)  setupFonts(fc, state);
    setupText(fc, state);
    if (SHOW_UPLOAD) setupImageUpload(fc, state);
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
        state.textObj = new fabric.IText(val, {
          left:     CANVAS_SZ / 2,
          top:      Math.round(CANVAS_SZ * 0.78),
          originX:  'center',
          originY:  'center',
          fontSize: Math.round(CANVAS_SZ * 0.075),
          fontFamily: state.fontFamily,
          fill:     '#1a1a1a',
          textAlign: 'center',
          editable: true,
        });
        fc.add(state.textObj);
        fc.setActiveObject(state.textObj);
      } else {
        state.textObj.set({ text: val, fontFamily: state.fontFamily });
      }
      fc.renderAll();
    });
  }

  // ── Image upload ────────────────────────────────────────────────────────
  function setupImageUpload(fc, state) {
    var input     = document.getElementById('ikc-img-input');
    var labelSpan = document.getElementById('ikc-upload-label');
    if (!input) return;

    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      if (!file) return;

      // Validate size (max 20 MB)
      if (file.size > 20 * 1024 * 1024) {
        alert('Image must be smaller than 20 MB.');
        return;
      }

      if (labelSpan) labelSpan.textContent = 'Uploading…';

      var fd = new FormData();
      fd.append('file', file);

      fetch(APP_URL + '/api/upload?shop=' + encodeURIComponent(SHOP) + '&type=raw', {
        method: 'POST',
        body: fd,
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          state.rawImageUrl = data.url || '';
          placeImageOnCanvas(fc, state, data.url, file.name, labelSpan);
        })
        .catch(function (err) {
          console.error('[InkCanvas] Raw image upload failed:', err);
          if (labelSpan) labelSpan.textContent = 'Upload failed – try again';
        });
    });
  }

  function placeImageOnCanvas(fc, state, url, fileName, labelSpan) {
    fabric.Image.fromURL(
      url,
      function (img, isError) {
        if (isError) {
          console.error('[InkCanvas] Failed to load image from URL:', url);
          if (labelSpan) labelSpan.textContent = 'Image load failed – try again';
          return;
        }

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
        if (state.textObj) fc.bringToFront(state.textObj);
        fc.renderAll();

        if (labelSpan) labelSpan.textContent = fileName;
      },
      { crossOrigin: 'anonymous' }
    );
  }

  // ── Add to Cart intercept ───────────────────────────────────────────────
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
      var hasImage  = Boolean(state.rawImageUrl);

      // If nothing was customized, let normal cart submission proceed
      if (!hasText && !hasImage) return;

      e.preventDefault();

      var submitBtn = form.querySelector('[type="submit"]');
      var origLabel = submitBtn ? submitBtn.textContent : '';
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Processing…'; }

      // Export canvas at 3× DPI for print quality (1500×1500 for a 500px canvas)
      var dataUrl = fc.toDataURL({ format: 'png', multiplier: 3 });

      fetch(APP_URL + '/api/upload?shop=' + encodeURIComponent(SHOP) + '&type=design', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl: dataUrl }),
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          var props = {
            '_custom_text':       (textInput && textInput.value.trim()) || '',
            '_custom_font':       state.fontName || '',
            '_raw_image_url':     state.rawImageUrl || '',
            '_design_image_url':  data.url || '',
            '_canvas_json':       JSON.stringify(fc.toJSON()),
          };

          injectLineItemProps(form, props);
          form.submit();
        })
        .catch(function (err) {
          console.error('[InkCanvas] Design upload failed:', err);
          if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = origLabel || 'Add to cart'; }
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
  function loadScript(src, cb) {
    if (document.querySelector('script[src="' + src + '"]')) { cb(); return; }
    var s   = document.createElement('script');
    s.src   = src;
    s.async = true;
    s.onload  = cb;
    s.onerror = function () { console.error('[InkCanvas] Failed to load:', src); };
    document.head.appendChild(s);
  }

  function escAttr(str) { return String(str).replace(/"/g, '&quot;'); }
  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
})();
