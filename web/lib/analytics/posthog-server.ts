import { PostHog } from "posthog-node";

const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

let _client: PostHog | null | undefined;

/**
 * Lazy-initialized PostHog server client.
 * Returns null when POSTHOG_API_KEY is not configured (safe for dev/test).
 */
export function getPostHogServer(): PostHog | null {
  if (_client !== undefined) return _client;

  const apiKey = process.env.POSTHOG_API_KEY;
  if (!apiKey) {
    _client = null;
    return null;
  }

  _client = new PostHog(apiKey, {
    host: POSTHOG_HOST,
    flushAt: 20,
    flushInterval: 10000,
  });

  return _client;
}
