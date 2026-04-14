import { z } from "zod";
import { normalizeSearchQuery } from "@/lib/search/normalize";

/**
 * Zod input schema for /api/search/unified. First line of server-side defense
 * against injection, DoS, and abuse. See spec §3.1.
 *
 * CRITICAL: portal_id is NOT a parameter. The route handler derives portal
 * from the [portal] route segment via resolvePortalRequest. This schema
 * intentionally omits portal_id so that a client-supplied portal_id is
 * silently stripped by Zod's default behavior.
 */

export const SearchEntityType = z.enum([
  "event",
  "venue",
  "organizer",
  "series",
  "festival",
  "exhibition",
  "program",
  "neighborhood",
]);

const FacetSlug = z
  .string()
  .min(1)
  .max(32)
  .regex(/^[a-z0-9_]+$/, {
    message: "facet slug must be lowercase alphanumeric + underscore",
  });

export const SearchDateWindow = z.enum(["today", "tomorrow", "weekend", "week"]);

export const SearchInputSchema = z.object({
  q: z.string().min(1).max(120),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).max(500).default(0),
  types: z.array(SearchEntityType).max(8).optional(),
  categories: z.array(FacetSlug).max(20).optional(),
  neighborhoods: z.array(FacetSlug).max(20).optional(),
  tags: z.array(FacetSlug).max(20).optional(),
  date: SearchDateWindow.nullable().optional(),
  free: z.coerce.boolean().optional(),
  price: z.coerce.number().int().min(1).max(4).nullable().optional(),
  cursor: z.string().max(256).optional(),
  locale: z
    .string()
    .regex(/^[a-z]{2}(-[A-Z]{2})?$/, {
      message: "locale must be ISO format like 'en' or 'en-US'",
    })
    .max(5)
    .optional(),
});

export type SearchInput = z.infer<typeof SearchInputSchema>;

/**
 * The filter-only slice of SearchInput. Passed from the route handler through
 * SearchOptions.filters → annotate() → AnnotatedQuery.structured_filters +
 * .temporal → runUnifiedRetrieval → search_unified RPC params.
 *
 * `types` is included here for API symmetry but is treated as a retrieval
 * scope (not a row filter) in RetrieverContext.
 */
export type SearchFilterInput = Pick<
  SearchInput,
  "categories" | "neighborhoods" | "tags" | "date" | "free" | "price" | "types"
>;

/**
 * Parse URLSearchParams into a validated, normalized SearchInput.
 *
 * ORDER OF OPERATIONS (load-bearing — do not reorder without reading this):
 *
 *   1. Split comma-separated array params (types, categories, etc.) — this
 *      is structural, not value-level, so it runs before Zod.
 *   2. VALIDATE — Zod sees the raw query string and enforces min/max length,
 *      enum membership, and facet-slug regexes. A 200-char query is rejected
 *      here regardless of what normalization would do to it later.
 *   3. NORMALIZE — NFKC + control-char strip + whitespace collapse only
 *      happens AFTER Zod has accepted the input. Normalization cannot mask
 *      a bad input: if the raw query failed Zod, we never reach this step.
 *   4. POST-NORMALIZE GUARD — if normalization reduced q below the min
 *      length (e.g., the raw was "\u0000" which passes z.string().min(1)
 *      but normalizes to ""), we raise a ZodError for parity with step 2.
 *
 * The invariant: **validate first, then normalize.** Rejection of malformed
 * input is deterministic and independent of the normalization function's
 * behavior. Changing the order would let normalization mask DoS / injection
 * input — a control-char bomb could expand past 120 chars AFTER the check,
 * defeating the length guard.
 *
 * Throws a ZodError on validation failure. The route handler is expected to
 * catch and return 400.
 */
export function parseSearchInput(searchParams: URLSearchParams): SearchInput {
  // Step 1: structural transform — array param splitting (no value changes).
  const raw = Object.fromEntries(searchParams.entries());
  const arrayify = (v: string | undefined) =>
    v ? v.split(",").map((s) => s.trim()).filter(Boolean) : undefined;

  // Step 2: VALIDATE — Zod runs against the untouched raw q.
  const parsed = SearchInputSchema.parse({
    ...raw,
    types: arrayify(raw.types),
    categories: arrayify(raw.categories),
    neighborhoods: arrayify(raw.neighborhoods),
    tags: arrayify(raw.tags),
  });

  // Step 3: NORMALIZE — only after Zod has accepted the raw input.
  const normalized_q = normalizeSearchQuery(parsed.q);

  // Step 4: POST-NORMALIZE GUARD — zero-width / control-only queries would
  // pass z.string().min(1) but collapse to empty during normalization.
  if (normalized_q.length < 1) {
    throw new z.ZodError([
      {
        code: "custom",
        path: ["q"],
        message: "query is empty after normalization",
      },
    ]);
  }

  return { ...parsed, q: normalized_q };
}
