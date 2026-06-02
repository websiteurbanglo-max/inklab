# Storefront Customizer Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the InkCanvas storefront customizer feel snappy on mobile and visually consistent across merchant brands while preserving the currently working customization and add-to-cart flow.

**Architecture:** Keep the existing theme app extension and vanilla JS widget. Add a small static verification script first, then make focused storefront changes: app-proxy config reuse, lazy Fabric loading, CSS tokens, modal accessibility, and resilient add-to-cart state handling.

**Tech Stack:** Shopify Theme App Extension Liquid, Shopify app proxy with React Router, vanilla JavaScript, Fabric.js, CSS custom properties, Shopify Ajax Cart API, Node.js verification script.

---

## Official Shopify References Checked

- Theme app extension assets can be loaded from `assets/` via `asset_url`, `stylesheet`, or `javascript`, and Shopify serves extension assets from its CDN for fast delivery: https://shopify.dev/docs/apps/build/online-store/theme-app-extensions/configuration
- Theme app extension app blocks should be responsive and are rendered as app blocks with merchant-controlled settings: https://shopify.dev/docs/apps/build/online-store/theme-app-extensions/configuration
- `authenticate.public.appProxy(request)` validates app proxy requests and returns app proxy context: https://shopify.dev/docs/api/shopify-app-react-router/latest/authenticate/public/app-proxy
- Shopify Ajax Cart requests should use locale-aware URLs such as `window.Shopify.routes.root + 'cart/add.js'`: https://shopify.dev/docs/api/ajax/reference/cart
- Private line item properties are made private by prefixing the key with `_`, which matches the existing InkCanvas property names: https://shopify.dev/docs/api/ajax/reference/cart

## Scope

Implement only storefront customer customizer improvements:

- `extensions/canvas-customizer/blocks/canvas-customizer.liquid`
- `extensions/canvas-customizer/assets/canvas-customizer.js`
- `extensions/canvas-customizer/assets/canvas-customizer.css`
- `scripts/verify-storefront-customizer.mjs`
- `package.json`

Do not modify merchant admin routes, order webhook parsing, Firebase storage layout, dashboard sync, or line item property names.

## File Structure

- `scripts/verify-storefront-customizer.mjs`: no-dependency guardrail script that asserts critical storefront invariants. This gives the implementation a quick regression check even though the project has no existing test runner.
- `package.json`: add `verify:storefront` so the guardrail can run consistently.
- `extensions/canvas-customizer/blocks/canvas-customizer.liquid`: remove eager Fabric script loading and pass the Fabric asset URL into `window.InkCanvasConfig`.
- `extensions/canvas-customizer/assets/canvas-customizer.js`: centralize app proxy config loading, lazy-load Fabric, hydrate fonts progressively, add debug timings, improve add-to-cart state handling, and add modal focus handling.
- `extensions/canvas-customizer/assets/canvas-customizer.css`: add design tokens, loading states, consistent focus/disabled/active states, reduced-motion support, and mobile touch/layout tightening.

## Implementation Rules

- Preserve these line item property names exactly: `_custom_text`, `_custom_font`, `_raw_image_url`, `_design_image_url`, `_variant_title`, `_print_size`.
- Preserve text-only, image-only, and text-plus-image add-to-cart behavior.
- Keep the modal as a single full-screen editor on mobile.
- Keep app proxy config as the primary customer-critical data source.
- Do not introduce a frontend dependency.
- Do not commit broad rewrites. Each task should commit only its related files.

---

### Task 1: Add Storefront Regression Guardrails

**Files:**
- Create: `scripts/verify-storefront-customizer.mjs`
- Modify: `package.json`

- [ ] **Step 1: Create the failing verification script**

Create `scripts/verify-storefront-customizer.mjs` with this content:

