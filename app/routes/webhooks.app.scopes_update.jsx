import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }) => {
  let shop = "(unknown)";

  try {
    const result = await authenticate.webhook(request);

    shop = result.shop;
    const { payload, session, topic } = result;

    console.log(
      `[webhook:app/scopes_update] START topic=${topic} shop=${shop}`,
    );
    const current = payload.current;

    console.log(`[webhook:app/scopes_update] New scopes: ${current.join(",")}`);

    if (session) {
      console.log(
        `[webhook:app/scopes_update] Updating session scope in Prisma sessionId=${session.id}`,
      );
      await db.session.update({
        where: { id: session.id },
        data: { scope: current.toString() },
      });
      console.log(`[webhook:app/scopes_update] Prisma session updated OK`);
    } else {
      console.warn(
        `[webhook:app/scopes_update] No session found — scope not persisted`,
      );
    }

    console.log(`[webhook:app/scopes_update] DONE shop=${shop}`);

    return new Response();
  } catch (err) {
    console.error(`[webhook:app/scopes_update] FAILED shop=${shop}`, err);

    return new Response(null, { status: 500 });
  }
};
