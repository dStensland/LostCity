import type { EntityType, RetrieverId } from "@/lib/search/types";
import type { RankedCandidate } from "@/lib/search/ranking/types";

export interface PresentationPolicy {
  topMatchesCount: number;                            // 6 desktop, 3 mobile
  groupCaps: Partial<Record<EntityType, number>>;     // { event: 8, venue: 6, ... }
  diversityLambda: number;                            // MMR: 0 = relevance, 1 = novelty
  dedupeKey: (c: RankedCandidate) => string;
}

export interface SearchDiagnostics {
  total_ms: number;
  cache_hit: "fresh" | "stale" | "miss";
  degraded: boolean;
  retriever_ms: Partial<Record<RetrieverId, number>>;
  result_type_counts: Partial<Record<EntityType, number>>;
  annotate_ms?: number;
  rank_ms?: number;
  present_ms?: number;
}

export interface PresentedResults {
  topMatches: RankedCandidate[];  // hero rail, cross-type interleaved
  sections: Array<{
    type: EntityType;
    title: string;
    items: RankedCandidate[];
    total: number;
  }>;
  totals: Partial<Record<EntityType, number>>;
  diagnostics: SearchDiagnostics;
}

export interface Presenter {
  present(ranked: RankedCandidate[], policy: PresentationPolicy): PresentedResults;
}
