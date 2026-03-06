import type { LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { getAllFonts } from "../models/font.server";
import { getOrdersByShop } from "../models/order.server";
import { upsertShop } from "../models/shop.server";
import {
  Page,
  Card,
  Banner,
  BlockStack,
  InlineStack,
  Text,
  Divider,
  Box,
} from "@shopify/polaris";

export const loader = async ({ request }: LoaderFunctionArgs) => {
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
    console.log(`[loader:app._index] fonts=${fonts.length} recentOrders=${orders.length}`);

    return {
      shop,
      fontCount: fonts.length,
      activeFontCount: fonts.filter((f) => f.isActive).length,
      recentOrderCount: orders.length,
    };
  } catch (err: unknown) {
    // Re-throw Response objects (302 redirects to /auth/login) silently — they are
    // the normal Shopify re-auth mechanism, not application errors.
    if (err instanceof Response) throw err;
    console.error("[loader:app._index] FAILED:", err);
    throw err;
  }
};

export default function AppHome() {
  const { shop, fontCount, activeFontCount, recentOrderCount } =
    useLoaderData<typeof loader>();

  return (
    <Page title="InkCanvas Customizer">
      <BlockStack gap="400">
        <Banner tone="info">
          Welcome to <strong>InkCanvas</strong>! Use the navigation to manage
          fonts and view customized orders. The storefront canvas widget is
          injected via the Theme App Extension — activate it from your theme
          editor.
        </Banner>

        <Card>
          <InlineStack gap="800" align="start">
            <BlockStack gap="200">
              <Text variant="heading2xl" as="p">{fontCount}</Text>
              <Text tone="subdued" as="p">
                Fonts available ({activeFontCount} active)
              </Text>
              <Link to="/app/fonts">Manage fonts →</Link>
            </BlockStack>
            <Divider />
            <BlockStack gap="200">
              <Text variant="heading2xl" as="p">{recentOrderCount}</Text>
              <Text tone="subdued" as="p">Recent customized orders</Text>
              <Link to="/app/orders">View all orders →</Link>
            </BlockStack>
          </InlineStack>
        </Card>

        <Card>
          <BlockStack gap="300">
            <Text variant="headingMd" as="h2">Quick setup guide</Text>
            <BlockStack gap="200">
              <Text as="p">
                <strong>Step 1 — Upload fonts</strong>
                <br />
                Go to Fonts and upload any custom TTF, OTF, WOFF, or WOFF2
                fonts you want customers to use. 20 built-in Google Fonts are
                included by default.
              </Text>
              <Text as="p">
                <strong>Step 2 — Activate the canvas widget</strong>
                <br />
                In your Shopify admin, navigate to Online Store → Themes →
                Customize. Add the{" "}
                <strong>Canvas Customizer</strong> app block to the product
                page section.
              </Text>
              <Text as="p">
                <strong>Step 3 — Receive orders</strong>
                <br />
                When customers personalize and purchase a product, the
                customization data will appear in the Orders tab with download
                links for the raw image and print-ready design PNG.
              </Text>
            </BlockStack>
          </BlockStack>
        </Card>

        <Box paddingBlockStart="100">
          <Text tone="subdued" as="p">
            Connected shop: <strong>{shop}</strong>
          </Text>
        </Box>
      </BlockStack>
    </Page>
  );
}
