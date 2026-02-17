import { isValidUUID, type AnySupabase } from "@/lib/api-utils";
import { resolvePortalSlugAlias } from "@/lib/portal-aliases";

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

  // Slug takes precedence when both slug and UUID are present.
  if (portalSlug) {
    const { data } = await supabase
      .from("portals")
      .select("id, slug, filters")
      .eq("slug", portalSlug)
      .eq("status", "active")
      .maybeSingle();

    const row = data as PortalRow | null;
    if (row) {
      return {
        portalId: row.id,
        portalSlug: row.slug,
        filters: parsePortalFilters(row.filters),
        hasPortalParamMismatch: Boolean(portalIdParam && isValidUUID(portalIdParam) && row.id !== portalIdParam),
      };
    }
  }

  if (portalId) {
    const { data } = await supabase
      .from("portals")
      .select("id, slug, filters")
      .eq("id", portalId)
      .eq("status", "active")
      .maybeSingle();

    const row = data as PortalRow | null;
    if (row) {
      return {
        portalId: row.id,
        portalSlug: row.slug,
        filters: parsePortalFilters(row.filters),
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
