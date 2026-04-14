import "server-only";
import { annotate } from "@/lib/search/understanding/annotate";
import { runUnifiedRetrieval } from "@/lib/search/unified-retrieval";
import { buildRetrieverRegistry } from "@/lib/search/retrievers";
import { RrfRanker } from "@/lib/search/ranking";
import { GroupedPresenter } from "@/lib/search/presenting";
import type { PresentedResults, PresentationPolicy } from "@/lib/search/presenting/types";
import type { RetrieverId, Candidate } from "@/lib/search/types";
import type { SearchFilterInput } from "@/lib/search/input-schema";
import type { AnnotatedQuery } from "@/lib/search/understanding/types";

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
  filters?: SearchFilterInput;
  signal?: AbortSignal;
}

/**
 * Result of search(). Carries both the presented payload for rendering AND
 * the annotated query used upstream, so callers that need the annotation
 * (e.g., the route handler logging search_events.intent_type) can read it
 * off the service result instead of re-invoking annotate() — which would
 * double the work and double-count in telemetry.
 */
export interface SearchResult {
  annotated: AnnotatedQuery;
  presented: PresentedResults;
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
): Promise<SearchResult> {
  const started = Date.now();
  const signal = opts.signal ?? new AbortController().signal;

  // Early-abort guard — if the caller cancelled before we started, bail now.
  if (signal.aborted) {
    throw new DOMException("search aborted", "AbortError");
  }

  // Phase 1: Understand — pass filterInput so structured_filters and temporal
  // are populated from explicit request params, not left as empty objects.
  const annotateStart = Date.now();
  const annotated = await annotate(
    raw,
    { portal_id: opts.portal_id, portal_slug: opts.portal_slug },
    opts.filters
  );
  const annotateMs = Date.now() - annotateStart;

  // Phase 2: Retrieve — single RPC call, demultiplex by retriever.
  // Pass types through RetrieverContext so the SQL function can scope entity
  // types. filters.types is a retrieval scope, not a row filter.
  const retrieveStart = Date.now();
  const unifiedResult = await runUnifiedRetrieval(annotated, {
    portal_id: opts.portal_id,
    limit: opts.limit,
    types: opts.filters?.types,
    signal,
  });

  // Phase 3a: Instantiate retrievers reading from the unified result.
  // Retrievers run in parallel via Promise.all — they share the same
  // in-memory UnifiedRetrievalResult and never hit the database, so the
  // parallelism is essentially free but keeps the wall-clock bounded by
  // the slowest retriever rather than the sum.
  const registry = buildRetrieverRegistry(unifiedResult);
  const retrieverIds: RetrieverId[] = ["fts", "trigram", "structured"];
  const retrieverResults = await Promise.all(
    retrieverIds.map((id) =>
      registry[id].retrieve(annotated, {
        portal_id: opts.portal_id,
        limit: opts.limit,
        types: opts.filters?.types,
        signal,
      })
    )
  );
  const candidateSets = new Map<RetrieverId, Candidate[]>();
  retrieverIds.forEach((id, i) => candidateSets.set(id, retrieverResults[i]));
  const retrieveTotalMs = Date.now() - retrieveStart;

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
  presented.diagnostics.retrieve_total_ms = retrieveTotalMs;
  // retriever_ms is reserved for future per-retriever measurements. Phase 0
  // only tracks the aggregate via retrieve_total_ms.
  presented.diagnostics.retriever_ms = {};
  presented.diagnostics.cache_hit = "miss";

  return { annotated, presented };
}
