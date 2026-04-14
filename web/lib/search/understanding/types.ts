/**
 * Query understanding types. See spec §2.2.
 *
 * AnnotatedQuery is the only thing retrievers see. The raw user string is
 * preserved for display and logging, but retrieval consumes the annotated form.
 * All fields are readonly — AnnotatedQuery is frozen at construction.
 */

export interface Token {
  text: string;         // original surface form
  normalized: string;   // lowercased, unaccented, NFKC
  start: number;        // char offset in raw
  end: number;
  stop: boolean;        // stopword flag
}

export type EntityKind =
  | "category"
  | "neighborhood"
  | "venue"
  | "person"
  | "time"
  | "audience";

export interface EntityAnnotation {
  kind: EntityKind;
  span: [number, number];       // offsets in raw
  resolved_id?: string;         // linked canonical id when confident
  surface: string;              // original text
  confidence: number;           // 0..1
}

export interface StructuredFilters {
  categories?: string[];
  neighborhoods?: string[];
  date_range?: { start: string; end: string };
  price?: { free?: boolean; max?: number };
  audience?: string[];
  venue_ids?: string[];
}

export type IntentType =
  | "find_event"
  | "find_venue"
  | "browse_category"
  | "unknown";

export interface AnnotatedQuery {
  readonly raw: string;                                 // user's original — NEVER mutated
  readonly normalized: string;                          // NFKC + lowercase + ws-collapse
  readonly tokens: ReadonlyArray<Token>;
  readonly entities: ReadonlyArray<EntityAnnotation>;
  readonly temporal?: {
    type: "point" | "range" | "recurring";
    start: string;
    end: string;
  };
  readonly spatial?: {
    neighborhood?: string;
    distance_m?: number;
    center?: [number, number];
  };
  readonly spelling: ReadonlyArray<{
    corrected: string;
    confidence: number;
  }>;
  readonly synonyms: ReadonlyArray<{
    token: string;
    expansions: string[];
    weight: number;
  }>;
  readonly structured_filters: Readonly<StructuredFilters>;
  readonly intent: { type: IntentType; confidence: number };
  readonly fingerprint: string;                          // stable hash for cache + observability
}

export interface PortalContext {
  portal_id: string;
  portal_slug: string;
  locale?: string;
}
