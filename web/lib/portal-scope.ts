import type { PortalManifest } from "@/lib/portal-manifest";

type PortalScopedQuery<T> = {
  eq: (column: string, value: string) => T;
  or: (filters: string) => T;
  is: (column: string, value: null) => T;
};

type PortalScopeOptions = {
  portalId?: string | null;
  portalExclusive?: boolean;
  publicOnlyWhenNoPortal?: boolean;
};

type FederatedPortalScopeOptions = PortalScopeOptions & {
  sourceIds?: number[];
  sourceColumn?: string;
};

type CityFilterOptions = {
  allowMissingCity?: boolean;
};

const ATLANTA_METRO_CITIES = new Set(
  [
    "alpharetta",
    "atlanta",
    "avondale estates",
    "brookhaven",
    "chamblee",
    "college park",
    "decatur",
    "doraville",
    "duluth",
    "dunwoody",
    "east point",
    "johns creek",
    "kennesaw",
    "lawrenceville",
    "marietta",
    "peachtree city",
    "roswell",
    "sandy springs",
    "smyrna",
    "stone mountain",
    "tucker",
    "woodstock",
  ].map((value) => value.toLowerCase())
);

/**
 * Expand a city filter array to include metro-area cities.
 * e.g., ["Atlanta"] → ["Atlanta", "Decatur", "East Point", "Marietta", ...]
 */
export function expandCityFilterForMetro(cities: string[]): string[] {
  const expanded = new Set<string>();
  for (const city of cities) {
    expanded.add(city);
    const normalized = city.trim().toLowerCase().replace(/\s+/g, " ");
    if (normalized === "atlanta") {
      for (const metroCity of ATLANTA_METRO_CITIES) {
        // Title case for DB matching
        expanded.add(
          metroCity
            .split(" ")
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" ")
        );
      }
    }
  }
  return Array.from(expanded);
}

