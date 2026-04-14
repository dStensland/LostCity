/**
 * Core search types. See docs/superpowers/specs/2026-04-13-search-elevation-design.md §2.1
 *
 * A Candidate is the atomic unit crossing Retrieval → Ranking → Presentation.
 * Retrievers MUST NOT pre-shape for presentation. The ranker owns ordering;
 * the presenter owns grouping and top-matches selection.
 *
 * Retrievers MUST NOT issue their own database calls — they read from
 * UnifiedRetrievalResult passed to their factory. This is enforced by the
 * lint rule `no-retriever-rpc-calls` and the retriever contract test.
 */

import type { AnnotatedQuery } from "@/lib/search/understanding/types";

export type EntityType =
  | "event"
  | "venue"
  | "organizer"
  | "series"
  | "festival"
  | "exhibition"
  | "program"
  | "neighborhood"
  | "category";

export type RetrieverId = "fts" | "trigram" | "structured";

export interface Candidate {
  id: string;                       // stable entity id
  type: EntityType;
  source_retriever: RetrieverId;
  raw_score: number;                // retriever-native, pre-normalization
  matched_fields: string[];         // ['title', 'venue.name', ...]
  payload: Record<string, unknown>; // type-specific, opaque to ranker.
                                    // Presenter is the only consumer —
                                    // ranker MUST NOT read payload.
}

export interface RetrieverContext {
  portal_id: string;                // REQUIRED — data isolation boundary
  limit: number;                    // per-retriever cap; ranker does final truncation
  types?: EntityType[];             // Optional entity-type scope; defaults to ["event","venue"] in unified-retrieval
  signal: AbortSignal;              // cooperative cancellation
}

/**
 * A Retriever consumes the full AnnotatedQuery (it legitimately needs
 * structured_filters, temporal, intent for predicate pushdown) but reads
 * candidates from the pre-computed UnifiedRetrievalResult — NOT from the
 * database. The DB-call boundary is enforced by the `no-retriever-rpc-calls`
 * ESLint rule under web/tools/eslint-rules/, plus the retriever contract
 * test that verifies purity.
 */
export interface Retriever {
  readonly id: RetrieverId;
  retrieve(q: AnnotatedQuery, ctx: RetrieverContext): Promise<Candidate[]>;
}
