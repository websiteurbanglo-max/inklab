import { authenticate } from "../shopify.server";
import db from "../db.server";
import { deactivateShop } from "../models/shop.server";

export const action = async ({ request }) => {
  let shop = "(unknown)";

  try {
    const result = await authenticate.webhook(request);

    shop = result.shop;
    const { session, topic } = result;

    console.log(`[webhook:app/uninstalled] START topic=${topic} shop=${shop}`);

    if (session) {
      console.log(
        `[webhook:app/uninstalled] Deleting Prisma sessions for shop=${shop}`,
      );
      await db.session.deleteMany({ where: { shop } });
      console.log(`[webhook:app/uninstalled] Prisma sessions deleted`);
    } else {
      console.log(
        `[webhook:app/uninstalled] No active session found — skipping session delete`,
      );
    }

    console.log(
      `[webhook:app/uninstalled] Deactivating shop in Firestore shop=${shop}`,
    );
    await deactivateShop(shop);
    console.log(`[webhook:app/uninstalled] DONE shop=${shop}`);

    return new Response();
  } catch (err) {
    console.error(`[webhook:app/uninstalled] FAILED shop=${shop}`, err);

    return new Response(null, { status: 500 });
  }
};
