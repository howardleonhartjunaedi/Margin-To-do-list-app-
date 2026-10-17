import { body, route } from "@/server/http";
import { removePushSubscription, savePushSubscription } from "@/server/notify";
import { pushSubscriptionSchema } from "@/lib/validation";

/** The VAPID public key the browser needs to subscribe. */
export const GET = route(async () => ({ publicKey: process.env.VAPID_PUBLIC_KEY ?? null }));

export const POST = route(async (req, userId) => {
  await savePushSubscription(userId, pushSubscriptionSchema.parse(await body(req)), req.headers.get("user-agent"));
  return { ok: true };
});

export const DELETE = route(async (req, userId) => {
  const { endpoint } = pushSubscriptionSchema.pick({ endpoint: true }).parse(await body(req));
  await removePushSubscription(userId, endpoint);
  return { ok: true };
});
