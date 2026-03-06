import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { getOrdersByShop } from "../models/order.server";

export const loader = async ({ request }) => {
  console.log("[loader:app.orders] START");

  try {
    const { session } = await authenticate.admin(request);

    console.log("[loader:app.orders] Authenticated shop:", session.shop);
    console.log("[loader:app.orders] Fetching orders from Firestore");
    const orders = await getOrdersByShop(session.shop, 100);

    console.log(`[loader:app.orders] Fetched ${orders.length} orders`);

    return { orders };
  } catch (err) {
    if (err instanceof Response) throw err;
    console.error("[loader:app.orders] FAILED:", err);
    throw err;
  }
};

function formatDate(ts) {
  if (!ts) return "—";

  return new Date(ts._seconds * 1000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function OrdersPage() {
  const { orders } = useLoaderData();

  return (
    <s-page heading="Customized Orders">
      {/* Info banner */}
      <s-section padding="none">
        <s-banner tone="info">
          Shows orders that include at least one customized product. Click
          &ldquo;Design PNG&rdquo; to download the high-resolution print-ready
          file. Click &ldquo;Raw Image&rdquo; to download the original image
          uploaded by the customer.
        </s-banner>
      </s-section>

      {/* Orders table */}
      <s-section>
        {orders.length === 0 ? (
          <div style={{ textAlign: "center", padding: "2rem 0" }}>
            <s-stack gap="base">
              <s-heading>No customized orders yet</s-heading>
              <s-paragraph tone="neutral">
                Customized orders will appear here once customers start
                personalizing products using the canvas widget.
              </s-paragraph>
            </s-stack>
          </div>
        ) : (
          <s-table>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {[
                    "Order",
                    "Date",
                    "Customer",
                    "Product",
                    "Customization",
                    "Preview",
                    "Downloads",
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        padding: "0.5rem 1rem",
                        whiteSpace: "nowrap",
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
                    <tr key={`${order.id}-${ci}`}>
                      {/* Order number */}
                      <td
                        style={{ padding: "0.5rem 1rem", whiteSpace: "nowrap" }}
                      >
                        <s-text font-weight="semibold">
                          #{order.shopifyOrderNumber}
                        </s-text>
                      </td>
                      {/* Date */}
                      <td
                        style={{ padding: "0.5rem 1rem", whiteSpace: "nowrap" }}
                      >
                        {formatDate(order.createdAt)}
                      </td>
                      {/* Customer */}
                      <td style={{ padding: "0.5rem 1rem" }}>
                        <s-stack gap="none">
                          <s-text>{order.customerName || "—"}</s-text>
                          <s-text tone="neutral">{order.customerEmail}</s-text>
                        </s-stack>
                      </td>
                      {/* Product */}
                      <td style={{ padding: "0.5rem 1rem" }}>
                        <s-stack gap="none">
                          <s-text>{c.productTitle}</s-text>
                          {c.variantTitle && (
                            <s-text tone="neutral">{c.variantTitle}</s-text>
                          )}
                        </s-stack>
                      </td>
                      {/* Customization details */}
                      <td style={{ padding: "0.5rem 1rem" }}>
                        <s-stack gap="none">
                          {c.customText && (
                            <s-text>
                              <strong>Text:</strong> {c.customText}
                            </s-text>
                          )}
                          {c.fontName && (
                            <s-text>
                              <strong>Font:</strong> {c.fontName}
                            </s-text>
                          )}
                        </s-stack>
                      </td>
                      {/* Preview thumbnail */}
                      <td style={{ padding: "0.5rem 1rem" }}>
                        {c.designImageUrl ? (
                          <a
                            href={c.designImageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <s-thumbnail
                              src={c.designImageUrl}
                              alt="Design preview"
                              size="small"
                            />
                          </a>
                        ) : (
                          <s-text tone="neutral">No preview</s-text>
                        )}
                      </td>
                      {/* Downloads */}
                      <td style={{ padding: "0.5rem 1rem" }}>
                        <s-stack direction="inline" gap="small">
                          {c.rawImageUrl && (
                            <a
                              href={c.rawImageUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <s-button variant="tertiary">Raw Image</s-button>
                            </a>
                          )}
                          {c.designImageUrl && (
                            <a
                              href={c.designImageUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <s-button variant="primary">Design PNG</s-button>
                            </a>
                          )}
                        </s-stack>
                      </td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </s-table>
        )}
      </s-section>
    </s-page>
  );
}