```js
import { readFileSync } from "node:fs";

const files = {
  liquid: "extensions/canvas-customizer/blocks/canvas-customizer.liquid",
  js: "extensions/canvas-customizer/assets/canvas-customizer.js",
  css: "extensions/canvas-customizer/assets/canvas-customizer.css",
};

const source = Object.fromEntries(
  Object.entries(files).map(([key, path]) => [key, readFileSync(path, "utf8")]),
);

const checks = [
  {
    name: "Liquid no longer eagerly loads Fabric",
    pass: !source.liquid.includes("fabric.min.js' | asset_url") &&
      source.liquid.includes("fabricUrl:"),
  },
  {
    name: "Customizer JS has lazy Fabric loader",
    pass: source.js.includes("function loadFabric") &&
      source.js.includes("window.InkCanvasFabricPromise"),
  },
  {
    name: "Customizer JS reuses app proxy config promise",
    pass: source.js.includes("configPromise") &&
      source.js.includes("loadRemoteConfig"),
  },
  {
    name: "Cart add uses Shopify locale-aware root when available",
    pass: source.js.includes("function getShopifyRoot") &&
      source.js.includes("cart/add.js"),
  },
  {
    name: "Private line item property names are preserved",
    pass: [
      "_custom_text",
      "_custom_font",
      "_raw_image_url",
      "_design_image_url",
      "_variant_title",
      "_print_size",
    ].every((key) => source.js.includes(`'${key}'`) || source.js.includes(`"${key}"`)),
  },
  {
    name: "Debug timing is gated",
    pass: source.js.includes("inkcanvas_debug") &&
      source.js.includes("console.debug"),
  },
  {
    name: "CSS exposes InkCanvas design tokens",
    pass: source.css.includes("--ikc-color-primary") &&
      source.css.includes("--ikc-radius-control") &&
      source.css.includes("--ikc-focus-ring"),
  },
  {
    name: "CSS avoids transition all",
    pass: !/transition\s*:\s*all\b/.test(source.css),
  },
  {
    name: "CSS supports reduced motion",
    pass: source.css.includes("@media (prefers-reduced-motion: reduce)"),
  },
  {
    name: "Modal accessibility helpers exist",
    pass: source.js.includes("trapModalFocus") &&
      source.js.includes("restoreFocusAfterClose"),
  },
];

let failed = 0;

for (const check of checks) {
  if (check.pass) {
    console.log(`PASS ${check.name}`);
  } else {
    failed += 1;
    console.error(`FAIL ${check.name}`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} storefront verification check(s) failed.`);
  process.exit(1);
}
```

- [ ] **Step 2: Add the package script**

In `package.json`, add this script entry after `typecheck`:

```json
"verify:storefront": "node scripts/verify-storefront-customizer.mjs"
```

The scripts block should keep valid JSON. The final nearby section should look like:

```json
"lint": "eslint --ignore-path .gitignore --cache --cache-location ./node_modules/.cache/eslint .",
"shopify": "shopify",
"prisma": "prisma",
"graphql-codegen": "graphql-codegen",
"vite": "vite",
"typecheck": "react-router typegen && tsc --noEmit",
"verify:storefront": "node scripts/verify-storefront-customizer.mjs"
```

- [ ] **Step 3: Run the new script and verify it fails**

Run:

```bash
npm run verify:storefront
```

Expected: FAIL for lazy Fabric loading, config promise reuse, locale-aware cart URL, debug timing, design tokens, reduced motion, and accessibility helpers. This confirms the guardrail script can detect the work that has not been implemented yet.

- [ ] **Step 4: Commit the failing guardrail**

```bash
git add package.json scripts/verify-storefront-customizer.mjs
git commit -m "test: add storefront customizer guardrails"
```

---

### Task 2: Route Customer-Critical Config Through One Promise

**Files:**
- Modify: `extensions/canvas-customizer/assets/canvas-customizer.js`

- [ ] **Step 1: Add debug timing helpers near the top of the IIFE**

After `'use strict';`, add:

```js
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
```

- [ ] **Step 2: Replace the fire-and-forget config fetch with a shared promise**

Replace the current block that starts with:

```js
    var configUrl = PROXY_BASE + '/config?shop=' + encodeURIComponent(SHOP) + '&product_id=' + encodeURIComponent(PRODUCT_ID);

    fetch(configUrl)
