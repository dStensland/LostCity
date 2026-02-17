import { createServiceClient } from "@/lib/supabase/service";
import { logger } from "@/lib/logger";

type PushPayload = {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  tag?: string;
};

/**
 * Send a push notification to a specific user.
 * Gracefully handles missing web-push module or VAPID keys.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  // Check if VAPID keys are configured
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT;

  if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
    // Push not configured — silently skip
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let webpush: any;

  try {
    // Dynamic import - web-push module may not be installed
    webpush = await import("web-push" as string);
    webpush = webpush.default || webpush;
  } catch {
    // web-push not installed — silently skip
    logger.warn("web-push module not available", { context: "push-notifications" });
    return;
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  const serviceClient = createServiceClient();

  // Get all subscriptions for this user
  const { data: subscriptions, error } = await serviceClient
    .from("push_subscriptions")
    .select("id, endpoint, auth_key, p256dh_key")
    .eq("user_id", userId);

  if (error || !subscriptions || subscriptions.length === 0) {
    return;
  }

  type SubRow = { id: string; endpoint: string; auth_key: string; p256dh_key: string };
  const subs = subscriptions as unknown as SubRow[];

  const payloadStr = JSON.stringify(payload);

  // Send to all subscriptions
  const results = await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush!.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              auth: sub.auth_key,
              p256dh: sub.p256dh_key,
            },
          },
          payloadStr
        );
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        // 404 or 410 means subscription is expired — clean up
        if (statusCode === 404 || statusCode === 410) {
          await serviceClient
            .from("push_subscriptions")
            .delete()
            .eq("id", sub.id);
        }
        throw err;
      }
    })
  );

  const failed = results.filter((r) => r.status === "rejected").length;
  if (failed > 0) {
    logger.warn(`Push delivery: ${failed}/${subs.length} failed`, { userId });
  }
}
