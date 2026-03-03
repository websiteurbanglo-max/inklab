import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { getFonts } from "../models/font.server";

function corsHeaders(origin?: string) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "public, max-age=60",
  };
}

// Handle OPTIONS preflight
export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request.headers.get("origin") ?? undefined) });
  }
  return new Response("Method Not Allowed", { status: 405 });
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");

  if (!shop || !shop.includes(".myshopify.com")) {
    return Response.json(
      { error: "Missing or invalid shop parameter" },
      { status: 400, headers: corsHeaders() }
    );
  }

  try {
    const fonts = await getFonts(shop);
    return Response.json(
      fonts.map((f) => ({
        id: f.id,
        name: f.name,
        url: f.storageUrl,
      })),
      { headers: corsHeaders(request.headers.get("origin") ?? undefined) }
    );
  } catch (err) {
    console.error("Error fetching fonts:", err);
    return Response.json(
      { error: "Failed to load fonts" },
      { status: 500, headers: corsHeaders() }
    );
  }
};
