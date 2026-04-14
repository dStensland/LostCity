/**
 * Core search types. See docs/superpowers/specs/2026-04-13-search-elevation-design.md §2.1
 *
 * A Candidate is the atomic unit crossing Retrieval → Ranking → Presentation.
 * Retrievers MUST NOT pre-shape for presentation. The ranker owns ordering;
 * the presenter owns grouping and top-matches selection.
 */

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
  payload: Record<string, unknown>; // type-specific, opaque to ranker
}

export interface RetrieverContext {
  portal_id: string;                // REQUIRED — data isolation boundary
  user_id?: string;                 // for visible persistence only, never hidden personalization
  limit: number;                    // per-retriever cap; ranker does final truncation
  signal: AbortSignal;              // cooperative cancellation
}

/**
 * A Retriever reads from pre-computed UnifiedRetrievalResult (see
 * lib/search/unified-retrieval.ts). It MUST NOT issue its own database calls.
 * This contract is enforced by lint rule no-retriever-rpc-calls and by the
 * retriever contract test.
 */
export interface Retriever {
  readonly id: RetrieverId;
  retrieve(q: AnnotatedQueryShape, ctx: RetrieverContext): Promise<Candidate[]>;
}

// Forward reference — AnnotatedQuery is defined in understanding/types.ts.
// This shape alias prevents a circular import when Retriever implementations
// import Candidate from here.
export type AnnotatedQueryShape = {
  readonly raw: string;
  readonly normalized: string;
  readonly fingerprint: string;
};
