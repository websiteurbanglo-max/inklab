import { getDb } from "../firebase.server";
import { FieldValue } from "firebase-admin/firestore";

export interface Shop {
  domain: string;
  installedAt: FirebaseFirestore.Timestamp;
  isActive: boolean;
  planName?: string;
}

const col = () => getDb().collection("shops");

export async function upsertShop(domain: string): Promise<void> {
  console.log(`[shop] upsertShop domain=${domain}`);
  try {
    await col().doc(domain).set(
      {
        domain,
        isActive: true,
        installedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    console.log(`[shop] upsertShop OK domain=${domain}`);
  } catch (err) {
    console.error(`[shop] upsertShop FAILED domain=${domain}:`, err);
    throw err;
  }
}

export async function deactivateShop(domain: string): Promise<void> {
  console.log(`[shop] deactivateShop domain=${domain}`);
  try {
    await col().doc(domain).set({ isActive: false }, { merge: true });
    console.log(`[shop] deactivateShop OK domain=${domain}`);
  } catch (err) {
    console.error(`[shop] deactivateShop FAILED domain=${domain}:`, err);
    throw err;
  }
}

export async function getAllShops(): Promise<Shop[]> {
  const snapshot = await col().orderBy("installedAt", "desc").get();
  return snapshot.docs.map((doc) => doc.data() as Shop);
}
