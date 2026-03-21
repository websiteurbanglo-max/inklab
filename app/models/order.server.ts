import { getDb } from "../firebase.server";
import type { Timestamp } from "firebase-admin/firestore";
import { FieldValue, WriteBatch } from "firebase-admin/firestore";

export interface OrderCustomization {
  lineItemId: string;
  productTitle: string;
  variantTitle?: string;
  quantity: number;
  customText: string;
  fontName: string;
  rawImageUrl: string;
  designImageUrl: string;
  canvasJson: string;
  printSize?: string;  // absent on orders created before this field was added
}

export interface Order {
  id: string;
  shopDomain: string;
  shopifyOrderId: string;
  shopifyOrderNumber: number;
  customerName: string;
  customerEmail: string;
  totalPrice: string;
  currency: string;
  customizations: OrderCustomization[];
  createdAt: Timestamp;
}

export interface OrderFilters {
  shopDomain?: string;
  limit?: number;
  startAfterDoc?: FirebaseFirestore.DocumentSnapshot;
}

const col = () => getDb().collection("orders");

export async function createOrder(
  data: Omit<Order, "id" | "createdAt">
): Promise<Order> {
  console.log(`[order] createOrder shopDomain=${data.shopDomain} orderId=${data.shopifyOrderId} orderNum=${data.shopifyOrderNumber}`);
  const docRef = col().doc(data.shopifyOrderId);

  const orderData = {
    ...data,
    createdAt: FieldValue.serverTimestamp(),
  };

  await docRef.set(orderData);
  console.log(`[order] createOrder OK orderId=${data.shopifyOrderId}`);

  return { id: data.shopifyOrderId, ...orderData } as unknown as Order;
}

export async function getOrdersByShop(
  shopDomain: string,
  limit = 50
): Promise<Order[]> {
  console.log(`[order] getOrdersByShop shopDomain=${shopDomain} limit=${limit}`);
  try {
    const snapshot = await col()
      .where("shopDomain", "==", shopDomain)
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();
    console.log(`[order] getOrdersByShop returned ${snapshot.docs.length} docs`);
    return snapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() } as Order)
    );
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "failed-precondition") {
      console.error(
        `[order] getOrdersByShop FAILED — Firestore composite index MISSING. ` +
        `Create index on collection "orders" fields (shopDomain ASC, createdAt DESC) at: ` +
        `https://console.firebase.google.com/project/${process.env.FIREBASE_PROJECT_ID}/firestore/indexes`,
        err
      );
    } else {
      console.error(`[order] getOrdersByShop FAILED shopDomain=${shopDomain}:`, err);
    }
    throw err;
  }
}

export async function getAllOrders(limit = 100): Promise<Order[]> {
  const snapshot = await col()
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();

  return snapshot.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() } as Order)
  );
}

export async function searchOrders(opts: {
  shopDomain?: string;
  search?: string;
  limit?: number;
}): Promise<Order[]> {
  let query = col().orderBy("createdAt", "desc") as FirebaseFirestore.Query;

  if (opts.shopDomain) {
    query = query.where("shopDomain", "==", opts.shopDomain);
  }

  const snapshot = await query.limit(opts.limit ?? 100).get();

  let results = snapshot.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() } as Order)
  );

  // Client-side text filter (Firestore doesn't support full-text search)
  if (opts.search) {
    const term = opts.search.toLowerCase();
    results = results.filter(
      (o) =>
        o.customerName?.toLowerCase().includes(term) ||
        o.customerEmail?.toLowerCase().includes(term) ||
        String(o.shopifyOrderNumber).includes(term)
    );
  }

  return results;
}

// ─── Dashboard Sync ──────────────────────────────────────────────────────────

interface SyncToDashboardsInput {
  shopDomain: string;
  shopifyOrderId: string;
  shopifyOrderNumber: number;
  customerName: string;
  customerEmail: string;
  totalPrice: string;
  currency: string;
  customizations: OrderCustomization[];
}