function normalizeCity(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sanitizeSourceIds(sourceIds: number[]): number[] {
  return sourceIds.filter((id) => Number.isInteger(id) && id > 0);
}

export function applyPortalScopeToQuery<T>(
  query: T,
  options: PortalScopeOptions
): T {
  const {
    portalId = null,
    portalExclusive = false,
    publicOnlyWhenNoPortal = false,
  } = options;
  const scoped = query as unknown as PortalScopedQuery<T>;

  if (portalId) {
    if (portalExclusive) {
      return scoped.eq("portal_id", portalId) as T;
    }
    return scoped.or(`portal_id.eq.${portalId},portal_id.is.null`) as T;
  }

  if (publicOnlyWhenNoPortal) {
    return scoped.is("portal_id", null) as T;
  }

  return query;
}

export function applyFederatedPortalScopeToQuery<T>(
  query: T,
  options: FederatedPortalScopeOptions
): T {
  const {
    portalId = null,
    portalExclusive = false,
    publicOnlyWhenNoPortal = false,
    sourceIds = [],
    sourceColumn = "source_id",
  } = options;
  const scoped = query as unknown as PortalScopedQuery<T>;

  const sanitizedSourceIds = sanitizeSourceIds(sourceIds);
  const hasSources = sanitizedSourceIds.length > 0;
  const sourceFilter = hasSources ? `${sourceColumn}.in.(${sanitizedSourceIds.join(",")})` : "";

  if (portalId) {
    if (portalExclusive) {
      if (hasSources) {
        return scoped.or(`portal_id.eq.${portalId},${sourceFilter}`) as T;
      }
      return scoped.eq("portal_id", portalId) as T;
    }
    if (hasSources) {
      return scoped.or(`portal_id.eq.${portalId},portal_id.is.null,${sourceFilter}`) as T;
    }
    return scoped.or(`portal_id.eq.${portalId},portal_id.is.null`) as T;
  }

  if (publicOnlyWhenNoPortal) {
    return scoped.is("portal_id", null) as T;
  }

  return query;
}

type ManifestScopeOverrides = {
  sourceIds?: number[];
  sourceColumn?: string;
  publicOnlyWhenNoPortal?: boolean;
};

export function getFederatedScopeOptionsFromManifest(
  manifest: Pick<PortalManifest, "portalId" | "scope">,
  overrides: ManifestScopeOverrides = {}
): FederatedPortalScopeOptions {
  return {
    portalId: manifest.portalId,
    portalExclusive: manifest.scope.portalExclusive,
    publicOnlyWhenNoPortal:
      overrides.publicOnlyWhenNoPortal ?? manifest.scope.publicOnlyWhenNoPortal,
    sourceIds: overrides.sourceIds ?? manifest.scope.sourceIds,
    sourceColumn: overrides.sourceColumn ?? manifest.scope.sourceColumn,
  };
}

export function applyManifestFederatedScopeToQuery<T>(
  query: T,
  manifest: Pick<PortalManifest, "portalId" | "scope">,
  overrides: ManifestScopeOverrides = {}
): T {
  return applyFederatedPortalScopeToQuery(
    query,
    getFederatedScopeOptionsFromManifest(manifest, overrides)
  );
}

type FederatedScopeRow = {
  portal_id?: string | null;
  [key: string]: unknown;
};

export function isRowInFederatedPortalScope(
  row: FederatedScopeRow,
  options: FederatedPortalScopeOptions
): boolean {
  const {
    portalId = null,
    portalExclusive = false,
    publicOnlyWhenNoPortal = false,
    sourceIds = [],
    sourceColumn = "source_id",
  } = options;

  const rowPortalId =
    typeof row.portal_id === "string" ? row.portal_id : row.portal_id ?? null;
  const sanitizedSourceIds = sanitizeSourceIds(sourceIds);
  const hasSources = sanitizedSourceIds.length > 0;
  const sourceSet = hasSources ? new Set(sanitizedSourceIds) : null;
  const rowSourceValue = row[sourceColumn];
  const rowSourceId =
    typeof rowSourceValue === "number" && Number.isInteger(rowSourceValue)
      ? rowSourceValue
      : null;
  const sourceMatch = Boolean(sourceSet && rowSourceId !== null && sourceSet.has(rowSourceId));

  if (portalId) {
    if (portalExclusive) {
      return rowPortalId === portalId || sourceMatch;
    }
    return rowPortalId === portalId || rowPortalId === null || sourceMatch;
  }

  if (publicOnlyWhenNoPortal) {
    return rowPortalId === null;
  }

  return true;
}

export function filterRowsByFederatedPortalScope<T extends FederatedScopeRow>(
  rows: T[],
  options: FederatedPortalScopeOptions
): T[] {
  return rows.filter((row) => isRowInFederatedPortalScope(row, options));
}

export function isVenueCityInScope(
  venueCity: string | null | undefined,
  portalCity: string | null | undefined,
  options: CityFilterOptions = {}
): boolean {
  const { allowMissingCity = true } = options;

  if (!portalCity) return true;
  if (!venueCity) return allowMissingCity;

  const normalizedVenueCity = normalizeCity(venueCity);
  const normalizedPortalCity = normalizeCity(portalCity);

  if (!normalizedVenueCity) return allowMissingCity;
  if (!normalizedPortalCity) return true;

  if (normalizedPortalCity === "atlanta") {
    return (
      normalizedVenueCity.includes("atlanta") ||
      ATLANTA_METRO_CITIES.has(normalizedVenueCity)
    );
  }

  if (normalizedVenueCity === normalizedPortalCity) return true;
  const matcher = new RegExp(`\\b${escapeRegex(normalizedPortalCity)}\\b`);
  return matcher.test(normalizedVenueCity);
}

export function filterByPortalCity<
  T extends { venue?: { city?: string | null } | null }
>(
  rows: T[],
  portalCity: string | null | undefined,
  options: CityFilterOptions = {}
): T[] {
  if (!portalCity) return rows;
  return rows.filter((row) =>
    isVenueCityInScope(row.venue?.city, portalCity, options)
  );
}

// ---------------------------------------------------------------------------
// Portal Content Filters
// ---------------------------------------------------------------------------

export type PortalContentFilters = {
  categories?: string[];
  exclude_categories?: string[];
  neighborhoods?: string[];
  geo_center?: [number, number];
  geo_radius_km?: number;
  price_max?: number;
  venue_ids?: number[];
  tags?: string[];
};

/**
 * Parse the raw portal.filters JSONB column into a typed PortalContentFilters.
 */
export function parsePortalContentFilters(
  raw: Record<string, unknown> | string | null | undefined
): PortalContentFilters {
  if (!raw) return {};

  let obj: Record<string, unknown>;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch {
      return {};
    }
  } else {
    obj = raw;
  }

  const result: PortalContentFilters = {};

  if (Array.isArray(obj.categories) && obj.categories.length > 0) {
    result.categories = obj.categories.filter((v): v is string => typeof v === "string");
  }
  if (Array.isArray(obj.exclude_categories) && obj.exclude_categories.length > 0) {
    result.exclude_categories = obj.exclude_categories.filter((v): v is string => typeof v === "string");
  }
  if (Array.isArray(obj.neighborhoods) && obj.neighborhoods.length > 0) {
    result.neighborhoods = obj.neighborhoods.filter((v): v is string => typeof v === "string");
  }
  if (Array.isArray(obj.geo_center) && obj.geo_center.length === 2) {
    const lat = Number(obj.geo_center[0]);
    const lng = Number(obj.geo_center[1]);
    if (!isNaN(lat) && !isNaN(lng)) {
      result.geo_center = [lat, lng];
    }
  }
  if (typeof obj.geo_radius_km === "number" && obj.geo_radius_km > 0) {
    result.geo_radius_km = obj.geo_radius_km;
  }
  if (typeof obj.price_max === "number" && obj.price_max > 0) {
    result.price_max = obj.price_max;
  }
  if (Array.isArray(obj.venue_ids) && obj.venue_ids.length > 0) {
    result.venue_ids = obj.venue_ids.filter(
      (v): v is number => typeof v === "number" && Number.isInteger(v) && v > 0
    );
  }
  if (Array.isArray(obj.tags) && obj.tags.length > 0) {
    result.tags = obj.tags.filter((v): v is string => typeof v === "string");
  }

  return result;
}

