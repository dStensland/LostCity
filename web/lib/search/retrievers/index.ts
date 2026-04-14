import type { Retriever, RetrieverId } from "@/lib/search/types";
import type { UnifiedRetrievalResult } from "@/lib/search/unified-retrieval";
import { createFtsRetriever } from "@/lib/search/retrievers/fts";
import { createTrigramRetriever } from "@/lib/search/retrievers/trigram";
import { createStructuredRetriever } from "@/lib/search/retrievers/structured";

/**
 * Factory that builds the retriever registry from a pre-computed
 * UnifiedRetrievalResult. Every retriever reads its own slice; none
 * issues database calls.
 *
 * Extending: to add a new retriever, (a) add its CTE to search_unified.sql
 * (spec §2.5), (b) add the demux branch in unified-retrieval.ts, (c) create
 * the retriever factory file here, (d) register it below. The contract test
 * will automatically enforce purity + monotonicity + self-labeling.
 */
export function buildRetrieverRegistry(
  source: UnifiedRetrievalResult
): Record<RetrieverId, Retriever> {
  return {
    fts: createFtsRetriever(source),
    trigram: createTrigramRetriever(source),
    structured: createStructuredRetriever(source),
  };
}
