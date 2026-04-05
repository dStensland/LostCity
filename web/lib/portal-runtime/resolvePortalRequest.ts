import "server-only";

import { applyPreset } from "@/lib/apply-preset";
import { isPCMDemoPortal } from "@/lib/marketplace-art";
import {
  getCachedPortalBySlug,
  getCachedPortalByVerticalAndCity,
  getPortalVertical,
} from "@/lib/portal";
import {
  isFilmPortalVertical,
  shouldDisableAmbientEffects,
} from "@/lib/portal-taxonomy";
import type { PortalBranding } from "@/lib/portal-context";
import { resolvePortalRuntimePolicy } from "./resolvePortalRuntimePolicy";
import { resolvePortalSurface } from "./resolvePortalSurface";
import type {
  HeaderGetter,
  PortalResolvedRequest,
  PortalSurface,
} from "./types";

interface ResolvePortalRequestArgs {
  slug: string;
  headersList?: HeaderGetter | null;
  pathname?: string;
  searchParams?: URLSearchParams;
  surface?: PortalSurface;
}

export async function resolvePortalRequest({
  slug,
  headersList,
  pathname,
  searchParams,
  surface,
}: ResolvePortalRequestArgs): Promise<PortalResolvedRequest | null> {
  const subdomainVertical = headersList?.get("x-lc-vertical") ?? null;

  let portal = subdomainVertical
    ? await getCachedPortalByVerticalAndCity(subdomainVertical, slug)
    : null;

  if (!portal) {
    portal = await getCachedPortalBySlug(slug);
  }

  if (!portal) {
    return null;
  }

  const vertical = getPortalVertical(portal);
  const isHotel = vertical === "hotel";
  const isFilm = isFilmPortalVertical(vertical);
  const isMarketplace = vertical === "marketplace" || isPCMDemoPortal(portal.slug);
  const isCommunity = vertical === "community";
  const isDog = vertical === "dog";
  const isFamily = vertical === "family";
  const isAdventure = vertical === "adventure";
  const effectiveVertical = isMarketplace ? "marketplace" : vertical;
  const resolvedBranding = applyPreset((portal.branding || {}) as PortalBranding) as PortalBranding;
  const routeMatch = resolvePortalSurface({
    pathname,
    searchParams,
    surfaceHint: surface,
  });
  const baseRequest = {
    portal,
    slug,
    vertical,
    surface: routeMatch.surface,
    effectiveVertical,
    subdomainVertical,
    isExclusive: portal.portal_type === "business" && !portal.parent_portal_id,
    isHotel,
    isFilm,
    isMarketplace,
    isCommunity,
    isDog,
    isFamily,
    isAdventure,
    disableAmbientEffects: shouldDisableAmbientEffects(vertical),
    resolvedBranding,
    isLightTheme: resolvedBranding.theme_mode === "light",
  } satisfies Omit<PortalResolvedRequest, "runtimePolicy">;

  return {
    ...baseRequest,
    runtimePolicy: resolvePortalRuntimePolicy({
      surface: routeMatch.surface,
      request: baseRequest,
    }),
  };
}
