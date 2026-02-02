import crypto from "crypto";

/**
 * Generate a secure feed token for calendar subscriptions
 * The token is deterministic based on user ID and a server-side secret
 */
export function generateFeedToken(userId: string): string {
  const secret = process.env.CALENDAR_FEED_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("CALENDAR_FEED_SECRET environment variable is required in production");
    }
    // Only allow fallback in development
    console.warn("CALENDAR_FEED_SECRET not set, using insecure default for development");
  }
  const effectiveSecret = secret || "dev-only-insecure-secret";

  return crypto
    .createHmac("sha256", effectiveSecret)
    .update(userId)
    .digest("hex")
    .slice(0, 32);
}
