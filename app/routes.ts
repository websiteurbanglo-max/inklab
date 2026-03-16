import { flatRoutes } from "@react-router/fs-routes";
import { type RouteConfig, route } from "@react-router/dev/routes";

export default [
  // App Proxy route — must match /apps/inkcanvas/config as proxied by Shopify.
  // This explicit route overrides the default /api/config path that flatRoutes would infer.
  route("apps/inkcanvas/config", "routes/api.config.ts"),
  // All other file-based routes via flat-routes convention (api.config.ts excluded to avoid duplicate)
  ...(await flatRoutes({ ignoredRouteFiles: ["**/api.config.ts"] })),
] satisfies RouteConfig;
