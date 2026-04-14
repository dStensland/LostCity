import { describe, it, expect } from "vitest";
import { hashQuery, buildSearchEventRow } from "@/lib/search/observability";
import type { PresentedResults } from "@/lib/search/presenting/types";

describe("hashQuery", () => {
  it("produces stable hash for same inputs", () => {
    const salt = Buffer.from("0".repeat(64), "hex");
    const a = hashQuery("jazz", salt, "atlanta");
    const b = hashQuery("jazz", salt, "atlanta");
    expect(a.equals(b)).toBe(true);
  });

  it("produces different hashes for different queries", () => {
    const salt = Buffer.from("0".repeat(64), "hex");
    const a = hashQuery("jazz", salt, "atlanta");
    const b = hashQuery("comedy", salt, "atlanta");
    expect(a.equals(b)).toBe(false);
  });

  it("produces different hashes across portals", () => {
    const salt = Buffer.from("0".repeat(64), "hex");
    const a = hashQuery("jazz", salt, "atlanta");
    const b = hashQuery("jazz", salt, "arts");
    expect(a.equals(b)).toBe(false);
  });

  it("produces different hashes with different salts", () => {
    const salt1 = Buffer.from("0".repeat(64), "hex");
    const salt2 = Buffer.from("f".repeat(64), "hex");
    const a = hashQuery("jazz", salt1, "atlanta");
    const b = hashQuery("jazz", salt2, "atlanta");
    expect(a.equals(b)).toBe(false);
  });

  // Null bytes in the input must not crash createHash.update() and must
  // still produce a deterministic SHA-256 digest. Node's createHash accepts
  // strings with embedded \u0000 — this regression guard pins that.
  it("handles null-byte queries deterministically", () => {
    const salt = Buffer.from("0".repeat(64), "hex");
    const a = hashQuery("foo\u0000bar", salt, "atlanta");
    const b = hashQuery("foo\u0000bar", salt, "atlanta");
    const hex = a.toString("hex");
    expect(hex).toMatch(/^[0-9a-f]{64}$/);
    expect(a.equals(b)).toBe(true);
  });
});

describe("buildSearchEventRow", () => {
  const baseDiagnostics = {
    total_ms: 123,
    cache_hit: "miss" as const,
    degraded: false,
    retriever_ms: { fts: 50 },
    result_type_counts: { event: 5 },
  };

  const basePresented: PresentedResults = {
    topMatches: [],
    sections: [
      { type: "event", title: "Events", items: [], total: 5 },
    ],
    totals: { event: 5 },
    diagnostics: baseDiagnostics,
  };

  it("produces a valid row shape with no user_id", () => {
    const row = buildSearchEventRow({
      query: "jazz",
      portalSlug: "atlanta",
      segment: "anon",
      hadFilters: false,
      presented: basePresented,
      intentType: "find_event",
      salt: Buffer.from("0".repeat(64), "hex"),
    });
    expect(row.user_segment).toBe("anon");
    expect(row.query_length).toBe(4);
    expect(row.query_word_count).toBe(1);
    expect(row.total_ms).toBe(123);
    expect(row.cache_hit).toBe("miss");
    // CRITICAL: no user_id field (regression guard for the GDPR cascade prevention)
    expect((row as Record<string, unknown>).user_id).toBeUndefined();
  });

  it("reports zero_result when sections are empty", () => {
    const emptyPresented = { ...basePresented, sections: [], totals: {} };
    const row = buildSearchEventRow({
      query: "qxzvwrb",
      portalSlug: "atlanta",
      segment: "anon",
      hadFilters: false,
      presented: emptyPresented,
      intentType: "find_event",
      salt: Buffer.from("0".repeat(64), "hex"),
    });
    expect(row.zero_result).toBe(true);
  });

  it("counts query words correctly", () => {
    const row = buildSearchEventRow({
      query: "jazz brunch midtown",
      portalSlug: "atlanta",
      segment: "authed",
      hadFilters: true,
      presented: basePresented,
      intentType: "find_event",
      salt: Buffer.from("0".repeat(64), "hex"),
    });
    expect(row.query_word_count).toBe(3);
    expect(row.user_segment).toBe("authed");
  });
});
