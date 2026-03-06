import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { getOrdersByShop } from "../models/order.server";
import {
  Page,
  Card,
  Banner,
  BlockStack,
  InlineStack,
  Text,
  Badge,
  Button,
  Thumbnail,
  EmptyState,
} from "@shopify/polaris";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  console.log("[loader:app.orders] START");
  try {
    const { session } = await authenticate.admin(request);
    console.log("[loader:app.orders] Authenticated shop:", session.shop);

    console.log("[loader:app.orders] Fetching orders from Firestore");
    const orders = await getOrdersByShop(session.shop, 100);
    console.log(`[loader:app.orders] Fetched ${orders.length} orders`);

    return { orders };
  } catch (err: unknown) {
    if (err instanceof Response) throw err;
    console.error("[loader:app.orders] FAILED:", err);
    throw err;
  }
};

function formatDate(ts: { _seconds: number } | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts._seconds * 1000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function OrdersPage() {
  const { orders } = useLoaderData<typeof loader>();

  return (
    <Page title="Customized Orders">
      <BlockStack gap="400">
        <Banner tone="info">
          Shows orders that include at least one customized product. Click{" "}
          <strong>Design PNG</strong> to download the high-resolution
          print-ready file. Click <strong>Raw Image</strong> to download the
          original image uploaded by the customer.
        </Banner>

        <Card padding="0">
          {orders.length === 0 ? (
            <EmptyState
              heading="No customized orders yet"
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <Text as="p" tone="subdued">
                Customized orders will appear here once customers start
                personalizing products using the canvas widget.
              </Text>
            </EmptyState>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #e1e3e5" }}>
                    {["Order", "Date", "Customer", "Product", "Customization", "Preview", "Downloads"].map((h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: "left",
                          padding: "0.75rem 1rem",
                          whiteSpace: "nowrap",
                          fontSize: "0.8125rem",
                          fontWeight: 600,
                          color: "#6d7175",
                          background: "#f6f6f7",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orders.flatMap((order) =>
                    order.customizations.map((c, ci) => (
                      <tr
                        key={`${order.id}-${ci}`}
                        style={{ borderBottom: "1px solid #f1f2f3" }}
                      >
                        <td style={{ padding: "0.75rem 1rem", whiteSpace: "nowrap" }}>
                          <Text as="span" fontWeight="semibold">
                            #{order.shopifyOrderNumber}
                          </Text>
                        </td>
                        <td style={{ padding: "0.75rem 1rem", whiteSpace: "nowrap" }}>
                          <Text as="span" tone="subdued">
                            {formatDate(order.createdAt as unknown as { _seconds: number })}
                          </Text>
                        </td>
                        <td style={{ padding: "0.75rem 1rem" }}>
                          <BlockStack gap="0">
                            <Text as="p">{order.customerName || "—"}</Text>
                            <Text as="p" tone="subdued">{order.customerEmail}</Text>
                          </BlockStack>
                        </td>
                        <td style={{ padding: "0.75rem 1rem" }}>
                          <BlockStack gap="0">
                            <Text as="p">{c.productTitle}</Text>
                            {c.variantTitle && (
                              <Text as="p" tone="subdued">{c.variantTitle}</Text>
                            )}
                          </BlockStack>
                        </td>
                        <td style={{ padding: "0.75rem 1rem" }}>
                          <BlockStack gap="0">
                            {c.customText && (
                              <Text as="p">
                                <strong>Text:</strong> {c.customText}
                              </Text>
                            )}
                            {c.fontName && (
                              <Text as="p" tone="subdued">
                                <strong>Font:</strong> {c.fontName}
                              </Text>
                            )}
                            {!c.customText && !c.fontName && (
                              <Badge>Image only</Badge>
                            )}
                          </BlockStack>
                        </td>
                        <td style={{ padding: "0.75rem 1rem" }}>
                          {c.designImageUrl ? (
                            <a href={c.designImageUrl} target="_blank" rel="noopener noreferrer">
                              <Thumbnail
                                source={c.designImageUrl}
                                alt="Design preview"
                                size="small"
                              />
                            </a>
                          ) : (
                            <Text as="span" tone="subdued">—</Text>
                          )}
                        </td>
                        <td style={{ padding: "0.75rem 1rem" }}>
                          <InlineStack gap="200">
                            {c.rawImageUrl && (
                              <Button
                                url={c.rawImageUrl}
                                external
                                variant="plain"
                                size="slim"
                              >
                                Raw Image
                              </Button>
                            )}
                            {c.designImageUrl && (
                              <Button
                                url={c.designImageUrl}
                                external
                                variant="primary"
                                size="slim"
                              >
                                Design PNG
                              </Button>
                            )}
                          </InlineStack>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </BlockStack>
    </Page>
  );
}
