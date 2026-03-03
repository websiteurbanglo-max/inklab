import type { ActionFunctionArgs } from "react-router";
import { uploadToStorage } from "../firebase.server";
import { v4 as uuidv4 } from "uuid";

function corsHeaders(origin?: string | null) {
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const origin = request.headers.get("origin");

  // Handle OPTIONS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  const type = url.searchParams.get("type") ?? "raw"; // "raw" | "design"

  if (!shop || !shop.includes(".myshopify.com")) {
    return Response.json(
      { error: "Missing or invalid shop parameter" },
      { status: 400, headers: corsHeaders(origin) }
    );
  }

  try {
    const contentType = request.headers.get("content-type") ?? "";
    let buffer: Buffer;
    let mimeType: string;
    let ext: string;

    if (contentType.includes("application/json")) {
      // Canvas design: sent as { dataUrl: "data:image/png;base64,..." }
      const body = await request.json() as { dataUrl: string };
      const dataUrl: string = body.dataUrl;

      if (!dataUrl || !dataUrl.startsWith("data:")) {
        return Response.json(
          { error: "Invalid dataUrl" },
          { status: 400, headers: corsHeaders(origin) }
        );
      }

      const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) {
        return Response.json(
          { error: "Malformed data URL" },
          { status: 400, headers: corsHeaders(origin) }
        );
      }

      mimeType = matches[1];
      buffer = Buffer.from(matches[2], "base64");
      ext = mimeType === "image/png" ? "png" : "jpg";
    } else if (contentType.includes("multipart/form-data")) {
      // Raw user image: multipart form upload
      const formData = await request.formData();
      const file = formData.get("file");

      if (!file || typeof file === "string") {
        return Response.json(
          { error: "No file provided" },
          { status: 400, headers: corsHeaders(origin) }
        );
      }

      const fileObj = file as File;
      const arrayBuffer = await fileObj.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
      mimeType = fileObj.type || "image/jpeg";
      ext = mimeType.includes("png") ? "png" : "jpg";
    } else {
      return Response.json(
        { error: "Unsupported content type" },
        { status: 415, headers: corsHeaders(origin) }
      );
    }

    // Validate file size (max 20MB)
    if (buffer.length > 20 * 1024 * 1024) {
      return Response.json(
        { error: "File too large (max 20MB)" },
        { status: 413, headers: corsHeaders(origin) }
      );
    }

    const id = uuidv4();
    const destination = `uploads/${shop}/${type}/${id}.${ext}`;
    const downloadUrl = await uploadToStorage(buffer, destination, mimeType);

    return Response.json(
      { url: downloadUrl, id },
      { headers: corsHeaders(origin) }
    );
  } catch (err) {
    console.error("Upload error:", err);
    return Response.json(
      { error: "Upload failed" },
      { status: 500, headers: corsHeaders(origin) }
    );
  }
};

// Support OPTIONS via loader as well (some clients use GET for CORS checks)
export const loader = async ({ request }: ActionFunctionArgs) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(request.headers.get("origin")),
    });
  }
  return new Response("Not Found", { status: 404 });
};
