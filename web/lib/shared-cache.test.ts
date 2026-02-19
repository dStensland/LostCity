import { describe, expect, it } from "vitest";
import { getOrSetSharedCacheJson } from "@/lib/shared-cache";

function uniqueNamespace(prefix: string): string {
  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

describe("shared cache getOrSet", () => {
  it("coalesces concurrent cache misses", async () => {
    const namespace = uniqueNamespace("shared-cache-dedupe");
    const key = "same-key";
    let loaderCalls = 0;

    const loader = async () => {
      loaderCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return { ok: true, value: 42 };
    };

    const [first, second, third] = await Promise.all([
      getOrSetSharedCacheJson(namespace, key, 5_000, loader),
      getOrSetSharedCacheJson(namespace, key, 5_000, loader),
      getOrSetSharedCacheJson(namespace, key, 5_000, loader),
    ]);

    expect(loaderCalls).toBe(1);
    expect(first).toEqual({ ok: true, value: 42 });
    expect(second).toEqual(first);
    expect(third).toEqual(first);
  });

  it("serves from cache after initial load", async () => {
    const namespace = uniqueNamespace("shared-cache-hit");
    const key = "warm-key";
    let loaderCalls = 0;

    const first = await getOrSetSharedCacheJson(namespace, key, 5_000, async () => {
      loaderCalls += 1;
      return { hit: "cold" };
    });

    const second = await getOrSetSharedCacheJson(namespace, key, 5_000, async () => {
      loaderCalls += 1;
      return { hit: "warm" };
    });

    expect(loaderCalls).toBe(1);
    expect(first).toEqual({ hit: "cold" });
    expect(second).toEqual({ hit: "cold" });
  });
});
