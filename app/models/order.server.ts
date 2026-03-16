import { getDb } from "../firebase.server";
import type { Timestamp } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";

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
  printSize: string;
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
