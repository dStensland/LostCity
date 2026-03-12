import { isValidUUID, type AnySupabase } from "@/lib/api-utils";
import { resolvePortalSlugAlias } from "@/lib/portal-aliases";
import { getSharedCacheJson, setSharedCacheJson } from "@/lib/shared-cache";

export type PortalFilters = {
  categories?: string[];
  exclude_categories?: string[];
  neighborhoods?: string[];
  city?: string;
  cities?: string[];
  geo_center?: [number, number];
  geo_radius_km?: number;
  price_max?: number;
  venue_ids?: number[];
  tags?: string[];
};

export type PortalQueryContext = {
  portalId: string | null;
  portalSlug: string | null;
  filters: PortalFilters;
  hasPortalParamMismatch: boolean;
  /** Raw portal settings JSONB — use instead of slug comparisons for feature flags */
  portalSettings: Record<string, unknown>;
};

const PORTAL_QUERY_CACHE_NAMESPACE = "portal-query-context";
const PORTAL_QUERY_CACHE_TTL_MS = 5 * 60 * 1000;

type CachedPortalRow = {
  id: string;
  slug: string;
  filters: PortalFilters;
  portalSettings: Record<string, unknown>;
};

type RequestedPortalRef = {
  portalSlug: string | null;
  portalId: string | null;
  portalIdParam: string | null;
};

function parsePortalFilters(raw: unknown): PortalFilters {
  if (!raw) return {};

  let parsed: unknown = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return {};
    }
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {};
  }

  const obj = parsed as Record<string, unknown>;

  const categories = Array.isArray(obj.categories)
    ? obj.categories.filter((value): value is string => typeof value === "string")
    : undefined;
  const exclude_categories = Array.isArray(obj.exclude_categories)
    ? obj.exclude_categories.filter((value): value is string => typeof value === "string")
    : undefined;
  const neighborhoods = Array.isArray(obj.neighborhoods)
    ? obj.neighborhoods.filter((value): value is string => typeof value === "string")
    : undefined;
  const city = typeof obj.city === "string" ? obj.city : undefined;
  const cities = Array.isArray(obj.cities)
    ? obj.cities.filter((value): value is string => typeof value === "string")
    : undefined;

  let geo_center: [number, number] | undefined;
  if (Array.isArray(obj.geo_center) && obj.geo_center.length === 2) {
    const lat = Number(obj.geo_center[0]);
    const lng = Number(obj.geo_center[1]);
    if (!isNaN(lat) && !isNaN(lng)) geo_center = [lat, lng];
  }
  const geo_radius_km = typeof obj.geo_radius_km === "number" && obj.geo_radius_km > 0
    ? obj.geo_radius_km : undefined;
  const price_max = typeof obj.price_max === "number" && obj.price_max > 0
    ? obj.price_max : undefined;
  const venue_ids = Array.isArray(obj.venue_ids)
    ? obj.venue_ids.filter((v): v is number => typeof v === "number" && Number.isInteger(v) && v > 0)
    : undefined;
  const tags = Array.isArray(obj.tags)
    ? obj.tags.filter((value): value is string => typeof value === "string")
    : undefined;

  return {
    categories, exclude_categories, neighborhoods, city, cities,
    geo_center, geo_radius_km, price_max,
    venue_ids: venue_ids?.length ? venue_ids : undefined,
    tags: tags?.length ? tags : undefined,
  };
}

function getRequestedPortalRef(searchParams: URLSearchParams): RequestedPortalRef {
  const portalParam = searchParams.get("portal")?.trim() || null;
  const portalIdParam = searchParams.get("portal_id")?.trim() || null;

  let portalSlug: string | null = null;
  let portalId: string | null = isValidUUID(portalIdParam) ? portalIdParam : null;

  if (portalParam) {
    if (isValidUUID(portalParam)) {
      portalId = portalId || portalParam;
    } else {
      portalSlug = resolvePortalSlugAlias(String(portalParam).toLowerCase());
    }
  }

  return {
    portalSlug,
    portalId,
    portalIdParam,
  };
}

function toPortalQueryContext(
  row: CachedPortalRow,
  portalIdParam: string | null,
): PortalQueryContext {
  return {
    portalId: row.id,
    portalSlug: row.slug,
    filters: row.filters,
    portalSettings: row.portalSettings ?? {},
    hasPortalParamMismatch:
      Boolean(portalIdParam && isValidUUID(portalIdParam) && row.id !== portalIdParam),
  };
}

