import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "../firebase.server";

const col = () => getDb().collection("orders");

export async function createOrder(data) {
  console.log(
    `[order] createOrder shopDomain=${data.shopDomain} orderId=${data.shopifyOrderId} orderNum=${data.shopifyOrderNumber}`,
  );
  const docRef = col().doc(data.shopifyOrderId);
  const orderData = {
    ...data,
    createdAt: FieldValue.serverTimestamp(),
  };

  await docRef.set(orderData);
  console.log(`[order] createOrder OK orderId=${data.shopifyOrderId}`);

  return { id: data.shopifyOrderId, ...orderData };
}

export async function getOrdersByShop(shopDomain, limit = 50) {
  console.log(
    `[order] getOrdersByShop shopDomain=${shopDomain} limit=${limit}`,
  );

  try {
    const snapshot = await col()
      .where("shopDomain", "==", shopDomain)
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();

    console.log(
      `[order] getOrdersByShop returned ${snapshot.docs.length} docs`,
    );

    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    const code = err?.code;

    if (code === "failed-precondition") {
      console.error(
        `[order] getOrdersByShop FAILED — Firestore composite index MISSING. ` +
          `Create index on collection "orders" fields (shopDomain ASC, createdAt DESC) at: ` +
          `https://console.firebase.google.com/project/${process.env.FIREBASE_PROJECT_ID}/firestore/indexes`,
        err,
      );
    } else {
      console.error(
        `[order] getOrdersByShop FAILED shopDomain=${shopDomain}:`,
        err,
      );
    }

    throw err;
  }
}

export async function getAllOrders(limit = 100) {
  const snapshot = await col().orderBy("createdAt", "desc").limit(limit).get();

  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

export async function searchOrders(opts) {
  let query = col().orderBy("createdAt", "desc");

  if (opts.shopDomain) {
    query = query.where("shopDomain", "==", opts.shopDomain);
  }

  const snapshot = await query.limit(opts.limit ?? 100).get();
  let results = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  // Client-side text filter (Firestore doesn't support full-text search)
  if (opts.search) {
    const term = opts.search.toLowerCase();

    results = results.filter(
      (o) =>
        o.customerName?.toLowerCase().includes(term) ||
        o.customerEmail?.toLowerCase().includes(term) ||
        String(o.shopifyOrderNumber).includes(term),
    );
  }

  return results;
}
