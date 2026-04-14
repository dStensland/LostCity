import { describe, it, expect } from "vitest";
import { annotate } from "@/lib/search/understanding/annotate";

const ctx = { portal_id: "test", portal_slug: "atlanta" };

describe("annotate", () => {
  it("preserves raw query", async () => {
    const q = await annotate("Jazz Brunch!", ctx);
    expect(q.raw).toBe("Jazz Brunch!");
  });

  it("normalizes in the normalized field", async () => {
    const q = await annotate("  JAZZ  ", ctx);
    expect(q.normalized).toBe("JAZZ");
  });

  it("produces tokens", async () => {
    const q = await annotate("jazz brunch", ctx);
    expect(q.tokens).toHaveLength(2);
  });

  it("classifies intent", async () => {
    const q = await annotate("jazz", ctx);
    expect(q.intent.type).toBeDefined();
  });

  it("produces stable fingerprint", async () => {
    const a = await annotate("jazz brunch", ctx);
    const b = await annotate("jazz brunch", ctx);
    expect(a.fingerprint).toBe(b.fingerprint);
  });

  it("different queries produce different fingerprints", async () => {
    const a = await annotate("jazz", ctx);
    const b = await annotate("comedy", ctx);
    expect(a.fingerprint).not.toBe(b.fingerprint);
  });

  it("returned object is deeply frozen", async () => {
    const q = await annotate("jazz brunch", ctx);
    expect(Object.isFrozen(q)).toBe(true);
    // Verify inner arrays and objects are also frozen
    expect(Object.isFrozen(q.tokens)).toBe(true);
    expect(Object.isFrozen(q.entities)).toBe(true);
    expect(Object.isFrozen(q.spelling)).toBe(true);
    expect(Object.isFrozen(q.synonyms)).toBe(true);
    expect(Object.isFrozen(q.structured_filters)).toBe(true);
    expect(Object.isFrozen(q.intent)).toBe(true);
    // If tokens has any elements, the individual Token objects should be frozen
    if (q.tokens.length > 0) {
      expect(Object.isFrozen(q.tokens[0])).toBe(true);
    }
  });

  it("mutation attempts throw in strict mode", async () => {
    const q = await annotate("test", ctx);
    expect(() => {
      // @ts-expect-error — raw is readonly at the type level, frozen at runtime
      q.raw = "mutated";
    }).toThrow();
  });

  it("NEVER strips the user query (regression for old intent classifier bug)", async () => {
    // The old unified-search.ts silently stripped "jazz" and substituted
    // category=music. This test guards against ever doing that again.
    const q = await annotate("jazz", ctx);
    expect(q.raw).toBe("jazz");
    expect(q.normalized).toBe("jazz");
    expect(q.structured_filters.categories).toBeUndefined();
  });

  it("handles portal_slug in fingerprint", async () => {
    const a = await annotate("jazz", { portal_id: "p1", portal_slug: "atlanta" });
    const b = await annotate("jazz", { portal_id: "p1", portal_slug: "arts" });
    expect(a.fingerprint).not.toBe(b.fingerprint);
  });
});
