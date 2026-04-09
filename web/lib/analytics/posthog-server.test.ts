import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("posthog-server", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns null client when API key is not set", async () => {
    delete process.env.POSTHOG_API_KEY;
    const { getPostHogServer } = await import("./posthog-server");
    expect(getPostHogServer()).toBeNull();
  });

  it("returns a client when API key is set", async () => {
    process.env.POSTHOG_API_KEY = "phc_test_key";
    process.env.NEXT_PUBLIC_POSTHOG_HOST = "https://us.i.posthog.com";
    const { getPostHogServer } = await import("./posthog-server");
    const client = getPostHogServer();
    expect(client).not.toBeNull();
  });

  it("returns the same instance on repeated calls", async () => {
    process.env.POSTHOG_API_KEY = "phc_test_key";
    const { getPostHogServer } = await import("./posthog-server");
    const a = getPostHogServer();
    const b = getPostHogServer();
    expect(a).toBe(b);
  });
});
