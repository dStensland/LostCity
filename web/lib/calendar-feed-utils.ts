import crypto from "crypto";

/**
 * Generate a secure feed token for calendar subscriptions
 * The token is deterministic based on user ID and a server-side secret
 */
export function generateFeedToken(userId: string): string {
  const secret = process.env.CALENDAR_FEED_SECRET || "default-dev-secret";
  return crypto
    .createHmac("sha256", secret)
    .update(userId)
    .digest("hex")
    .slice(0, 32);
}
