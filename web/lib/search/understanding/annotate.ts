import { createHash } from "node:crypto";
import { normalizeSearchQuery } from "@/lib/search/normalize";
import { tokenize } from "@/lib/search/understanding/tokenize";
import { classifyIntent } from "@/lib/search/understanding/intent";
import { linkEntities } from "@/lib/search/understanding/entities";
import type {
  AnnotatedQuery,
  PortalContext,
  StructuredFilters,
  Token,
  EntityAnnotation,
} from "@/lib/search/understanding/types";
import type { SearchFilterInput } from "@/lib/search/input-schema";

/**
 * Deep freeze helper. TypeScript `readonly` is structural only — this
 * enforces runtime immutability so a future cache implementation can't
 * "just patch the fingerprint after the fact" and erode the contract.
 */
function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") return obj;
  if (Object.isFrozen(obj)) return obj;

  // Freeze each nested field before freezing the container
  for (const key of Object.keys(obj) as Array<keyof T>) {
    const value = obj[key];
    if (value !== null && typeof value === "object") {
      deepFreeze(value);
    }
  }
  return Object.freeze(obj);
}

/**
 * Convert a date-window shorthand into an ISO date range.
 * All dates are relative to wall-clock now (server time), truncated to day.
 */
function dateWindowToRange(
  window: "today" | "tomorrow" | "weekend" | "week"
): { start: string; end: string } | null {
  const now = new Date();
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const today = startOfDay(now);

  switch (window) {
    case "today": {
      const end = new Date(today);
      end.setDate(end.getDate() + 1);
      return {
        start: today.toISOString().slice(0, 10),
        end: end.toISOString().slice(0, 10),
      };
    }
    case "tomorrow": {
      const start = new Date(today);
      start.setDate(start.getDate() + 1);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      return {
        start: start.toISOString().slice(0, 10),
        end: end.toISOString().slice(0, 10),
      };
    }
    case "weekend": {
      // Find the upcoming Saturday (or today if it's Saturday)
      const day = today.getDay(); // 0=Sun, 6=Sat
      const daysToSat = (6 - day + 7) % 7;
      const start = new Date(today);
      start.setDate(start.getDate() + daysToSat);
      const end = new Date(start);
      end.setDate(end.getDate() + 2); // Saturday + Sunday
      return {
        start: start.toISOString().slice(0, 10),
        end: end.toISOString().slice(0, 10),
      };
    }
    case "week": {
      const end = new Date(today);
      end.setDate(end.getDate() + 7);
      return {
        start: today.toISOString().slice(0, 10),
        end: end.toISOString().slice(0, 10),
      };
    }
  }
}

/**
 * The ONLY public entry point for query understanding. Retrievers consume
 * the AnnotatedQuery output; they never see the raw string directly.
 *
 * CRITICAL INVARIANT: this function must NEVER mutate, strip, or substitute
 * the user's query. The `raw` and `normalized` fields preserve the user's
 * intent end-to-end. This is the architectural fix for the 1869-line
 * unified-search.ts bug where "jazz" was silently replaced with
 * category=music and an empty FTS query.
 *
 * The returned AnnotatedQuery is DEEPLY frozen — not just top-level readonly.
 * Inner arrays, Token objects, entities, intent, and structured_filters are
 * all frozen. Any attempt to mutate in strict mode throws.
 *
 * @param filterInput  Optional explicit filter values from the request. When
 *   supplied, they populate structured_filters and temporal — making filter
 *   values visible to retrievers without a separate DB round-trip.
 */
export async function annotate(
  raw: string,
  ctx: PortalContext,
  filterInput?: SearchFilterInput
): Promise<AnnotatedQuery> {
  const normalized = normalizeSearchQuery(raw);
  const tokens = tokenize(normalized);
  const intent = classifyIntent(normalized, tokens);
  const entities = linkEntities(normalized, tokens, ctx);

  // Build structured_filters from explicit filterInput values.
  // Only include keys when values are present — downstream code checks
  // for the presence of each key (e.g. `structured_filters.categories ?? null`).
  const structured_filters: StructuredFilters = {};
  if (filterInput?.categories?.length) {
    structured_filters.categories = filterInput.categories;
  }
  if (filterInput?.neighborhoods?.length) {
    structured_filters.neighborhoods = filterInput.neighborhoods;
  }
  if (filterInput?.tags?.length) {
    // tags is not part of StructuredFilters interface but tolerated as extra key
    (structured_filters as Record<string, unknown>).tags = filterInput.tags;
  }
  if (filterInput?.free != null || filterInput?.price != null) {
    structured_filters.price = {
      ...(filterInput.free != null ? { free: filterInput.free } : {}),
      ...(filterInput.price != null ? { max: filterInput.price } : {}),
    };
  }

  // Build temporal from date window shorthand.
  let temporal: AnnotatedQuery["temporal"] | undefined;
  if (filterInput?.date) {
    const range = dateWindowToRange(filterInput.date);
    if (range) {
      temporal = { type: "range", start: range.start, end: range.end };
    }
  }

  // Fingerprint now incorporates structured_filters and temporal so different
  // filter combinations produce different cache keys. Critical for Phase 1
  // Redis caching — without this, ?q=jazz and ?q=jazz&categories=music would
  // collide on the same cache key.
  const fingerprint = createHash("sha256")
    .update(ctx.portal_slug)
    .update("\0")
    .update(normalized)
    .update("\0")
    .update(intent.type)
    .update("\0")
    .update(JSON.stringify(structured_filters))
    .update("\0")
    .update(temporal ? `${temporal.start}:${temporal.end}` : "")
    .digest("hex")
    .slice(0, 32);

  // Build the AnnotatedQuery object and deep-freeze it before returning.
  // The deep freeze is what enforces the "retrievers can only read" contract
  // at runtime.
  const queryObj: {
    raw: string;
    normalized: string;
    tokens: ReadonlyArray<Token>;
    entities: ReadonlyArray<EntityAnnotation>;
    temporal?: AnnotatedQuery["temporal"];
    spelling: AnnotatedQuery["spelling"];
    synonyms: AnnotatedQuery["synonyms"];
    structured_filters: StructuredFilters;
    intent: { type: AnnotatedQuery["intent"]["type"]; confidence: number };
    fingerprint: string;
  } = {
    raw,
    normalized,
    tokens: tokens.map((t) => Object.freeze({ ...t })) as ReadonlyArray<Token>,
    entities: entities.map((e) => Object.freeze({ ...e })) as ReadonlyArray<EntityAnnotation>,
    spelling: [],
    synonyms: [],
    structured_filters,
    intent: { type: intent.type, confidence: intent.confidence },
    fingerprint,
  };
  if (temporal !== undefined) {
    queryObj.temporal = temporal;
  }

  const query: AnnotatedQuery = deepFreeze(queryObj);

  return query;
}
