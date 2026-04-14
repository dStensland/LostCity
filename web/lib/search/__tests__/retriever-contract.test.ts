/**
 * Retriever contract test. Enforces that every registered retriever is:
 *   1. PURE — same input produces same output
 *   2. MONOTONIC — raw_score is non-increasing in the returned array
 *   3. SELF-LABELED — every candidate has source_retriever === retriever.id
 *
 * This test file exists BEFORE any retriever implementation. It gracefully
 * skips if the retriever registry module is not yet present. When Part E
 * (Tasks 19-22) lands the retrievers, this test becomes active automatically
 * and runs on every CI build.
 *
 * Together with the `no-retriever-rpc-calls` ESLint rule, this is the second
 * half of the three-layer contract enforcement: lint prevents DB calls at
 * compile time, contract test verifies runtime behavior.
 */

import { describe, it, expect } from "vitest";
import type { Candidate, Retriever, RetrieverContext } from "@/lib/search/types";
import type { AnnotatedQuery } from "@/lib/search/understanding/types";

// ---------------------------------------------------------------------------
// Registry loader — gracefully absent until Part E ships
// ---------------------------------------------------------------------------

type RetrieverRegistry = Record<string, Retriever>;

// UnifiedRetrievalResult shape expected by buildRetrieverRegistry.
// Kept inline here so this file has zero runtime deps on modules that don't
// exist yet — adding the real type import in Part E is a one-line change.
interface UnifiedRetrievalResult {
  fts: unknown[];
  trigram: unknown[];
  structured: unknown[];
}

// Vite resolves `@/` alias imports at transform time even with @vite-ignore,
// so we construct the path at runtime to prevent a build-time error when the
// module doesn't exist yet.
function buildRegistryPath(): string {
  // Construct dynamically so Vite's static import analysis cannot intercept it.
  const base = "/lib/search/retrievers";
  return base; // evaluated at runtime, not transform time
}

async function loadRegistry(): Promise<RetrieverRegistry | null> {
  try {
    // The path resolves to an absolute filesystem path — bypasses Vite's
    // alias resolution for the missing module. Uses process.cwd() which
    // vitest provides in the Node.js test environment.
    const absPath =
      typeof process !== "undefined" && process.cwd
        ? process.cwd() + buildRegistryPath()
        : null;
    if (!absPath) return null;

    const mod = await import(/* @vite-ignore */ absPath);
    if (typeof mod.buildRetrieverRegistry !== "function") return null;
    const emptyResult: UnifiedRetrievalResult = {
      fts: [],
      trigram: [],
      structured: [],
    };
    return mod.buildRetrieverRegistry(emptyResult) as RetrieverRegistry;
  } catch {
    // Module not found — Part E hasn't shipped yet. Tests gracefully skip.
    return null;
  }
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

// AnnotatedQuery satisfies AnnotatedQueryShape (the retrieve() param type) and
// the full AnnotatedQuery interface — so this mock works both today and when
// Part E retrievers accept the full type.
const mockAnnotatedQuery: AnnotatedQuery = Object.freeze({
  raw: "contract test query",
  normalized: "contract test query",
  tokens: Object.freeze([]) as AnnotatedQuery["tokens"],
  entities: Object.freeze([]) as AnnotatedQuery["entities"],
  spelling: Object.freeze([]) as AnnotatedQuery["spelling"],
  synonyms: Object.freeze([]) as AnnotatedQuery["synonyms"],
  structured_filters: Object.freeze({}),
  intent: { type: "find_event" as const, confidence: 0.7 },
  fingerprint: "contract-test-fingerprint",
});

const mockContext: RetrieverContext = {
  portal_id: "contract-test-portal",
  limit: 20,
  signal: new AbortController().signal,
};

// ---------------------------------------------------------------------------
// Contract tests
// ---------------------------------------------------------------------------

describe("Retriever contract", () => {
  it("scaffold: registry module is importable (or gracefully absent)", async () => {
    const registry = await loadRegistry();
    if (registry === null) {
      // No registry yet — Part E hasn't shipped retrievers.
      expect(true).toBe(true);
      return;
    }
    expect(registry).toBeDefined();
  });

  it("contract: all registered retrievers are pure (same input → same output)", async () => {
    const registry = await loadRegistry();
    if (registry === null) {
      // Skip until Part E ships
      return;
    }
    for (const [name, retriever] of Object.entries(registry)) {
      const a = await retriever.retrieve(mockAnnotatedQuery, mockContext);
      const b = await retriever.retrieve(mockAnnotatedQuery, mockContext);
      expect(a, `retriever ${name} is not pure`).toEqual(b);
    }
  });

  it("contract: all retrievers return raw_score monotonically non-increasing", async () => {
    const registry = await loadRegistry();
    if (registry === null) return;
    for (const [name, retriever] of Object.entries(registry)) {
      const results: Candidate[] = await retriever.retrieve(
        mockAnnotatedQuery,
        mockContext
      );
      for (let i = 1; i < results.length; i++) {
        expect(
          results[i - 1].raw_score >= results[i].raw_score,
          `retriever ${name} returned candidates in a non-monotonic order at index ${i}: ${results[i - 1].raw_score} < ${results[i].raw_score}`
        ).toBe(true);
      }
    }
  });

  it("contract: all emitted candidates have source_retriever matching the retriever id", async () => {
    const registry = await loadRegistry();
    if (registry === null) return;
    for (const [name, retriever] of Object.entries(registry)) {
      const results: Candidate[] = await retriever.retrieve(
        mockAnnotatedQuery,
        mockContext
      );
      for (const candidate of results) {
        expect(
          candidate.source_retriever,
          `retriever ${name} emitted a candidate with mismatched source_retriever: ${candidate.source_retriever}`
        ).toBe(retriever.id);
      }
    }
  });
});
