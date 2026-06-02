# Storefront Customizer Performance and Design-System Design

Date: 2026-06-03
Status: Approved for implementation planning

## Goal

Improve the InkCanvas storefront customer customizer so it feels fast, mobile-friendly, and visually consistent across multiple merchant brands without breaking the currently functional app.

The first pass focuses on the storefront customer experience only. It keeps the existing single full-screen editor model, the current canvas capabilities, the existing app proxy route, and the current add-to-cart behavior. The work is optimization and consistency, not a product redesign.

## Current Context

The storefront extension is implemented in:

- `extensions/canvas-customizer/blocks/canvas-customizer.liquid`
- `extensions/canvas-customizer/assets/canvas-customizer.js`
- `extensions/canvas-customizer/assets/canvas-customizer.css`

The backend routes involved in the customer path are:

- `GET /apps/inkcanvas/config` through Shopify app proxy, implemented by `app/routes/api.config.ts`
- `GET /api/fonts`, implemented by `app/routes/api.fonts.ts`
- `POST /api/upload`, implemented by `app/routes/api.upload.ts`
- Shopify Ajax cart endpoint `/cart/add.js`

The app is functional today. Any implementation must preserve the working purchase path, line item properties, image/design upload behavior, and cart redirect.

## Problems to Solve

The likely slow-feeling path is not primarily the editor layout. It is the timing and consistency of resource and data loading.

The current widget starts a config request through the app proxy, but font setup can fall back to the direct app API if the editor opens before the proxy response has populated `state.remoteFonts`. That can create an extra cross-origin request at the moment the customer expects the editor to be ready.

The Fabric asset is also loaded on every eligible product page through a deferred script tag. It is about 316 KB, so it should not sit on the product page's initial path if the customer never customizes.

The CSS uses hard-coded colors, radii, shadows, spacing, and control styles. This makes the widget feel like a separate embedded app rather than a brand-compatible part of each storefront.

## Design Principles

Preserve behavior first. Performance improvements should not change what customers can do or what merchants receive in orders.

Make opening feel instant. The customize button should respond immediately, even if heavier resources finish a moment later.

Progressively hydrate. Text input, default styling, and the empty canvas state should be usable before brand fonts finish loading.

Use one customer-critical data path. The app proxy config response should be the primary source for customer-facing config and fonts. Direct app API fallback should be reserved for actual proxy failure, not normal timing races.

Design with tokens. The widget should inherit the theme where practical and use InkCanvas CSS variables for structure and state. This lets different brands use the same extension without a visually inconsistent experience.

Measure before tuning. Add small timing instrumentation so future optimization is evidence-based.

## Storefront Architecture

### Config and Font Loading

The widget should create one per-block config promise during initialization. That promise fetches the app proxy config and is stored in block state.

When the editor opens, font setup should await or reuse that config promise instead of immediately falling back to `/api/fonts`. If the proxy returns usable fonts, use them. If the proxy fails or returns no usable data, use default font behavior and optionally fall back to `/api/fonts` in the background.

The editor must not block typing on font loading. It should start with the browser fallback font, then apply the selected brand font once the `FontFace` load completes.

The response from `/apps/inkcanvas/config` should remain cacheable. If implementation changes cache headers, use a customer-safe short cache window and avoid serving stale merchant-critical configuration for too long.

### Fabric Loading

Fabric should move off the initial page load path. Instead of loading `fabric.min.js` as a normal deferred script on every eligible product page, the widget should load it on intent or open.

Acceptable triggers:

- Pointer enter, touch start, or focus on the customize button
- Click on the customize button

The loader should be idempotent and shared across blocks so multiple customizer blocks do not inject multiple Fabric scripts.

On open, the modal should show immediately. If Fabric is still loading, show a lightweight loading state inside the canvas frame while controls remain stable. Once Fabric is ready and layout has settled, initialize the canvas.

### Mobile Editor

Keep the existing single full-screen editor. Do not introduce a wizard or multi-step flow.

On mobile:

- Modal fills the viewport and respects safe-area insets.
- Header stays compact.
- Canvas remains the visual focus.
- Controls remain reachable without cramped two-column layouts.
- Add-to-cart CTA stays easy to reach.
- Touch targets are at least 40 by 40 pixels.
- Error text appears near the action area and does not destroy the customer design state.

