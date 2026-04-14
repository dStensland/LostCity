import type { Candidate, Retriever, RetrieverContext } from "@/lib/search/types";
import type { AnnotatedQuery } from "@/lib/search/understanding/types";
import type { UnifiedRetrievalResult } from "@/lib/search/unified-retrieval";

/**
 * FtsRetriever interprets the 'fts' slice of a UnifiedRetrievalResult.
 *
 * It does NOT issue its own database calls — that would blow the connection
 * pool budget (spec §2.5 reconciliation). The lint rule
 * `local/no-retriever-rpc-calls` enforces this at CI time, and the retriever
 * contract test (retriever-contract.test.ts) enforces runtime purity.
 *
 * The source is already sorted DESC by raw_score by the SQL function's
 * ORDER BY clause, so this retriever is a straight pass-through.
 */
export function createFtsRetriever(source: UnifiedRetrievalResult): Retriever {
  return {
    id: "fts",
    async retrieve(_q: AnnotatedQuery, _ctx: RetrieverContext): Promise<Candidate[]> {
      return source.fts;
    },
  };
}
