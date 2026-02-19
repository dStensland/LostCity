import { isValidUUID, type AnySupabase } from "@/lib/api-utils";
import { resolvePortalSlugAlias } from "@/lib/portal-aliases";
import { getSharedCacheJson, setSharedCacheJson } from "@/lib/shared-cache";

export type PortalFilters = {
  categories?: string[];
  neighborhoods?: string[];
  city?: string;
  cities?: string[];
};

export type PortalQueryContext = {
  portalId: string | null;
  portalSlug: string | null;
  filters: PortalFilters;
  hasPortalParamMismatch: boolean;
};

const PORTAL_QUERY_CACHE_NAMESPACE = "portal-query-context";
const PORTAL_QUERY_CACHE_TTL_MS = 5 * 60 * 1000;

type CachedPortalRow = {
  id: string;
  slug: string;
  filters: PortalFilters;
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
  const neighborhoods = Array.isArray(obj.neighborhoods)
    ? obj.neighborhoods.filter((value): value is string => typeof value === "string")
    : undefined;
  const city = typeof obj.city === "string" ? obj.city : undefined;
  const cities = Array.isArray(obj.cities)
    ? obj.cities.filter((value): value is string => typeof value === "string")
    : undefined;

  return { categories, neighborhoods, city, cities };
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
  const portalParam = searchParams.get("portal")?.trim() || null;
  const portalIdParam = searchParams.get("portal_id")?.trim() || null;

  let portalSlug: string | null = null;
  let portalId: string | null = isValidUUID(portalIdParam) ? portalIdParam : null;

  if (portalParam) {
    if (isValidUUID(portalParam)) {
      // Legacy input support: treat `portal=<uuid>` as `portal_id=<uuid>`.
      portalId = portalId || portalParam;
    } else {
      portalSlug = resolvePortalSlugAlias((portalParam as string).toLowerCase());
    }
  }

  type PortalRow = {
    id: string;
    slug: string;
    filters: Record<string, unknown> | string | null;
  };

  const readCachedPortal = async (cacheKey: string): Promise<CachedPortalRow | null> =>
    getSharedCacheJson<CachedPortalRow>(PORTAL_QUERY_CACHE_NAMESPACE, cacheKey);

  const writeCachedPortal = async (row: CachedPortalRow): Promise<void> => {
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
  };

  // Slug takes precedence when both slug and UUID are present.
  if (portalSlug) {
    const cachedRow = await readCachedPortal(`slug:${portalSlug}`);
    if (cachedRow) {
      return {
        portalId: cachedRow.id,
        portalSlug: cachedRow.slug,
        filters: cachedRow.filters,
        hasPortalParamMismatch:
          Boolean(portalIdParam && isValidUUID(portalIdParam) && cachedRow.id !== portalIdParam),
      };
    }

    const { data } = await supabase
      .from("portals")
      .select("id, slug, filters")
      .eq("slug", portalSlug)
      .eq("status", "active")
      .maybeSingle();

    const row = data as PortalRow | null;
    if (row) {
      const parsedFilters = parsePortalFilters(row.filters);
      void writeCachedPortal({
        id: row.id,
        slug: row.slug,
        filters: parsedFilters,
      });
      return {
        portalId: row.id,
        portalSlug: row.slug,
        filters: parsedFilters,
        hasPortalParamMismatch: Boolean(portalIdParam && isValidUUID(portalIdParam) && row.id !== portalIdParam),
      };
    }
  }

  if (portalId) {
    const cachedRow = await readCachedPortal(`id:${portalId}`);
    if (cachedRow) {
      return {
        portalId: cachedRow.id,
        portalSlug: cachedRow.slug,
        filters: cachedRow.filters,
        hasPortalParamMismatch: false,
      };
    }

    const { data } = await supabase
      .from("portals")
      .select("id, slug, filters")
      .eq("id", portalId)
      .eq("status", "active")
      .maybeSingle();

    const row = data as PortalRow | null;
    if (row) {
      const parsedFilters = parsePortalFilters(row.filters);
      void writeCachedPortal({
        id: row.id,
        slug: row.slug,
        filters: parsedFilters,
      });
      return {
        portalId: row.id,
        portalSlug: row.slug,
        filters: parsedFilters,
        hasPortalParamMismatch: false,
      };
    }
  }

  return {
    portalId: null,
    portalSlug: portalSlug,
    filters: {},
    hasPortalParamMismatch: false,
  };
}