/**
 * Derive variant group from print size in inches.
 * 2-4 → small, 5-7 → medium, 8-10 → large
 */
function deriveVariantGroup(sizeInInches: number): string {
  if (sizeInInches <= 4) return "small";
  if (sizeInInches <= 7) return "medium";
  return "large";
}

/**
 * Parse print size string to a number. Falls back to 4 if unparseable.
 */
function parsePrintSize(printSize?: string): number {
  if (!printSize) return 4;
  const n = parseInt(printSize, 10);
  return isNaN(n) || n < 1 ? 4 : n;
}

/**
 * Look up pricing rules from Firestore.
 * Tries shop-specific rules first, falls back to global rules.
 */
async function calculatePricing(
  db: FirebaseFirestore.Firestore,
  shopId: string,
  variantGroup: string,
  quantity: number
): Promise<{
  unitPrice: number;
  subtotal: number;
  total: number;
  appliedRuleId: string;
  ruleSource: "shop" | "global";
}> {
  // Try shop-specific rules first
  const shopRulesSnap = await db
    .collection("shops")
    .doc(shopId)
    .collection("pricing")
    .doc("rules")
    .collection("items")
    .where("variantGroup", "==", variantGroup)
    .where("isActive", "==", true)
    .get();

  let matchedRule = findMatchingRule(shopRulesSnap.docs, quantity);
  if (matchedRule) {
    const unitPrice = matchedRule.data().unitPrice as number;
    return {
      unitPrice,
      subtotal: unitPrice * quantity,
      total: unitPrice * quantity,
      appliedRuleId: matchedRule.id,
      ruleSource: "shop",
    };
  }

  // Fallback to global rules
  const globalRulesSnap = await db
    .collection("pricing")
    .doc("global")
    .collection("rules")
    .where("variantGroup", "==", variantGroup)
    .where("isActive", "==", true)
    .get();

  matchedRule = findMatchingRule(globalRulesSnap.docs, quantity);
  if (matchedRule) {
    const unitPrice = matchedRule.data().unitPrice as number;
    return {
      unitPrice,
      subtotal: unitPrice * quantity,
      total: unitPrice * quantity,
      appliedRuleId: matchedRule.id,
      ruleSource: "global",
    };
  }

  // No matching rule — use 0 pricing (superadmin can set it later)
  console.warn(
    `[order:sync] No pricing rule found for shopId=${shopId} variantGroup=${variantGroup} qty=${quantity}`
  );
  return {
    unitPrice: 0,
    subtotal: 0,
    total: 0,
    appliedRuleId: "none",
    ruleSource: "global",
  };
}

function findMatchingRule(
  docs: FirebaseFirestore.QueryDocumentSnapshot[],
  quantity: number
): FirebaseFirestore.QueryDocumentSnapshot | null {
  for (const doc of docs) {
    const data = doc.data();
    const minQty = (data.minQty as number) ?? 1;
    const maxQty = (data.maxQty as number) ?? Infinity;
    if (quantity >= minQty && quantity <= maxQty) {
      return doc;
    }
  }
  return null;
}

/**
 * Sync a Shopify order to both dashboard Firestore collections:
 * - shops/{shopId}/orders/{orderId}  (shop dashboard)
 * - orders_global/{orderId}          (superadmin dashboard)
 * - shops/{shopId}/orders/{orderId}/events/  (ORDER_CREATED event)
 *
 * Each customized line item becomes a separate dashboard order.
 */
