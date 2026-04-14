import "server-only";
import { annotate } from "@/lib/search/understanding/annotate";
import { runUnifiedRetrieval } from "@/lib/search/unified-retrieval";
import { buildRetrieverRegistry } from "@/lib/search/retrievers";
import { RrfRanker } from "@/lib/search/ranking";
import { GroupedPresenter } from "@/lib/search/presenting";
import type { PresentedResults, PresentationPolicy } from "@/lib/search/presenting/types";
import type { RetrieverId, Candidate } from "@/lib/search/types";

const DEFAULT_POLICY: PresentationPolicy = {
  topMatchesCount: 6,
  groupCaps: {
    event: 8,
    venue: 6,
    organizer: 4,
    series: 4,
    festival: 4,
    program: 4,
    exhibition: 4,
    neighborhood: 4,
    category: 4,
  },
  diversityLambda: 0,
  dedupeKey: (c) => `${c.type}:${c.id}`,
};

export interface SearchOptions {
  portal_id: string;
  portal_slug: string;
  limit: number;
  user_id?: string;
  signal?: AbortSignal;
}

/**
 * The orchestrator. Three phases, strictly sequenced:
 *   1. Understand  — annotate(raw) → AnnotatedQuery
 *   2. Retrieve    — runUnifiedRetrieval → UnifiedRetrievalResult → per-retriever Map
 *   3. Rank + Present — RrfRanker → GroupedPresenter → PresentedResults
 *
 * Target: ~150 lines. If this file grows past 200, extract helpers.
 * The orchestrator is wiring, not business logic.
 */
export async function search(
  raw: string,
  opts: SearchOptions
): Promise<PresentedResults> {
  const started = Date.now();
  const signal = opts.signal ?? new AbortController().signal;

  // Phase 1: Understand
  const annotateStart = Date.now();
  const annotated = await annotate(raw, {
    portal_id: opts.portal_id,
    portal_slug: opts.portal_slug,
  });
  const annotateMs = Date.now() - annotateStart;

  // Phase 2: Retrieve — single RPC call, demultiplex by retriever
  const retrieveStart = Date.now();
  const unifiedResult = await runUnifiedRetrieval(annotated, {
    portal_id: opts.portal_id,
    limit: opts.limit,
    signal,
  });
  const retrieveMs = Date.now() - retrieveStart;

  // Phase 3a: Instantiate retrievers reading from the unified result
  const registry = buildRetrieverRegistry(unifiedResult);
  const retrieverIds: RetrieverId[] = ["fts", "trigram", "structured"];
  const candidateSets = new Map<RetrieverId, Candidate[]>();
  for (const id of retrieverIds) {
    const retriever = registry[id];
    const candidates = await retriever.retrieve(annotated, {
      portal_id: opts.portal_id,
      limit: opts.limit,
      signal,
    });
    candidateSets.set(id, candidates);
  }

  // Phase 3b: Rank
  const rankStart = Date.now();
  const ranked = RrfRanker.rank(candidateSets, {
    weights: {},
    intent: annotated.intent,
  });
  const rankMs = Date.now() - rankStart;

  // Phase 3c: Present
  const presentStart = Date.now();
  const presented = GroupedPresenter.present(ranked, DEFAULT_POLICY);
  const presentMs = Date.now() - presentStart;

  // Fill diagnostics. Phase 0 uses cache_hit: "miss" for every call —
  // Phase 1 adds the actual Redis cache wrapper which will set this field.
  presented.diagnostics.total_ms = Date.now() - started;
  presented.diagnostics.annotate_ms = annotateMs;
  presented.diagnostics.rank_ms = rankMs;
  presented.diagnostics.present_ms = presentMs;
  presented.diagnostics.retriever_ms = { fts: retrieveMs };
  presented.diagnostics.cache_hit = "miss";

  return presented;
}