The implementation can tighten spacing and control placement, but it should not replace the editor with a different workflow.

### Design-System Consistency

Introduce a small CSS token layer on `.inkcanvas-root` and modal elements.

Suggested token categories:

- Font: inherit merchant theme font by default.
- Colors: text, muted text, surface, surface-subdued, border, primary, primary-hover, danger.
- Radius: control radius, panel radius, modal radius.
- Shadow: modal shadow, canvas shadow.
- Focus: consistent ring color and offset.
- Motion: enter transition duration and easing.
- Spacing: compact control gaps and modal padding.

Hard-coded visual values should be replaced where they represent design-system choices. Structural measurements that protect layout stability can remain explicit.

Transitions should name the properties they animate. Avoid `transition: all`.

Buttons should get consistent hover, active, loading, disabled, and focus-visible states. Active press feedback should be subtle and should not cause layout shift.

### Add-to-Cart Path

Keep the existing add-to-cart sequence:

1. Validate that text or image exists.
2. Export design PNG from Fabric.
3. Upload design image.
4. Upload raw image if present.
5. Add the configured variant to `/cart/add.js` with the existing line item properties.
6. Redirect to `/cart`.

Do not change property names in this pass:

- `_custom_text`
- `_custom_font`
- `_raw_image_url`
- `_design_image_url`
- `_variant_title`
- `_print_size`

The button should clearly show processing state and recover if any upload or cart add fails. On failure, restore the original button label and keep the customer's text/image on canvas.

### Accessibility

The modal should retain `role="dialog"` and `aria-modal="true"`.

Implementation should add or verify:

- Focus moves into the modal on open.
- Focus returns to the trigger on close.
- Focus is trapped inside the modal while open.
- Escape closes the modal on desktop and compatible mobile browsers.
- Loading and error states are announced in a reasonable way.
- Reduced-motion preferences are respected.

### Instrumentation

Add lightweight browser timing instrumentation behind a debug switch so production customers are not spammed.

Useful timing marks:

- Config fetch start/end and source used
- Fabric load start/end
- Canvas init start/end
- Font list ready
- Selected font load start/end
- Image object URL ready
- Image placed on canvas
- Design export duration
- Design upload duration
- Raw upload duration
- Cart add duration

The first implementation can log to `console.debug` only when enabled by a query parameter or local storage flag such as `inkcanvas_debug=1`. It should not send analytics events yet.

## Error Handling

Config failure should not prevent opening the editor. The editor should use default canvas size and fallback font behavior.

Font failure should not block text editing. The select can show a default option and the canvas should continue with a fallback font.

Fabric failure should show a clear canvas-engine error and keep the modal closeable.

Upload and cart failures should show an inline error and re-enable the primary CTA.

Image decode/display failure should keep the text path usable and allow the customer to choose another file.

## Testing and Verification

Implementation should include focused manual or automated verification for:

- Product page initial load no longer loads Fabric until intent/open.
- Opening the editor on mobile shows a stable full-screen modal.
- Typing works before brand fonts finish loading.
- Proxy config is reused for fonts when available.
- Direct `/api/fonts` is not called during normal successful proxy flow.
- Existing text-only add-to-cart still works.
- Existing image-only add-to-cart still works.
- Existing text-plus-image add-to-cart still works.
- Existing hidden line item property names are preserved.
- Failed upload restores the button and preserves the customer's design.
- Modal focus behavior works on desktop keyboard navigation.
- Styling remains usable in a generic light storefront theme.

Use browser network inspection or Playwright route observation for the Fabric/config/font loading assertions.

## Out of Scope

Do not add a wizard flow.

Do not add new design tools, multiple text layers, presets, templates, clipart, or advanced transformations.

Do not change backend storage layout.

Do not change order webhook parsing or dashboard sync behavior.

Do not change merchant/admin app pages in this pass except if a tiny configuration dependency is required for storefront correctness.

Do not change Shopify line item property names.

## Implementation Safety Notes

Make changes in small, reversible steps.

Prefer feature-preserving refactors inside the storefront JS/CSS files.

Keep the Liquid block schema compatible with existing merchant installations.

If a change affects purchase flow, verify text-only, image-only, and text-plus-image add-to-cart before calling it complete.

Because the app is currently functional, avoid broad rewrites. The desired outcome is a faster, more consistent customer path with the same business behavior.
