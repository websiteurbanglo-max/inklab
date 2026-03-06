import { Link, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { getAllFonts } from "../models/font.server";
import { getOrdersByShop } from "../models/order.server";
import { upsertShop } from "../models/shop.server";

export const loader = async ({ request }) => {
  console.log("[loader:app._index] START");

  try {
    const { session } = await authenticate.admin(request);
    const shop = session.shop;

    console.log("[loader:app._index] Authenticated shop:", shop);
    console.log("[loader:app._index] Upserting shop in Firestore");
    await upsertShop(shop);
    console.log("[loader:app._index] upsertShop done");
    console.log("[loader:app._index] Fetching fonts + recent orders");
    const [fonts, orders] = await Promise.all([
      getAllFonts(shop),
      getOrdersByShop(shop, 5),
    ]);

    console.log(
      `[loader:app._index] fonts=${fonts.length} recentOrders=${orders.length}`,
    );

    return {
      shop,
      fontCount: fonts.length,
      activeFontCount: fonts.filter((f) => f.isActive).length,
      recentOrderCount: orders.length,
    };
  } catch (err) {
    // Re-throw Response objects (302 redirects to /auth/login) silently — they are
    // the normal Shopify re-auth mechanism, not application errors.
    if (err instanceof Response) throw err;
    console.error("[loader:app._index] FAILED:", err);
    throw err;
  }
};

export default function AppHome() {
  const { shop, fontCount, activeFontCount, recentOrderCount } =
    useLoaderData();

  return (
    <s-page heading="InkCanvas Customizer">
      {/* Welcome banner */}
      <s-section padding="none">
        <s-banner tone="info">
          Welcome to <strong>InkCanvas</strong>! Use the navigation to manage
          fonts and view customized orders. The storefront canvas widget is
          injected via the Theme App Extension — activate it from your theme
          editor.
        </s-banner>
      </s-section>

      {/* Stat cards */}
      <s-section>
        <s-stack direction="inline" gap="base">
          <div style={{ flex: 1 }}>
            <s-stack gap="small">
              <s-heading>{fontCount}</s-heading>
              <s-text tone="neutral">
                Fonts uploaded ({activeFontCount} active)
              </s-text>
              <Link to="/app/fonts">Manage fonts →</Link>
            </s-stack>
          </div>
          <s-divider />
          <div style={{ flex: 1 }}>
            <s-stack gap="small">
              <s-heading>{recentOrderCount}</s-heading>
              <s-text tone="neutral">Recent customized orders</s-text>
              <Link to="/app/orders">View all orders →</Link>
            </s-stack>
          </div>
        </s-stack>
      </s-section>

      {/* Quick setup guide */}
      <s-section heading="Quick setup guide">
        <s-stack gap="base">
          <s-paragraph>
            <strong>Step 1 — Upload fonts</strong>
            <br />
            Go to Fonts and upload any custom TTF, OTF, WOFF, or WOFF2 fonts you
            want customers to use.
          </s-paragraph>
          <s-paragraph>
            <strong>Step 2 — Activate the canvas widget</strong>
            <br />
            In your Shopify admin, navigate to Online Store → Themes →
            Customize. Add the Canvas Customizer app block to the product page
            section.
          </s-paragraph>
          <s-paragraph>
            <strong>Step 3 — Receive orders</strong>
            <br />
            When customers personalize and purchase a product, the customization
            data will appear in the Orders tab with download links for the raw
            image and design PNG.
          </s-paragraph>
        </s-stack>
      </s-section>

      {/* Connected shop */}
      <s-section padding="none">
        <s-text tone="neutral">
          Connected shop: <strong>{shop}</strong>
        </s-text>
      </s-section>
    </s-page>
  );
}
