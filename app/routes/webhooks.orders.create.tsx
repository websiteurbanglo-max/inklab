import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { createOrder } from "../models/order.server";
import type { OrderCustomization } from "../models/order.server";

interface LineItemProperty {
  name: string;
  value: string;
}

interface LineItem {
  id: number;
  title: string;
  variant_title?: string;
  quantity: number;
  properties?: LineItemProperty[];
}

interface ShopifyOrder {
  id: number;
  order_number: number;
  email: string;
  contact_email: string;
  customer?: { first_name?: string; last_name?: string; email?: string };
  total_price: string;
  currency: string;
  line_items: LineItem[];
}

const CUSTOMIZATION_PROPERTIES = new Set([
  "_custom_text",
  "_custom_font",
  "_raw_image_url",
  "_design_image_url",
  "_canvas_json",
]);

function getProperty(properties: LineItemProperty[], name: string): string {
  return properties.find((p) => p.name === name)?.value ?? "";
}

function hasCustomization(properties: LineItemProperty[]): boolean {
  return properties.some((p) => CUSTOMIZATION_PROPERTIES.has(p.name));
}

export const action = async ({ request }: ActionFunctionArgs) => {
  let shop = "(unknown)";
  try {
    const result = await authenticate.webhook(request);
    shop = result.shop;
    const { topic, payload } = result;

  console.log(`[webhook:orders/create] START topic=${topic} shop=${shop}`);

  if (topic !== "ORDERS_CREATE") {
    console.log(`[webhook:orders/create] Ignoring unexpected topic=${topic}`);
    return new Response();
  }

  const order = payload as ShopifyOrder;

  // Find line items that have our custom properties
  const customizations: OrderCustomization[] = [];

  for (const item of order.line_items) {
    const props = item.properties ?? [];
    if (!hasCustomization(props)) continue;

    customizations.push({
      lineItemId: String(item.id),
      productTitle: item.title,
      variantTitle: item.variant_title ?? undefined,
      quantity: item.quantity,
      customText: getProperty(props, "_custom_text"),
      fontName: getProperty(props, "_custom_font"),
      rawImageUrl: getProperty(props, "_raw_image_url"),
      designImageUrl: getProperty(props, "_design_image_url"),
      canvasJson: getProperty(props, "_canvas_json"),
    });
  }

  // Only create a DB record if at least one customized item exists
  if (customizations.length === 0) {
    return new Response();
  }

  const customerName =
    [order.customer?.first_name, order.customer?.last_name]
      .filter(Boolean)
      .join(" ") || "Guest";

  const customerEmail =
    order.customer?.email || order.contact_email || order.email || "";

  try {
    await createOrder({
      shopDomain: shop,
      shopifyOrderId: String(order.id),
      shopifyOrderNumber: order.order_number,
      customerName,
      customerEmail,
      totalPrice: order.total_price,
      currency: order.currency,
      customizations,
    });

    console.log(
      `[webhook:orders/create] Saved order #${order.order_number} for ${shop} (${customizations.length} customized item(s))`
    );
  } catch (err: unknown) {
    // Log full error details — still return 200 to stop Shopify retrying forever
    const code = (err as { code?: string })?.code;
    if (code === "failed-precondition") {
      console.error(
        `[webhook:orders/create] Firestore composite index MISSING for (shopDomain + createdAt). ` +
        `Create it at: https://console.firebase.google.com/project/${process.env.FIREBASE_PROJECT_ID}/firestore/indexes`,
        err
      );
    } else {
      console.error("[webhook:orders/create] FAILED to save order to Firestore:", err);
    }
    // Return 200 anyway to prevent Shopify from retrying indefinitely
  }

  return new Response();
  } catch (outerErr) {
    // authenticate.webhook() itself threw — likely an HMAC verification failure
    console.error(`[webhook:orders/create] authenticate.webhook FAILED shop=${shop}:`, outerErr);
    return new Response(null, { status: 401 });
  }
};
