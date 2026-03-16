import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { getProductConfig } from "../models/product-config.server";
import { getAllFonts } from "../models/font.server";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Cache-Control": "public, max-age=60",
  };
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  // Authenticate as App Proxy request — Shopify validates the HMAC signature
  let shop: string;
  try {
    const result = await authenticate.public.appProxy(request);
    // Session may be undefined if no offline token exists for the shop yet.
    // Shopify also passes ?shop= in every app proxy request as a reliable fallback.
    shop = result.session?.shop ?? new URL(request.url).searchParams.get("shop") ?? "";
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!shop) {
    return Response.json({ error: "Missing shop" }, { status: 400, headers: corsHeaders() });
  }

  const url = new URL(request.url);
  const productId = url.searchParams.get("product_id") ?? "";

  const [config, fonts] = await Promise.all([
    productId
      ? getProductConfig(shop, productId)
      : Promise.resolve({ enabled: true, canvasSize: 500, allowedFontUrls: [] }),
    getAllFonts(shop),
  ]);

  const activeFonts = fonts
    .filter((f) => f.isActive)
    .map((f) => ({ name: f.name, url: f.storageUrl }));

  return Response.json(
    {
      enabled: config.enabled,
      canvasSize: config.canvasSize ?? 500,
      fonts: activeFonts,
    },
    { headers: corsHeaders() }
  );
};
