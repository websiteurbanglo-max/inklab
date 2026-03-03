import {
  useLoaderData,
  useFetcher,
  useNavigation,
  useActionData,
} from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useState, useCallback, useRef } from "react";
import { authenticate } from "../shopify.server";
import {
  getAllFonts,
  createFont,
  toggleFont,
  deleteFont,
} from "../models/font.server";
import { uploadToStorage } from "../firebase.server";
import { v4 as uuidv4 } from "uuid";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  console.log("[loader:app.fonts] START url:", request.url);
  console.log("[loader:app.fonts] method:", request.method);
  const headersObj: Record<string, string> = {};
  request.headers.forEach((v, k) => { headersObj[k] = v; });
  console.log("[loader:app.fonts] headers:", JSON.stringify(headersObj, null, 2));
  try {
    const { session } = await authenticate.admin(request);
    console.log("[loader:app.fonts] Authenticated shop:", session.shop);
    const fonts = await getAllFonts(session.shop);
    console.log(`[loader:app.fonts] Fetched ${fonts.length} fonts`);
    return { shop: session.shop, fonts };
  } catch (err: unknown) {
    if (err instanceof Response) {
      console.log("[loader:app.fonts] Auth redirect →", err.status, err.headers.get("location"));
      throw err;
    }
    console.error("[loader:app.fonts] FAILED:", err);
    throw err;
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "upload") {
    console.log(`[action:app.fonts] upload intent for shop=${shop}`);
    const name = (formData.get("name") as string)?.trim();
    const file = formData.get("file") as File | null;

    if (!name) return { ok: false, error: "Font name is required." };
    if (!file || file.size === 0) return { ok: false, error: "Font file is required." };

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["ttf", "otf", "woff", "woff2"].includes(ext ?? "")) {
      return { ok: false, error: "Only TTF, OTF, WOFF, WOFF2 files are supported." };
    }

    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const id = uuidv4();
      const destination = `fonts/${shop}/${id}.${ext}`;
      const contentType =
        ext === "woff2" ? "font/woff2" :
        ext === "woff"  ? "font/woff"  :
        ext === "otf"   ? "font/otf"   : "font/ttf";

      console.log(`[action:app.fonts] Uploading to Firebase Storage: ${destination}`);
      const storageUrl = await uploadToStorage(buffer, destination, contentType);
      console.log(`[action:app.fonts] Storage upload OK url=${storageUrl}`);

      console.log(`[action:app.fonts] Creating Firestore font doc name="${name}"`);
      await createFont(shop, { name, fileName: file.name, storageUrl });
      console.log(`[action:app.fonts] Firestore font created OK`);

      return { ok: true, message: `Font "${name}" uploaded successfully.` };
    } catch (err: unknown) {
      console.error(`[action:app.fonts] Upload FAILED for shop=${shop}:`, err);
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, error: `Upload failed: ${msg}` };
    }
  }

  if (intent === "toggle") {
    const fontId = formData.get("fontId") as string;
    if (fontId.startsWith("system-")) return { ok: false, error: "Built-in fonts cannot be modified." };
    const isActive = formData.get("isActive") === "true";
    console.log(`[action:app.fonts] toggle intent fontId=${fontId} isActive=${isActive} shop=${shop}`);
    try {
      await toggleFont(shop, fontId, isActive);
      console.log(`[action:app.fonts] toggle OK fontId=${fontId}`);
    } catch (err: unknown) {
      console.error(`[action:app.fonts] toggle FAILED fontId=${fontId}:`, err);
      return { ok: false, error: "Failed to update font status." };
    }
    return { ok: true };
  }

  if (intent === "delete") {
    const fontId = formData.get("fontId") as string;
    if (fontId.startsWith("system-")) return { ok: false, error: "Built-in fonts cannot be deleted." };
    console.log(`[action:app.fonts] delete intent fontId=${fontId} shop=${shop}`);
    try {
      await deleteFont(shop, fontId);
      console.log(`[action:app.fonts] delete OK fontId=${fontId}`);
    } catch (err: unknown) {
      console.error(`[action:app.fonts] delete FAILED fontId=${fontId}:`, err);
      return { ok: false, error: "Failed to delete font." };
    }
    return { ok: true, message: "Font deleted." };
  }

  return { ok: false, error: "Unknown action." };
};

