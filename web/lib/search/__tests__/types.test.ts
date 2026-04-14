import { describe, it, expectTypeOf } from "vitest";

import type {
  Candidate,
  EntityType,
  RetrieverId,
  RetrieverContext,
  Retriever,
} from "@/lib/search/types";

import type {
  AnnotatedQuery,
  Token,
  EntityAnnotation,
  StructuredFilters,
  IntentType,
} from "@/lib/search/understanding/types";

import type {
  RankedCandidate,
  Ranker,
  RankingContext,
} from "@/lib/search/ranking/types";

import type {
  PresentationPolicy,
  PresentedResults,
  Presenter,
  SearchDiagnostics,
} from "@/lib/search/presenting/types";

describe("search/types", () => {
  it("Candidate has required fields", () => {
    const c: Candidate = {
      id: "abc",
      type: "event",
      source_retriever: "fts",
      raw_score: 1.5,
      matched_fields: ["title"],
      payload: {},
    };
    expectTypeOf(c.id).toBeString();
    expectTypeOf(c.type).toEqualTypeOf<EntityType>();
    expectTypeOf(c.source_retriever).toEqualTypeOf<RetrieverId>();
  });

  it("RetrieverContext requires portal_id", () => {
    const ctx: RetrieverContext = {
      portal_id: "uuid",
      limit: 20,
      signal: new AbortController().signal,
    };
    expectTypeOf(ctx.portal_id).toBeString();
  });

  it("Retriever interface compiles", () => {
    const r: Retriever = {
      id: "fts",
      async retrieve() { return []; },
    };
    expectTypeOf(r.id).toEqualTypeOf<RetrieverId>();
  });
});

describe("search/understanding/types", () => {
  it("AnnotatedQuery is deeply readonly", () => {
    const q: AnnotatedQuery = {
      raw: "jazz",
      normalized: "jazz",
      tokens: [],
      entities: [],
      spelling: [],
      synonyms: [],
      structured_filters: {},
      intent: { type: "find_event", confidence: 0.9 },
      fingerprint: "abc123",
    };
    // @ts-expect-error — raw is readonly
    q.raw = "mutated";
  });

  it("IntentType is a discriminated union", () => {
    const i: IntentType = "find_event";
    expectTypeOf(i).toEqualTypeOf<IntentType>();
  });

  it("Token shape compiles", () => {
    const t: Token = { text: "jazz", normalized: "jazz", start: 0, end: 4, stop: false };
    expectTypeOf(t.stop).toBeBoolean();
  });

  it("EntityAnnotation + StructuredFilters compile", () => {
    const ea: EntityAnnotation = { kind: "category", span: [0, 4], surface: "jazz", confidence: 0.9 };
    const sf: StructuredFilters = { categories: ["music"], price: { free: true } };
    expectTypeOf(ea.kind).toEqualTypeOf<EntityAnnotation["kind"]>();
    expectTypeOf(sf.categories).toEqualTypeOf<string[] | undefined>();
  });
});

describe("search/ranking/types", () => {
  it("RankedCandidate extends Candidate with final_score", () => {
    const r: RankedCandidate = {
      id: "1",
      type: "event",
      source_retriever: "fts",
      raw_score: 0.5,
      matched_fields: ["title"],
      payload: {},
      final_score: 0.8,
      contributing_retrievers: ["fts", "trigram"],
      rank: 0,
    };
    expectTypeOf(r.final_score).toBeNumber();
    expectTypeOf(r.contributing_retrievers).toEqualTypeOf<RetrieverId[]>();
  });

  it("Ranker interface compiles", () => {
    const dummyRanker: Ranker = {
      id: "test",
      rank() { return []; },
    };
    expectTypeOf(dummyRanker.rank).toBeFunction();
  });

  it("RankingContext shape compiles", () => {
    const ctx: RankingContext = {
      weights: { fts: 0.5 },
      intent: { type: "find_event", confidence: 0.9 },
    };
    expectTypeOf(ctx.weights).toEqualTypeOf<Partial<Record<RetrieverId, number>>>();
  });
});

describe("search/presenting/types", () => {
  it("PresentedResults has topMatches + sections", () => {
    const p: PresentedResults = {
      topMatches: [],
      sections: [],
      totals: {},
      diagnostics: {
        total_ms: 100,
        cache_hit: "miss",
        degraded: false,
        retrieve_total_ms: 0,
        retriever_ms: {},
        result_type_counts: {},
      },
    };
    expectTypeOf(p.topMatches).toBeArray();
    expectTypeOf(p.sections).toBeArray();
  });

  it("PresentationPolicy has dedupeKey function", () => {
    const policy: PresentationPolicy = {
      topMatchesCount: 6,
      groupCaps: { event: 8 },
      diversityLambda: 0,
      dedupeKey: (c) => `${c.type}:${c.id}`,
    };
    expectTypeOf(policy.dedupeKey).toBeFunction();
  });

  it("Presenter interface compiles", () => {
    const p: Presenter = {
      present() {
        return {
          topMatches: [],
          sections: [],
          totals: {},
          diagnostics: {
            total_ms: 0,
            cache_hit: "miss",
            degraded: false,
            retriever_ms: {},
            result_type_counts: {},
          },
        };
      },
    };
    expectTypeOf(p.present).toBeFunction();
  });

  it("SearchDiagnostics optional timing fields", () => {
    const d: SearchDiagnostics = {
      total_ms: 0,
      cache_hit: "fresh",
      degraded: false,
      retrieve_total_ms: 42,
      retriever_ms: {},
      result_type_counts: {},
      annotate_ms: 5,
    };
    expectTypeOf(d.annotate_ms).toEqualTypeOf<number | undefined>();
    expectTypeOf(d.retrieve_total_ms).toBeNumber();
  });
});
