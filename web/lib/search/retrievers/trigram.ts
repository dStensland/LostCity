import type { Candidate, Retriever, RetrieverContext } from "@/lib/search/types";
import type { AnnotatedQuery } from "@/lib/search/understanding/types";
import type { UnifiedRetrievalResult } from "@/lib/search/unified-retrieval";

const TRIGRAM_SIMILARITY_FLOOR = 0.25;

/**
 * TrigramRetriever interprets the 'trigram' slice of a UnifiedRetrievalResult.
 * Applies a minimum similarity floor (0.25) to avoid low-quality fuzzy
 * matches polluting results.
 *
 * Reads from the pre-computed source (no database access). Enforced by
 * `local/no-retriever-rpc-calls` lint rule.
 */
export function createTrigramRetriever(source: UnifiedRetrievalResult): Retriever {
  return {
    id: "trigram",
    async retrieve(_q: AnnotatedQuery, _ctx: RetrieverContext): Promise<Candidate[]> {
      return source.trigram.filter((c) => c.raw_score >= TRIGRAM_SIMILARITY_FLOOR);
    },
  };
}
