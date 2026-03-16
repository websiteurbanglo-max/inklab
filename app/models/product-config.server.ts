import { getDb } from "../firebase.server";

export interface ProductConfig {
  enabled: boolean;
  canvasSize?: number;          // optional override, default 500
  allowedFontUrls?: string[];   // empty = use all shop fonts
}

const DEFAULT_CONFIG: ProductConfig = {
  enabled: true,
  canvasSize: 500,
  allowedFontUrls: [],
};

/**
 * Reads per-product config from Firestore.
 * Path: shops/{shopDomain}/products/{productId}
 * Returns default config if document doesn't exist.
 */
export async function getProductConfig(
  shopDomain: string,
  productId: string
): Promise<ProductConfig> {
  try {
    const doc = await getDb()
      .collection("shops")
      .doc(shopDomain)
      .collection("products")
      .doc(productId)
      .get();

    if (!doc.exists) return DEFAULT_CONFIG;
    return { ...DEFAULT_CONFIG, ...(doc.data() as Partial<ProductConfig>) };
  } catch (err) {
    console.error(`[product-config] getProductConfig failed shop=${shopDomain} product=${productId}:`, err);
    return DEFAULT_CONFIG;
  }
}
