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
