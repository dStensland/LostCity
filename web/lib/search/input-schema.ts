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
 * Array params arrive comma-separated (e.g., `categories=music,comedy`) and
 * are split before Zod validation. The query field gets NFKC normalization +
 * control-char stripping applied AFTER the initial Zod parse.
 *
 * Throws a ZodError on validation failure. The route handler is expected to
 * catch and return 400.
 */
export function parseSearchInput(searchParams: URLSearchParams): SearchInput {
  const raw = Object.fromEntries(searchParams.entries());
  const arrayify = (v: string | undefined) =>
    v ? v.split(",").map((s) => s.trim()).filter(Boolean) : undefined;

  const parsed = SearchInputSchema.parse({
    ...raw,
    types: arrayify(raw.types),
    categories: arrayify(raw.categories),
    neighborhoods: arrayify(raw.neighborhoods),
    tags: arrayify(raw.tags),
  });

  // Re-normalize q after Zod — NFKC + control chars + whitespace collapse.
  // If normalization reduces q below the min length (1 char), re-validate.
  const normalized_q = normalizeSearchQuery(parsed.q);
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
