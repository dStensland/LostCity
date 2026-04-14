import type { Candidate, RetrieverId } from "@/lib/search/types";
import type { Ranker, RankedCandidate, RankingContext } from "@/lib/search/ranking/types";

const RRF_K = 60; // Cormack et al. 2009 canonical constant

/**
 * Reciprocal Rank Fusion ranker. Scale-invariant: only cares about ranks within
 * each retriever, so retrievers can return any score scale and fusion still works.
 *
 * Formula: final_score = Σ 1 / (k + rank_r)  for each retriever r containing the candidate.
 *
 * Why RRF: ts_rank_cd (range ~0-0.1) and similarity (range ~0.2-0.4) are on
 * incompatible scales. A weighted sum of raw scores would make one retriever
 * dominate silently. RRF normalizes via rank position, not score magnitude.
 */
export const RrfRanker: Ranker = {
  id: "rrf-k60",
  rank(
    candidateSets: Map<RetrieverId, Candidate[]>,
    _ctx: RankingContext
  ): RankedCandidate[] {
    // Sort each retriever's set by raw_score DESC so rank positions are meaningful.
    // (Inputs from unified-retrieval are already sorted by the SQL ORDER BY,
    // but we re-sort defensively to decouple from that guarantee.)
    const sortedSets = new Map<RetrieverId, Candidate[]>();
    for (const [retriever, list] of candidateSets) {
      sortedSets.set(retriever, [...list].sort((a, b) => b.raw_score - a.raw_score));
    }

    // Accumulate RRF score and track contributing retrievers
    const scores = new Map<
      string,
      { score: number; contributors: RetrieverId[]; candidate: Candidate }
    >();

    for (const [retriever, sorted] of sortedSets) {
      sorted.forEach((c, i) => {
        const key = `${c.type}:${c.id}`;
        const existing = scores.get(key);
        const contribution = 1 / (RRF_K + i + 1);
        if (existing) {
          existing.score += contribution;
          existing.contributors.push(retriever);
        } else {
          scores.set(key, {
            score: contribution,
            contributors: [retriever],
            candidate: c,
          });
        }
      });
    }

    // Materialize, sort descending, assign final_score and rank
    const ranked: RankedCandidate[] = Array.from(scores.values())
      .map(({ score, contributors, candidate }) => ({
        ...candidate,
        final_score: score,
        contributing_retrievers: contributors,
        rank: 0, // placeholder, set below
      }))
      .sort((a, b) => b.final_score - a.final_score);

    ranked.forEach((c, i) => { c.rank = i; });
    return ranked;
  },
};