function emptyPortalQueryContext(portalSlug: string | null): PortalQueryContext {
  return {
    portalId: null,
    portalSlug,
    filters: {},
    portalSettings: {},
    hasPortalParamMismatch: false,
  };
}

async function readCachedPortal(cacheKey: string): Promise<CachedPortalRow | null> {
  return getSharedCacheJson<CachedPortalRow>(PORTAL_QUERY_CACHE_NAMESPACE, cacheKey);
}

async function writeCachedPortal(row: CachedPortalRow): Promise<void> {
  await Promise.all([
    setSharedCacheJson(
      PORTAL_QUERY_CACHE_NAMESPACE,
      `slug:${row.slug}`,
      row,
      PORTAL_QUERY_CACHE_TTL_MS,
      { maxEntries: 400 },
    ),
    setSharedCacheJson(
      PORTAL_QUERY_CACHE_NAMESPACE,
      `id:${row.id}`,
      row,
      PORTAL_QUERY_CACHE_TTL_MS,
      { maxEntries: 400 },
    ),
  ]);
}

export async function getCachedPortalQueryContext(
  searchParams: URLSearchParams,
): Promise<PortalQueryContext | null> {
  const { portalSlug, portalId, portalIdParam } = getRequestedPortalRef(searchParams);

  if (!portalSlug && !portalId) {
    return emptyPortalQueryContext(null);
  }

  if (portalSlug) {
    const cachedRow = await readCachedPortal(`slug:${portalSlug}`);
    if (cachedRow) {
      return toPortalQueryContext(cachedRow, portalIdParam);
    }
  }

  if (portalId) {
    const cachedRow = await readCachedPortal(`id:${portalId}`);
    if (cachedRow) {
      return {
        ...toPortalQueryContext(cachedRow, portalIdParam),
        hasPortalParamMismatch: false,
      };
    }
  }

  return null;
}

/**
 * Canonical portal query semantics:
 * - `portal` => slug
 * - `portal_id` => UUID
 *
 * For backwards compatibility we also accept legacy UUID in `portal`.
 */
export async function resolvePortalQueryContext(
  supabase: AnySupabase,
  searchParams: URLSearchParams
): Promise<PortalQueryContext> {
  const { portalSlug, portalId, portalIdParam } = getRequestedPortalRef(searchParams);

  type PortalRow = {
    id: string;
    slug: string;
    filters: Record<string, unknown> | string | null;
    settings: Record<string, unknown> | null;
  };

  // Slug takes precedence when both slug and UUID are present.
  if (portalSlug) {
    const cachedRow = await readCachedPortal(`slug:${portalSlug}`);
    if (cachedRow) {
      return toPortalQueryContext(cachedRow, portalIdParam);
    }

    const { data } = await supabase
      .from("portals")
      .select("id, slug, filters, settings")
      .eq("slug", portalSlug)
      .eq("status", "active")
      .maybeSingle();

    const row = data as PortalRow | null;
    if (row) {
      const parsedFilters = parsePortalFilters(row.filters);
      const portalSettings = row.settings ?? {};
      void writeCachedPortal({
        id: row.id,
        slug: row.slug,
        filters: parsedFilters,
        portalSettings,
      });
      return {
        portalId: row.id,
        portalSlug: row.slug,
        filters: parsedFilters,
        portalSettings,
        hasPortalParamMismatch: Boolean(portalIdParam && isValidUUID(portalIdParam) && row.id !== portalIdParam),
      };
    }
  }

  if (portalId) {
    const cachedRow = await readCachedPortal(`id:${portalId}`);
    if (cachedRow) {
      return {
        ...toPortalQueryContext(cachedRow, portalIdParam),
        hasPortalParamMismatch: false,
      };
    }

    const { data } = await supabase
      .from("portals")
      .select("id, slug, filters, settings")
      .eq("id", portalId)
      .eq("status", "active")
      .maybeSingle();

    const row = data as PortalRow | null;
    if (row) {
      const parsedFilters = parsePortalFilters(row.filters);
      const portalSettings = row.settings ?? {};
      void writeCachedPortal({
        id: row.id,
        slug: row.slug,
        filters: parsedFilters,
        portalSettings,
      });
      return {
        portalId: row.id,
        portalSlug: row.slug,
        filters: parsedFilters,
        portalSettings,
        hasPortalParamMismatch: false,
      };
    }
  }

  return emptyPortalQueryContext(portalSlug);
}
