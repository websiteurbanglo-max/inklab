import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "../firebase.server";

const col = () => getDb().collection("shops");

export async function upsertShop(domain) {
  console.log(`[shop] upsertShop domain=${domain}`);

  try {
    await col().doc(domain).set(
      {
        domain,
        isActive: true,
        installedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    console.log(`[shop] upsertShop OK domain=${domain}`);
  } catch (err) {
    console.error(`[shop] upsertShop FAILED domain=${domain}:`, err);
    throw err;
  }
}

export async function deactivateShop(domain) {
  console.log(`[shop] deactivateShop domain=${domain}`);

  try {
    await col().doc(domain).set({ isActive: false }, { merge: true });
    console.log(`[shop] deactivateShop OK domain=${domain}`);
  } catch (err) {
    console.error(`[shop] deactivateShop FAILED domain=${domain}:`, err);
    throw err;
  }
}

export async function getAllShops() {
  const snapshot = await col().orderBy("installedAt", "desc").get();

  return snapshot.docs.map((doc) => doc.data());
}