/**
 * Apply category/exclude_categories filters at the Supabase query level.
 * Call this BEFORE executing the query. Only applies when no explicit user
 * category filter is already active.
 */
export function applyPortalCategoryFilters<T>(
  query: T,
  filters: PortalContentFilters,
  opts: { userCategoriesActive?: boolean } = {}
): T {
  type QueryLike = {
    in: (column: string, values: string[]) => T;
    not: (column: string, operator: string, value: string) => T;
  };
  const q = query as unknown as QueryLike;

  // Include categories (only if user hasn't set their own filter)
  if (!opts.userCategoriesActive && filters.categories?.length) {
    query = q.in("category_id", filters.categories);
  }

  // Exclude categories always apply
  if (filters.exclude_categories?.length) {
    // Supabase .not("column", "in", "(val1,val2)")
    query = (query as unknown as QueryLike).not(
      "category_id",
      "in",
      `(${filters.exclude_categories.join(",")})`
    );
  }

  return query;
}

/**
 * Haversine distance in kilometers between two lat/lng points.
 */
function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

type EventLikeRow = {
  category?: string | null;
  tags?: string[] | null;
  price?: number | null;
  venue?: {
    id?: number | null;
    neighborhood?: string | null;
    lat?: number | null;
    lng?: number | null;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
};

/**
 * Post-query filter for portal content filters that can't be expressed
 * as simple Supabase query predicates (geo, neighborhoods, tags, venue_ids, price).
 *
 * Returns only events that match ALL specified filters.
 */
export function filterByPortalContentScope<T extends EventLikeRow>(
  rows: T[],
  filters: PortalContentFilters
): T[] {
  const hasGeo = filters.geo_center && filters.geo_radius_km;
  const hasNeighborhoods = filters.neighborhoods && filters.neighborhoods.length > 0;
  const hasTags = filters.tags && filters.tags.length > 0;
  const hasVenueIds = filters.venue_ids && filters.venue_ids.length > 0;
  const hasPriceMax = typeof filters.price_max === "number";

  // Short-circuit if nothing to filter
  if (!hasGeo && !hasNeighborhoods && !hasTags && !hasVenueIds && !hasPriceMax) {
    return rows;
  }

  const neighborhoodSet = hasNeighborhoods
    ? new Set(filters.neighborhoods!.map((n) => n.toLowerCase()))
    : null;
  const tagSet = hasTags ? new Set(filters.tags!.map((t) => t.toLowerCase())) : null;
  const venueIdSet = hasVenueIds ? new Set(filters.venue_ids!) : null;

  return rows.filter((row) => {
    // Geo filter: venue must be within radius of geo_center
    if (hasGeo && filters.geo_center && filters.geo_radius_km) {
      const venueLat = row.venue?.lat;
      const venueLng = row.venue?.lng;
      if (typeof venueLat === "number" && typeof venueLng === "number") {
        const dist = haversineDistanceKm(
          filters.geo_center[0],
          filters.geo_center[1],
          venueLat,
          venueLng
        );
        if (dist > filters.geo_radius_km) return false;
      }
      // If venue has no coordinates, let it through (don't exclude data we can't measure)
    }

    // Neighborhood filter
    if (neighborhoodSet) {
      const venueHood = row.venue?.neighborhood;
      if (venueHood && !neighborhoodSet.has(venueHood.toLowerCase())) {
        return false;
      }
      // No neighborhood on venue = let it through
    }

    // Tags filter: event must have at least one matching tag
    if (tagSet) {
      const eventTags = row.tags;
      if (eventTags && eventTags.length > 0) {
        const hasMatch = eventTags.some((t) => tagSet.has(t.toLowerCase()));
        if (!hasMatch) return false;
      }
      // No tags on event = let it through
    }

    // Venue ID filter
    if (venueIdSet) {
      const venueId = row.venue?.id;
      if (typeof venueId === "number" && !venueIdSet.has(venueId)) {
        return false;
      }
    }

    // Price filter
    if (hasPriceMax) {
      const price = row.price;
      if (typeof price === "number" && price > filters.price_max!) {
        return false;
      }
    }

    return true;
  });
}