export async function syncToDashboards(
  input: SyncToDashboardsInput
): Promise<void> {
  const db = getDb();

  // Step 1: Look up shopId from shopDomain
  const shopsSnap = await db
    .collection("shops")
    .where("domain", "==", input.shopDomain)
    .limit(1)
    .get();

  if (shopsSnap.empty) {
    console.warn(
      `[order:sync] No shop found for domain=${input.shopDomain}. Skipping dashboard sync.`
    );
    return;
  }

  const shopDoc = shopsSnap.docs[0];
  const shopId = shopDoc.id;
  const shopData = shopDoc.data();
  const shopDisplayName = (shopData.displayName as string) || shopId;
  const shopType = (shopData.shopType as string) || "shopify";

  console.log(
    `[order:sync] Matched domain=${input.shopDomain} → shopId=${shopId} (${shopDisplayName})`
  );

  // Step 2: Get default pipeline ID from platform config
  let defaultPipelineId = "default";
  try {
    const configDoc = await db
      .collection("platform_config")
      .doc("settings")
      .get();
    if (configDoc.exists && configDoc.data()?.defaultPipelineId) {
      defaultPipelineId = configDoc.data()!.defaultPipelineId as string;
    }
  } catch {
    // Use default
  }

  const now = FieldValue.serverTimestamp();

  // Step 3: Create a dashboard order for each customized line item
  const batch: WriteBatch = db.batch();
  let itemCount = 0;

  for (const item of input.customizations) {
    const sizeInInches = parsePrintSize(item.printSize);
    const variantGroup = deriveVariantGroup(sizeInInches);

    // Calculate pricing from Firestore rules
    const pricing = await calculatePricing(
      db,
      shopId,
      variantGroup,
      item.quantity
    );

    // Deterministic orderId for idempotency: shopifyOrderId-lineItemId
    const orderId = `${input.shopifyOrderId}-${item.lineItemId}`;

    // Shop-level order document: shops/{shopId}/orders/{orderId}
    const shopOrderRef = db
      .collection("shops")
      .doc(shopId)
      .collection("orders")
      .doc(orderId);

    batch.set(shopOrderRef, {
      orderId,
      shopId,
      source: "shopify",
      shopifyOrderId: input.shopifyOrderId,
      shopifyOrderNumber: input.shopifyOrderNumber,
      shopifyLineItemId: item.lineItemId,
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      productTitle: item.productTitle,
      sizeInInches,
      variantGroup,
      quantity: item.quantity,
      designAssets: {
        rawImageUrl: item.rawImageUrl || "",
        designImageUrl: item.designImageUrl || "",
        canvasJson: item.canvasJson || null,
        thumbnailUrl: null,
      },
      billingSnapshot: {
        unitPrice: pricing.unitPrice,
        subtotal: pricing.subtotal,
        total: pricing.total,
        currency: "INR",
        appliedRuleId: pricing.appliedRuleId,
        ruleSource: pricing.ruleSource,
        calculatedAt: now,
      },
      pipelineId: defaultPipelineId,
      currentStageKey: "received",
      currentStageUpdatedAt: now,
      notes: "",
      createdBy: "shopify-webhook",
      createdAt: now,
      updatedAt: now,
    });

    // ORDER_CREATED event: shops/{shopId}/orders/{orderId}/events/{auto}
    const eventRef = shopOrderRef.collection("events").doc();
    batch.set(eventRef, {
      eventId: eventRef.id,
      eventType: "ORDER_CREATED",
      fromStageKey: null,
      toStageKey: "received",
      performedBy: "shopify-webhook",
      performedByEmail: "",
      performedByRole: "system",
      note: `Order created from Shopify #${input.shopifyOrderNumber}`,
      timestamp: now,
    });

    // Global projection: orders_global/{orderId}
    const globalRef = db.collection("orders_global").doc(orderId);
    batch.set(globalRef, {
      orderId,
      shopId,
      shopDisplayName,
      shopType,
      source: "shopify",
      variantGroup,
      sizeInInches,
      quantity: item.quantity,
      productTitle: item.productTitle,
      currentStageKey: "received",
      currentStageUpdatedAt: now,
      pipelineId: defaultPipelineId,
      billingTotal: pricing.total,
      currency: "INR",
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      designThumbnailUrl: item.designImageUrl || "",
      createdAt: now,
      updatedAt: now,
    });

    itemCount++;
  }

  await batch.commit();
  console.log(
    `[order:sync] Synced ${itemCount} order(s) to dashboards for shop=${shopId} shopifyOrder=#${input.shopifyOrderNumber}`
  );
}
