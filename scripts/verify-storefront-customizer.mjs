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
