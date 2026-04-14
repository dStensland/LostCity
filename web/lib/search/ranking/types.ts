import type { Candidate, RetrieverId } from "@/lib/search/types";
import type { AnnotatedQuery } from "@/lib/search/understanding/types";

export interface RankedCandidate extends Candidate {
  final_score: number;
  contributing_retrievers: RetrieverId[];
  rank: number;
}

export interface RankingContext {
  weights: Partial<Record<RetrieverId, number>>;
  intent: AnnotatedQuery["intent"];
  diversityLambda?: number;  // MMR tradeoff, 0 = pure relevance
}

/**
 * A Ranker fuses N retrievers' candidate sets into a final ordering.
 * The default ranker is RrfRanker (Reciprocal Rank Fusion, k=60) — scale-
 * invariant, robust to score-scale differences across retrievers, no weight
 * tuning required.
 */
export interface Ranker {
  readonly id: string;
  rank(
    candidateSets: Map<RetrieverId, Candidate[]>,
    ctx: RankingContext
  ): RankedCandidate[];
}
