import type { Candidate, Retriever, RetrieverContext } from "@/lib/search/types";
import type { AnnotatedQuery } from "@/lib/search/understanding/types";
import type { UnifiedRetrievalResult } from "@/lib/search/unified-retrieval";

/**
 * StructuredRetriever interprets the 'structured' slice of UnifiedRetrievalResult.
 * Phase 0 is a pass-through — the SQL function currently has no structured
 * retriever CTE, so source.structured is always empty. Phase 1 will add
 * structured filter pushdown (category, neighborhood, date) as its own CTE.
 *
 * The retriever exists now so the registry + contract test have something
 * to enumerate, and so Phase 1 can fill in the SQL side without touching
 * TypeScript.
 */
export function createStructuredRetriever(source: UnifiedRetrievalResult): Retriever {
  return {
    id: "structured",
    async retrieve(_q: AnnotatedQuery, _ctx: RetrieverContext): Promise<Candidate[]> {
      return source.structured;
    },
  };
}