```

with:

```js
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
```

- [ ] **Step 3: Update canvas initialization to pass the promise into font setup**

Find:

```js
      if (SHOW_FONTS)  setupFonts(fc, state, blockId, APP_URL, SHOP);
```

Replace it with:

```js
      if (SHOW_FONTS)  setupFonts(fc, state, blockId, APP_URL, SHOP, configPromise);
```

- [ ] **Step 4: Update `setupFonts` to prefer the app proxy config result**

Replace the current `setupFonts` function with:

```js
    function setupFonts(fc, state, blockId, APP_URL, SHOP, configPromise) {
      var select = document.getElementById('ikc-font-select-' + blockId);
      if (!select) return;

      select.innerHTML = '<option value="">Default font</option>';

      var fontsTiming = markStart('fonts');
      var fontsPromise = configPromise
        .then(function () {
          if (state.remoteFonts && state.remoteFonts.length > 0) {
            return { source: 'proxy', fonts: state.remoteFonts };
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
    }
```

- [ ] **Step 5: Run verification**

Run:

```bash
npm run verify:storefront
```

Expected: Several checks still fail, but "Customizer JS reuses app proxy config promise", "Private line item property names are preserved", and "Debug timing is gated" should pass.

- [ ] **Step 6: Commit**

```bash
git add extensions/canvas-customizer/assets/canvas-customizer.js
git commit -m "perf: reuse storefront proxy config"
```

---

### Task 3: Lazy-Load Fabric on Intent or Open

**Files:**
- Modify: `extensions/canvas-customizer/blocks/canvas-customizer.liquid`
- Modify: `extensions/canvas-customizer/assets/canvas-customizer.js`
- Modify: `extensions/canvas-customizer/assets/canvas-customizer.css`

- [ ] **Step 1: Pass the Fabric asset URL through Liquid config**

In `extensions/canvas-customizer/blocks/canvas-customizer.liquid`, add `fabricUrl` to the `window.InkCanvasConfig[blockId]` object:

```liquid
      fabricUrl:  {{ 'fabric.min.js' | asset_url | json }},
```

Place it after `proxyBase`.

- [ ] **Step 2: Remove the eager Fabric script tag**

Remove this line from the Liquid block:

```liquid
<script src="{{ 'fabric.min.js' | asset_url }}" defer></script>
```

Keep this script tag:

```liquid
<script src="{{ 'canvas-customizer.js' | asset_url }}" defer></script>
```

- [ ] **Step 3: Add the shared Fabric loader**

Add this helper before `initBlock`:

```js
  function loadFabric(src) {
    if (window.fabric) return Promise.resolve(window.fabric);
    if (window.InkCanvasFabricPromise) return window.InkCanvasFabricPromise;

    window.InkCanvasFabricPromise = new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[data-inkcanvas-fabric="true"]');
      if (existing) {
        existing.addEventListener('load', function () { resolve(window.fabric); });
        existing.addEventListener('error', reject);
        return;
      }

      var script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.dataset.inkcanvasFabric = 'true';
      script.onload = function () { resolve(window.fabric); };
      script.onerror = function () { reject(new Error('Fabric failed to load')); };
      document.head.appendChild(script);
    });

    return window.InkCanvasFabricPromise;
  }
```

- [ ] **Step 4: Read `fabricUrl` in `initBlock`**

After the existing `PROXY_BASE` assignment, add:

```js
    var FABRIC_URL = cfg.fabricUrl || '';
```

- [ ] **Step 5: Add canvas loading state helpers inside `initBlock`**

After `clearError`, add:

```js
    function setCanvasLoading(isLoading) {
      var frame = canvasFrame || document.querySelector('#ikc-modal-' + blockId + ' .ikc-canvas-frame');
      if (!frame) return;
      frame.classList.toggle('is-loading', Boolean(isLoading));
      frame.setAttribute('aria-busy', isLoading ? 'true' : 'false');
    }
```

- [ ] **Step 6: Start Fabric loading on intent**

After the modal event listener setup, add:

```js
    function warmFabric() {
      if (!FABRIC_URL || window.fabric) return;
      loadFabric(FABRIC_URL).catch(function (err) {
        if (debugEnabled) console.debug('[InkCanvas] Fabric warm load failed:', err);
      });
    }

    openBtn.addEventListener('pointerenter', warmFabric, { once: true });
    openBtn.addEventListener('touchstart', warmFabric, { once: true, passive: true });
    openBtn.addEventListener('focus', warmFabric, { once: true });
```

- [ ] **Step 7: Replace the Fabric polling branch in `openModal`**

Replace the current `if (!state.fc) { ... }` branch in `openModal` with:

```js
      if (!state.fc) {
        setCanvasLoading(true);
        var fabricTiming = markStart('fabric');
        loadFabric(FABRIC_URL)
          .then(function () {
            markEnd('fabric', fabricTiming, 'loaded');
            requestAnimationFrame(function () {
              requestAnimationFrame(function () {
                setCanvasLoading(false);
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
        scheduleResize();
      }
```

- [ ] **Step 8: Add loading CSS**

In `extensions/canvas-customizer/assets/canvas-customizer.css`, add:

```css
.ikc-canvas-frame.is-loading::after {
  content: "Loading preview...";
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(255, 255, 255, 0.82);
  color: var(--ikc-color-muted, #6b7280);
  font-size: 0.875rem;
  font-weight: 600;
}
```

- [ ] **Step 9: Run verification**

Run:

```bash
npm run verify:storefront
```

Expected: "Liquid no longer eagerly loads Fabric" and "Customizer JS has lazy Fabric loader" pass. CSS token checks may still fail until Task 4.

- [ ] **Step 10: Commit**

```bash
git add extensions/canvas-customizer/blocks/canvas-customizer.liquid extensions/canvas-customizer/assets/canvas-customizer.js extensions/canvas-customizer/assets/canvas-customizer.css
git commit -m "perf: lazy load storefront canvas engine"
```

---

### Task 4: Add Storefront Design Tokens and Mobile Polish

**Files:**
- Modify: `extensions/canvas-customizer/assets/canvas-customizer.css`

- [ ] **Step 1: Add token defaults near the top of the CSS**

After the root comment, add:

```css
.inkcanvas-root {
  --ikc-font-family: inherit;
  --ikc-color-text: rgb(var(--color-foreground, 17, 24, 39));
  --ikc-color-muted: rgba(var(--color-foreground, 17, 24, 39), 0.68);
  --ikc-color-surface: rgb(var(--color-background, 255, 255, 255));
  --ikc-color-surface-subdued: rgba(var(--color-foreground, 17, 24, 39), 0.035);
  --ikc-color-border: rgba(var(--color-foreground, 17, 24, 39), 0.12);
  --ikc-color-primary: rgb(var(--color-foreground, 17, 24, 39));
  --ikc-color-primary-hover: rgba(var(--color-foreground, 17, 24, 39), 0.88);
  --ikc-color-danger: #b42318;
  --ikc-focus-ring: rgba(var(--color-foreground, 17, 24, 39), 0.16);
  --ikc-radius-control: 10px;
  --ikc-radius-panel: 14px;
  --ikc-radius-modal: 16px;
  --ikc-shadow-modal: 0 24px 60px rgba(0, 0, 0, 0.22);
  --ikc-shadow-canvas: 0 10px 28px rgba(0, 0, 0, 0.10);
  --ikc-motion-duration: 160ms;
  --ikc-motion-ease: cubic-bezier(0.2, 0, 0, 1);
}
```

- [ ] **Step 2: Replace hard-coded visual values with tokens**

Update the existing selectors so the important values match these examples:

```css
.inkcanvas-root {
  font-family: var(--ikc-font-family);
  color: var(--ikc-color-text);
}

.ikc-trigger-btn,
.ikc-save-btn {
  background: var(--ikc-color-primary);
  color: var(--ikc-color-surface);
  border-radius: var(--ikc-radius-control);
  transition-property: background, transform, box-shadow;
  transition-duration: var(--ikc-motion-duration);
  transition-timing-function: var(--ikc-motion-ease);
  min-height: 44px;
}

.ikc-trigger-btn:hover,
.ikc-save-btn:hover {
  background: var(--ikc-color-primary-hover);
}

.ikc-trigger-btn:active,
.ikc-save-btn:active,
.ikc-cancel-btn:active,
.ikc-edit-btn:active,
.ikc-close-btn:active {
  transform: scale(0.96);
}

.ikc-modal {
  background: var(--ikc-color-surface);
  border: 1px solid var(--ikc-color-border);
  border-radius: var(--ikc-radius-modal);
  box-shadow: var(--ikc-shadow-modal);
}

.ikc-controls-panel {
  border: 1px solid var(--ikc-color-border);
  border-radius: var(--ikc-radius-panel);
  background: var(--ikc-color-surface-subdued);
}

.ikc-canvas-frame {
  border: 1px solid var(--ikc-color-border);
  border-radius: var(--ikc-radius-panel);
  background: var(--ikc-color-surface);
  box-shadow: var(--ikc-shadow-canvas);
}

.ikc-input,
.ikc-select,
.ikc-upload-btn,
.ikc-cancel-btn,
.ikc-close-btn {
  border-color: var(--ikc-color-border);
  border-radius: var(--ikc-radius-control);
}
```

Do not duplicate selectors if the file already has them. Modify the existing rules in place.

- [ ] **Step 3: Add consistent focus-visible styles**

Add:

```css
.ikc-trigger-btn:focus-visible,
.ikc-save-btn:focus-visible,
.ikc-cancel-btn:focus-visible,
.ikc-edit-btn:focus-visible,
.ikc-close-btn:focus-visible,
.ikc-input:focus-visible,
.ikc-select:focus-visible,
.ikc-upload-btn:focus-visible {
  outline: 2px solid var(--ikc-focus-ring);
  outline-offset: 2px;
}
```

- [ ] **Step 4: Tighten disabled and loading states**

Update `.ikc-save-btn:disabled` to:

```css
.ikc-save-btn:disabled {
  opacity: 0.62;
  cursor: not-allowed;
  transform: none;
}
```

- [ ] **Step 5: Add reduced-motion support**

Add near the end of the file:

```css
@media (prefers-reduced-motion: reduce) {
  .ikc-modal,
  .ikc-trigger-btn,
  .ikc-save-btn,
  .ikc-cancel-btn,
  .ikc-edit-btn,
  .ikc-close-btn,
  .ikc-input,
  .ikc-select,
  .ikc-upload-btn {
    animation: none;
    transition-duration: 1ms;
  }
}
```

- [ ] **Step 6: Remove negative letter spacing**

Find:

```css
letter-spacing: -0.01em;
```

Remove it.

- [ ] **Step 7: Run verification**

Run:

```bash
npm run verify:storefront
```

Expected: CSS token, no `transition: all`, and reduced-motion checks pass. Modal accessibility may still fail until Task 5.

- [ ] **Step 8: Commit**

```bash
git add extensions/canvas-customizer/assets/canvas-customizer.css
git commit -m "style: align storefront customizer design tokens"
```

---

### Task 5: Add Modal Focus Management

**Files:**
- Modify: `extensions/canvas-customizer/assets/canvas-customizer.js`

- [ ] **Step 1: Add focus state to the per-block state object**

In the `state` object, add:

```js
      previouslyFocused: null,
```

- [ ] **Step 2: Add focus helper functions inside `initBlock`**

Add these functions after `closeModal`:

```js
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
```

- [ ] **Step 3: Update `openModal`**

At the beginning of `openModal`, before adding `is-open`, add:

```js
      state.previouslyFocused = document.activeElement;
```

After `document.body.style.overflow = 'hidden';`, add:

```js
      setTimeout(focusFirstModalControl, 0);
```

- [ ] **Step 4: Update `closeModal`**

After `document.body.style.overflow = '';`, add:

```js
      restoreFocusAfterClose();
```

- [ ] **Step 5: Update the existing keydown listener**

Replace the existing Escape-only listener with:

```js
    document.addEventListener('keydown', function (e) {
      if (!modal.classList.contains('is-open')) return;
      if (e.key === 'Escape') closeModal();
      trapModalFocus(e);
    });
```

- [ ] **Step 6: Run verification**

Run:

```bash
npm run verify:storefront
```

Expected: All static storefront verification checks pass.

- [ ] **Step 7: Commit**

```bash
git add extensions/canvas-customizer/assets/canvas-customizer.js
git commit -m "fix: improve storefront modal focus handling"
```

---

### Task 6: Harden Add-to-Cart State and Locale-Aware Cart URL

**Files:**
- Modify: `extensions/canvas-customizer/assets/canvas-customizer.js`

- [ ] **Step 1: Add Shopify root helper before `initBlock`**

Add:

```js
  function getShopifyRoot() {
    if (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) {
      return window.Shopify.routes.root;
    }
    return '/';
  }
```

- [ ] **Step 2: Add button state helpers inside `initBlock`**

After `clearError`, add:

```js
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
```

- [ ] **Step 3: Update add-to-cart processing state**

In `handleAddToCart`, replace:

```js
      var origLabel = addToCartBtn.textContent;
      addToCartBtn.disabled = true;
      addToCartBtn.textContent = 'Processing…';
```

with:

```js
      var origLabel = setPrimaryButtonBusy(addToCartBtn, 'Processing...');
```

- [ ] **Step 4: Add timing around export and uploads**

Replace the `state.savedDataUrl` export block with:

```js
      if (state.fc) {
        var exportTiming = markStart('design-export');
        state.savedDataUrl = state.fc.toDataURL({ format: 'png', multiplier: 3 });
        markEnd('design-export', exportTiming);
      }
```

Wrap `designUpload`:

```js
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
```

Inside the raw upload branch, add:

```js
            var rawTiming = markStart('raw-upload');
```

before `return fetch(...)`, and call:

```js
              markEnd('raw-upload', rawTiming, String(r.status));
```

inside that response handler before the `if (!r.ok)` check.

- [ ] **Step 5: Use locale-aware cart add URL**

Replace:

```js
          return fetch('/cart/add.js', {
```

with:

```js
          var cartTiming = markStart('cart-add');
          return fetch(getShopifyRoot() + 'cart/add.js', {
```

In the following `.then(function (r) { ... })`, add:

```js
          markEnd('cart-add', cartTiming, String(r.status));
```

before the `if (!r.ok)` check.

- [ ] **Step 6: Restore button state on failure**

In the `.catch`, replace:

```js
          addToCartBtn.disabled = false;
          addToCartBtn.textContent = origLabel || 'Add to cart';
```

with:

```js
          restorePrimaryButton(addToCartBtn, origLabel, 'Add to cart');
```

- [ ] **Step 7: Run static verification**

Run:

```bash
npm run verify:storefront
```

Expected: PASS for all checks.

- [ ] **Step 8: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: TypeScript completes without errors. The storefront JS is plain JS, but this catches accidental app-level issues from `package.json` edits.

- [ ] **Step 9: Commit**

```bash
git add extensions/canvas-customizer/assets/canvas-customizer.js
git commit -m "fix: harden storefront add to cart flow"
```

---

### Task 7: Shopify CLI and Browser Verification

**Files:**
- No source changes expected unless verification exposes a bug.

- [ ] **Step 1: Run static storefront verification**

Run:

```bash
npm run verify:storefront
```

Expected: every check prints `PASS`.

- [ ] **Step 2: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: no TypeScript errors.

- [ ] **Step 3: Run lint**

Run:

```bash
npm run lint
```

Expected: no new lint errors. If existing unrelated lint errors appear, record them and do not fix unrelated files.

- [ ] **Step 4: Validate Shopify app configuration**

Run:

```bash
npm run shopify -- app config validate
```

Expected: Shopify CLI validates the app configuration. If this command is not available in the installed CLI version, run:

```bash
npm run shopify -- version
```

and record the CLI limitation in the final verification notes.

- [ ] **Step 5: Start the dev server**

Run:

```bash
npm run dev
```

Expected: Shopify CLI starts the app and theme extension dev session. Keep the terminal session running for browser checks.

- [ ] **Step 6: Verify product page network behavior**

In the storefront product page where the Canvas Customizer block is active:

1. Open browser devtools Network.
2. Reload the product page.
3. Confirm `canvas-customizer.js` and `canvas-customizer.css` load from Shopify extension assets.
4. Confirm `fabric.min.js` is not requested before interacting with the customize button.
5. Hover/focus/touch or click `Customize Product`.
6. Confirm `fabric.min.js` loads once.
7. Confirm `/apps/inkcanvas/config` is requested.
8. Confirm `/api/fonts` is not requested during a successful app-proxy config flow.

- [ ] **Step 7: Verify mobile editor behavior**

Use a mobile viewport around 390 by 844:

1. Tap `Customize Product`.
2. Confirm the modal opens immediately.
3. Confirm the modal fills the viewport and respects safe-area spacing.
4. Confirm the canvas frame does not jump as Fabric loads.
5. Type text before changing the font.
6. Confirm text appears on the canvas with fallback font, then selected font applies once loaded.
7. Upload a small PNG or JPG.
8. Confirm the preview appears without leaving the modal.

- [ ] **Step 8: Verify add-to-cart paths**

Run these three customer flows:

1. Text only: enter text, add to cart, confirm cart redirect and line item properties exist in `/cart.js`.
2. Image only: upload image, add to cart, confirm cart redirect and line item properties exist in `/cart.js`.
3. Text plus image: enter text, upload image, add to cart, confirm cart redirect and line item properties exist in `/cart.js`.

For each flow, confirm these private keys are present in the Ajax cart response:

```txt
_custom_text
_custom_font
_raw_image_url
_design_image_url
_variant_title
_print_size
```

- [ ] **Step 9: Verify failure recovery**

Temporarily block the design upload request in browser devtools or change the request URL in a local test branch, then click add to cart.

Expected:

- The button re-enables.
- The label returns to `Add to cart`.
- The inline error says the add-to-cart failed.
- The customer's text/image remains in the editor.

Revert any local test-only URL change before continuing.

- [ ] **Step 10: Final commit if verification-only fixes were needed**

If Task 7 required any source changes:

```bash
git add extensions/canvas-customizer/blocks/canvas-customizer.liquid extensions/canvas-customizer/assets/canvas-customizer.js extensions/canvas-customizer/assets/canvas-customizer.css scripts/verify-storefront-customizer.mjs package.json
git commit -m "fix: verify storefront customizer polish"
```

If no changes were needed, do not create an empty commit.

---

## Final Verification Checklist

Before marking the implementation complete:

- [ ] `npm run verify:storefront` passes.
- [ ] `npm run typecheck` passes.
- [ ] `npm run lint` passes or only reports pre-existing unrelated issues.
- [ ] Shopify CLI config validation passes or CLI limitation is documented.
- [ ] Fabric is not loaded on initial product page load.
- [ ] Fabric loads once on intent/open.
- [ ] App proxy config is the normal source for fonts.
- [ ] Direct `/api/fonts` is only a fallback.
- [ ] Mobile editor opens as a single full-screen editor.
- [ ] Text-only add to cart works.
- [ ] Image-only add to cart works.
- [ ] Text-plus-image add to cart works.
- [ ] Existing private line item properties are unchanged.
- [ ] Upload/cart failure keeps customer design state.
- [ ] Debug timing only logs when `inkcanvas_debug=1` is enabled.

## Handoff Notes

This plan intentionally avoids changing backend data models and merchant/admin UI. If implementation reveals that the app proxy itself is consistently slow even after removing the race with `/api/fonts`, collect timing evidence from `inkcanvas_debug=1` before proposing backend caching or CDN changes.
