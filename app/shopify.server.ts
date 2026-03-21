import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";

// ── Startup diagnostics ────────────────────────────────────────────────────
console.log("[shopify.server] Initialising Shopify app SDK");
console.log("[shopify.server] SHOPIFY_API_KEY present:", !!process.env.SHOPIFY_API_KEY);
console.log("[shopify.server] SHOPIFY_API_SECRET present:", !!process.env.SHOPIFY_API_SECRET);
console.log("[shopify.server] SHOPIFY_APP_URL:", process.env.SHOPIFY_APP_URL || "(not set — will break OAuth)");
console.log("[shopify.server] SCOPES:", process.env.SCOPES || "(not set)");
console.log("[shopify.server] API version: January26 (2026-01)");
// ──────────────────────────────────────────────────────────────────────────

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.January26,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  // Cast needed: @shopify/shopify-app-session-storage-prisma uses @shopify/shopify-api@12 types,
  // but @shopify/shopify-app-react-router expects @13 types. Runtime is compatible.
  sessionStorage: new PrismaSessionStorage(prisma) as any,
  distribution: AppDistribution.AppStore,
  future: {
    expiringOfflineAccessTokens: true,
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

console.log("[shopify.server] shopifyApp initialised OK");

export default shopify;
export const apiVersion = ApiVersion.January26;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