export default function FontsPage() {
  const { fonts } = useLoaderData<typeof loader>();
  const systemFonts = fonts.filter((f) => f.isSystem);
  const customFonts  = fonts.filter((f) => !f.isSystem);
  const actionData = useActionData<typeof action>();
  const fetcher = useFetcher();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [modalOpen, setModalOpen] = useState(false);
  const [fontName, setFontName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fontNameInputId = "font-name-input";

  // Open/close the s-modal web component imperatively via DOM property
  const modalRef = useCallback((el: HTMLElement | null) => {
    if (!el) return;
    (el as HTMLElement & { open?: boolean }).open = modalOpen;
  }, [modalOpen]);

  const openModal = useCallback(() => {
    setFontName("");
    setSelectedFile(null);
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => setModalOpen(false), []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSelectedFile(e.target.files?.[0] ?? null);
    },
    []
  );

  const handleUpload = useCallback(() => {
    if (!selectedFile || !fontName) return;
    const fd = new FormData();
    fd.append("intent", "upload");
    fd.append("name", fontName);
    fd.append("file", selectedFile);
    fetcher.submit(fd, { method: "post", encType: "multipart/form-data" });
    closeModal();
  }, [fetcher, fontName, selectedFile, closeModal]);

  return (
    <s-page heading="Font Manager">
      {/* s-button in primary-action slot */}
      <s-button slot="primary-action" variant="primary" onClick={openModal}>
        Upload Font
      </s-button>

      {/* Feedback banners */}
      {actionData && "error" in actionData && actionData.error && (
        <s-section padding="none">
          <s-banner tone="critical">{actionData.error}</s-banner>
        </s-section>
      )}
      {actionData && "message" in actionData && actionData.message && (
        <s-section padding="none">
          <s-banner tone="success">{actionData.message}</s-banner>
        </s-section>
      )}

      {/* ── Built-in / System Fonts ─────────────────────────────────────── */}
      <s-section heading="Default Fonts (Built-in)">
        <s-paragraph>
          These {systemFonts.length} fonts are available to every shop automatically — no upload
          needed. They are always active and cannot be removed.
        </s-paragraph>
        <s-table>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "0.5rem 1rem" }}>Font Name</th>
                <th style={{ textAlign: "left", padding: "0.5rem 1rem" }}>Category</th>
                <th style={{ textAlign: "left", padding: "0.5rem 1rem" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {systemFonts.map((font) => (
                <tr key={font.id}>
                  <td style={{ padding: "0.5rem 1rem", fontWeight: 500 }}>{font.name}</td>
                  <td style={{ padding: "0.5rem 1rem" }}>
                    <s-badge tone="info">Built-in</s-badge>
                  </td>
                  <td style={{ padding: "0.5rem 1rem" }}>
                    <s-badge tone="success">Active</s-badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </s-table>
      </s-section>

      {/* ── Custom / Shop-uploaded Fonts ─────────────────────────────────── */}
      <s-section heading="Your Custom Fonts">
        {customFonts.length === 0 ? (
          <div style={{ textAlign: "center", padding: "2rem 0" }}>
            <s-stack gap="base">
              <s-heading>No custom fonts uploaded yet</s-heading>
              <s-paragraph tone="neutral">
                Upload your brand fonts to add them alongside the built-in
                defaults in the storefront font picker.
              </s-paragraph>
            </s-stack>
          </div>
        ) : (
          <s-table>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "0.5rem 1rem" }}>Font Name</th>
                  <th style={{ textAlign: "left", padding: "0.5rem 1rem" }}>File</th>
                  <th style={{ textAlign: "left", padding: "0.5rem 1rem" }}>Status</th>
                  <th style={{ textAlign: "left", padding: "0.5rem 1rem" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {customFonts.map((font) => (
                  <tr key={font.id}>
                    <td style={{ padding: "0.5rem 1rem" }}>{font.name}</td>
                    <td style={{ padding: "0.5rem 1rem" }}>{font.fileName}</td>
                    <td style={{ padding: "0.5rem 1rem" }}>
                      <s-badge tone={font.isActive ? "success" : "neutral"}>
                        {font.isActive ? "Active" : "Inactive"}
                      </s-badge>
                    </td>
                    <td style={{ padding: "0.5rem 1rem" }}>
                      <s-stack direction="inline" gap="small">
                        <fetcher.Form method="post">
                          <input type="hidden" name="intent" value="toggle" />
                          <input type="hidden" name="fontId" value={font.id} />
                          <input type="hidden" name="isActive" value={font.isActive ? "false" : "true"} />
                          <s-button variant="tertiary" type="submit">
                            {font.isActive ? "Deactivate" : "Activate"}
                          </s-button>
                        </fetcher.Form>
                        <fetcher.Form method="post">
                          <input type="hidden" name="intent" value="delete" />
                          <input type="hidden" name="fontId" value={font.id} />
                          <s-button variant="tertiary" tone="critical" type="submit">
                            Delete
                          </s-button>
                        </fetcher.Form>
                      </s-stack>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </s-table>
        )}
      </s-section>

      {/* Info section */}
      <s-section heading="About fonts">
        <s-paragraph>
          Your storefront font picker automatically includes all {systemFonts.length} built-in
          fonts (Google Fonts, served from Google&apos;s CDN — no upload needed). You can
          also upload your own brand fonts in TTF, OTF, WOFF, or WOFF2 format; they will
          appear after the built-in defaults in the picker. Deactivating a custom font hides
          it from the storefront without deleting it.
        </s-paragraph>
      </s-section>

      {/* Upload modal — using native dialog as s-modal equivalent */}
      {/* s-modal web component */}
      <s-modal ref={modalRef as unknown as (el: HTMLElement | null) => void} heading="Upload a new font">
        <s-stack gap="base">
          {/* Font name field */}
          <div>
            <label htmlFor={fontNameInputId} style={{ display: "block", marginBottom: "0.25rem", fontWeight: 500 }}>
              Display name
            </label>
            <input
              id={fontNameInputId}
              type="text"
              value={fontName}
              onChange={(e) => setFontName(e.target.value)}
              placeholder="e.g. Pacifico Script"
              autoComplete="off"
              style={{ width: "100%", padding: "0.5rem", boxSizing: "border-box" }}
            />
          </div>

          {/* File picker */}
          <s-stack gap="small">
            <s-text>Font file (TTF, OTF, WOFF, WOFF2)</s-text>
            <input
              ref={fileInputRef}
              type="file"
              accept=".ttf,.otf,.woff,.woff2"
              onChange={handleFileChange}
              style={{ display: "block" }}
            />
            {selectedFile && (
              <s-text tone="neutral">
                Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
              </s-text>
            )}
          </s-stack>
        </s-stack>

        {/* Modal footer actions */}
        <s-button-group slot="primary-action">
          <s-button
            variant="primary"
            disabled={isSubmitting || !fontName || !selectedFile}
            onClick={handleUpload}
          >
            {isSubmitting ? "Uploading…" : "Upload"}
          </s-button>
          <s-button variant="secondary" onClick={closeModal}>
            Cancel
          </s-button>
        </s-button-group>
      </s-modal>
    </s-page>
  );
}
