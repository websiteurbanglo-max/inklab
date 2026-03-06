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
import {
  Page,
  Card,
  Banner,
  BlockStack,
  InlineStack,
  Text,
  Button,
  Badge,
  Modal,
  TextField,
  EmptyState,
} from "@shopify/polaris";

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

  const thStyle: React.CSSProperties = {
    textAlign: "left",
    padding: "0.75rem 1rem",
    fontSize: "0.8125rem",
    fontWeight: 600,
    color: "#6d7175",
    background: "#f6f6f7",
    whiteSpace: "nowrap" as const,
  };
  const tdStyle: React.CSSProperties = { padding: "0.75rem 1rem", verticalAlign: "middle" };

  return (
    <Page
      title="Font Manager"
      primaryAction={{ content: "Upload Font", onAction: openModal }}
    >
      <BlockStack gap="400">
        {/* Feedback banners */}
        {actionData && "error" in actionData && actionData.error && (
          <Banner tone="critical">{actionData.error}</Banner>
        )}
        {actionData && "message" in actionData && actionData.message && (
          <Banner tone="success">{actionData.message}</Banner>
        )}

        {/* ── Built-in / System Fonts ──────────────────────────────────── */}
        <Card>
          <BlockStack gap="300">
            <Text variant="headingMd" as="h2">Default Fonts (Built-in)</Text>
            <Text as="p" tone="subdued">
              These {systemFonts.length} fonts are available to every shop
              automatically — no upload needed. They are always active and
              cannot be removed.
            </Text>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #e1e3e5" }}>
                    <th style={thStyle}>Font Name</th>
                    <th style={thStyle}>Preview</th>
                    <th style={thStyle}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {systemFonts.map((font) => (
                    <tr key={font.id} style={{ borderBottom: "1px solid #f1f2f3" }}>
                      <td style={tdStyle}>
                        <Text as="p" fontWeight="semibold">{font.name}</Text>
                      </td>
                      <td style={tdStyle}>
                        <span
                          style={{
                            fontFamily: `"${font.name}", sans-serif`,
                            fontSize: "1.1rem",
                            color: "#1a1a1a",
                          }}
                        >
                          AaBbCc 123
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <Badge tone="success">Built-in</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </BlockStack>
        </Card>

        {/* ── Custom / Shop-uploaded Fonts ─────────────────────────────── */}
        <Card>
          <BlockStack gap="300">
            <Text variant="headingMd" as="h2">Your Custom Fonts</Text>
            {customFonts.length === 0 ? (
              <EmptyState
                heading="No custom fonts uploaded yet"
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                action={{ content: "Upload Font", onAction: openModal }}
              >
                <Text as="p" tone="subdued">
                  Upload your brand fonts to add them alongside the built-in
                  defaults in the storefront font picker.
                </Text>
              </EmptyState>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #e1e3e5" }}>
                      <th style={thStyle}>Font Name</th>
                      <th style={thStyle}>File</th>
                      <th style={thStyle}>Status</th>
                      <th style={thStyle}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customFonts.map((font) => (
                      <tr key={font.id} style={{ borderBottom: "1px solid #f1f2f3" }}>
                        <td style={tdStyle}>
                          <Text as="p" fontWeight="semibold">{font.name}</Text>
                        </td>
                        <td style={tdStyle}>
                          <Text as="p" tone="subdued">{font.fileName}</Text>
                        </td>
                        <td style={tdStyle}>
                          <Badge tone={font.isActive ? "success" : "enabled"}>
                            {font.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td style={tdStyle}>
                          <InlineStack gap="200">
                            <fetcher.Form method="post">
                              <input type="hidden" name="intent" value="toggle" />
                              <input type="hidden" name="fontId" value={font.id} />
                              <input
                                type="hidden"
                                name="isActive"
                                value={font.isActive ? "false" : "true"}
                              />
                              <Button variant="plain" size="slim" submit>
                                {font.isActive ? "Deactivate" : "Activate"}
                              </Button>
                            </fetcher.Form>
                            <fetcher.Form method="post">
                              <input type="hidden" name="intent" value="delete" />
                              <input type="hidden" name="fontId" value={font.id} />
                              <Button variant="plain" tone="critical" size="slim" submit>
                                Delete
                              </Button>
                            </fetcher.Form>
                          </InlineStack>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </BlockStack>
        </Card>

        {/* Info card */}
        <Card>
          <Text as="p" tone="subdued">
            Your storefront font picker automatically includes all{" "}
            {systemFonts.length} built-in fonts (Google Fonts, served from
            Google&apos;s CDN). Upload your own brand fonts in TTF, OTF, WOFF,
            or WOFF2 format; they appear after the built-in defaults in the
            picker. Deactivating a custom font hides it from the storefront
            without deleting it.
          </Text>
        </Card>
      </BlockStack>

      {/* Upload Modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title="Upload a new font"
        primaryAction={{
          content: isSubmitting ? "Uploading…" : "Upload",
          disabled: isSubmitting || !fontName || !selectedFile,
          onAction: handleUpload,
        }}
        secondaryActions={[{ content: "Cancel", onAction: closeModal }]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <TextField
              label="Display name"
              value={fontName}
              onChange={setFontName}
              placeholder="e.g. Pacifico Script"
              autoComplete="off"
            />
            <BlockStack gap="200">
              <Text as="p" fontWeight="medium">
                Font file (TTF, OTF, WOFF, WOFF2)
              </Text>
              <input
                ref={fileInputRef}
                type="file"
                accept=".ttf,.otf,.woff,.woff2"
                onChange={handleFileChange}
                style={{ display: "block" }}
              />
              {selectedFile && (
                <Text as="p" tone="subdued">
                  Selected: {selectedFile.name} (
                  {(selectedFile.size / 1024).toFixed(1)} KB)
                </Text>
              )}
            </BlockStack>
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
