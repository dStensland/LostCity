const SEARCH_CACHE_KEY_PARAMS = new Set([
  "q",
  "types",
  "limit",
  "offset",
  "categories",
  "subcategories",
  "genres",
  "tags",
  "neighborhoods",
  "date",
  "free",
  "portal",
  "portal_id",
  "city",
  "viewMode",
  "findType",
  "include_facets",
  "include_did_you_mean",
  "include_event_popularity",
]);

const INSTANT_SEARCH_CACHE_KEY_PARAMS = new Set([
  "q",
  "limit",
  "types",
  "portal",
  "portal_id",
  "portalSlug",
  "viewMode",
  "findType",
  "include_organizers",
]);

const SEARCH_MULTI_VALUE_PARAMS = new Set([
  "types",
  "categories",
  "subcategories",
  "genres",
  "tags",
  "neighborhoods",
]);

function normalizeQueryValue(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeDelimitedValue(value: string): string {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean),
    ),
  )
    .sort((a, b) => a.localeCompare(b))
    .join(",");
}

function normalizeIntegerValue(value: string): string {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? String(parsed) : value.trim();
}

function normalizeParamValue(key: string, value: string): string {
  if (key === "q") {
    return normalizeQueryValue(value);
  }

  if (SEARCH_MULTI_VALUE_PARAMS.has(key)) {
    return normalizeDelimitedValue(value);
  }

  if (key === "limit" || key === "offset") {
    return normalizeIntegerValue(value);
  }

  if (
    key === "portal" ||
    key === "portalSlug" ||
    key === "city" ||
    key === "viewMode" ||
    key === "findType" ||
    key === "date"
  ) {
    return value.trim().toLowerCase();
  }

  return value.trim();
}

function buildStableKey(
  searchParams: URLSearchParams,
  allowedParams: Set<string>,
): string {
  return Array.from(searchParams.entries())
    .filter(([key]) => allowedParams.has(key))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(
          normalizeParamValue(key, value),
        )}`,
    )
    .join("&");
}

export function buildStableSearchCacheKey(searchParams: URLSearchParams): string {
  return buildStableKey(searchParams, SEARCH_CACHE_KEY_PARAMS);
}

export function buildStableInstantSearchCacheKey(
  searchParams: URLSearchParams,
): string {
  return buildStableKey(searchParams, INSTANT_SEARCH_CACHE_KEY_PARAMS);
}
