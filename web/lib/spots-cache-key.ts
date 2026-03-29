const SPOTS_CACHE_KEY_PARAMS = new Set([
  "portal_id",
  "portal",
  "exclusive",
  "open_now",
  "with_events",
  "price_level",
  "venue_type",
  "place_type",
  "neighborhood",
  "vibes",
  "genres",
  "cuisine",
  "q",
  "include_hours",
  "include_events",
  "center_lat",
  "center_lng",
  "radius_km",
  "sort",
  "limit",
]);

const SPOTS_MULTI_VALUE_PARAMS = new Set([
  "price_level",
  "venue_type",
  "place_type",
  "neighborhood",
  "vibes",
  "genres",
  "cuisine",
]);

function normalizeSpotsQueryValue(value: string): string {
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

function normalizeNumberValue(value: string): string {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? String(parsed) : value.trim();
}

function normalizeSpotsParamValue(key: string, value: string): string {
  if (key === "q") {
    return normalizeSpotsQueryValue(value);
  }

  if (SPOTS_MULTI_VALUE_PARAMS.has(key)) {
    return normalizeDelimitedValue(value);
  }

  if (
    key === "center_lat" ||
    key === "center_lng" ||
    key === "radius_km" ||
    key === "limit"
  ) {
    return normalizeNumberValue(value);
  }

  if (key === "portal" || key === "sort") {
    return value.trim().toLowerCase();
  }

  return value.trim();
}

export function buildStableSpotsSearchParamsKey(
  searchParams: URLSearchParams,
): string {
  return Array.from(searchParams.entries())
    .filter(([key]) => SPOTS_CACHE_KEY_PARAMS.has(key))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(
          normalizeSpotsParamValue(key, value),
        )}`,
    )
    .join("&");
}
