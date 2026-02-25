import crypto from "crypto";

/**
 * Generate a per-user secret for calendar feed tokens.
 */
export function generateFeedUserSecret(): string {
  return crypto.randomBytes(24).toString("hex");
}

/**
 * Generate a secure feed token for calendar subscriptions.
 * The token is deterministic for a given user + user secret pair.
 */
export function generateFeedToken(userId: string, userSecret: string): string {
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
    .update(`${userId}:${userSecret}`)
    .digest("hex")
    .slice(0, 32);
}

/**
 * Legacy token generator (pre-user-secret migration).
 * Kept temporarily for backward compatibility in environments that haven't migrated.
 */
export function generateLegacyFeedToken(userId: string): string {
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
