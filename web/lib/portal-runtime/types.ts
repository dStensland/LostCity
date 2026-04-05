import type { Portal, PortalBranding } from "@/lib/portal-context";
import type { PortalVertical } from "@/lib/portal-taxonomy";

export type PortalSurface = "feed" | "explore" | "detail" | "community";
export type PortalSurfaceCacheMode = "revalidate" | "dynamic";

export type HeaderGetter = Pick<Headers, "get">;

export interface PortalSurfaceRuntimePolicy {
  surface: PortalSurface;
  cacheMode: PortalSurfaceCacheMode;
  revalidateSeconds: number | null;
  requiresSharedChrome: boolean;
  supportsOverlayEntry: boolean;
  showTracker: boolean;
  showCannyWidget: boolean;
}

export interface PortalResolvedRequest {
  portal: Portal;
  slug: string;
  surface: PortalSurface;
  vertical: PortalVertical;
  effectiveVertical: PortalVertical | "marketplace";
  subdomainVertical: string | null;
  isExclusive: boolean;
  isHotel: boolean;
  isFilm: boolean;
  isMarketplace: boolean;
  isCommunity: boolean;
  isDog: boolean;
  isFamily: boolean;
  isAdventure: boolean;
  disableAmbientEffects: boolean;
  resolvedBranding: PortalBranding;
  isLightTheme: boolean;
  runtimePolicy: PortalSurfaceRuntimePolicy;
}

export interface PortalChromePolicy {
  showHeader: boolean;
  showFooter: boolean;
  showTracker: boolean;
  showCannyWidget: boolean;
}

export interface PortalSurfaceRouteMatch {
  surface: PortalSurface;
  isLegacyExplore: boolean;
}

export interface PortalSurfaceLayoutProps {
  request: PortalResolvedRequest;
  children: React.ReactNode;
}

export const RESERVED_PORTAL_ROUTE_SLUGS = [
  "admin",
  "api",
  "auth",
  "calendar",
  "claim",
  "collections",
  "community",
  "dashboard",
  "data",
  "design",
  "events",
  "explore",
  "festivals",
  "find-friends",
  "foryou",
  "friends",
  "goblinday",
  "happening-now",
  "invite",
  "invite-friends",
  "logo-concepts",
  "notifications",
  "onboarding",
  "people",
  "plans",
  "privacy",
  "profile",
  "saved",
  "series",
  "settings",
  "spots",
  "submit",
  "terms",
  "venue",
  "welcome",
] as const;

export const LEGACY_EXPLORE_VIEWS = [
  "find",
  "happening",
  "places",
  "events",
  "spots",
  "map",
  "calendar",
] as const;

export const COMMUNITY_SURFACE_SEGMENTS = new Set([
  "best-of",
  "community",
  "community-hub",
  "contests",
  "curations",
  "groups",
  "lists",
  "saved",
  "support",
  "volunteer",
  "your-people",
]);

export const DETAIL_SURFACE_SEGMENTS = new Set([
  "events",
  "spots",
  "series",
  "festivals",
  "programs",
  "artists",
  "venues",
  "partners",
  "calendar",
  "showtimes",
]);
