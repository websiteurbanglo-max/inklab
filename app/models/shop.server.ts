import { getDb } from "../firebase.server";
import { FieldValue } from "firebase-admin/firestore";

export interface Shop {
  domain: string;
  shopType: "shopify" | "studio";
  displayName: string;
  slug: string;
  isActive: boolean;
  installedAt: FirebaseFirestore.Timestamp;
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
  planName?: string;
}

const col = () => getDb().collection("shops");

/**
 * Derive a human-readable display name from a myshopify.com domain.
 * "cool-tees.myshopify.com" → "Cool Tees"
 */
function displayNameFromDomain(domain: string): string {
  const slug = domain.replace(/\.myshopify\.com$/, "");
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export async function upsertShop(domain: string): Promise<void> {
  console.log(`[shop] upsertShop domain=${domain}`);
  try {
    const docRef = col().doc(domain);
    const existing = await docRef.get();
    const now = FieldValue.serverTimestamp();

    if (existing.exists) {
      // Shop already exists — just mark active + update timestamp
      await docRef.set(
        {
          isActive: true,
          updatedAt: now,
        },
        { merge: true }
      );
    } else {
      // First install — create full shop document for dashboards
      const slug = domain.replace(/\.myshopify\.com$/, "");
      await docRef.set({
        domain,
        shopType: "shopify",
        displayName: displayNameFromDomain(domain),
        slug,
        isActive: true,
        contact: {
          email: "",
          phone: "",
          address: "",
          city: "",
          state: "",
          pincode: "",
        },
        metadata: {
          description: "",
          logoUrl: "",
        },
        installedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }
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
