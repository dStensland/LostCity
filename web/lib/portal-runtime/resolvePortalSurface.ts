import type { PortalSurface, PortalSurfaceRouteMatch } from "./types";
import {
  COMMUNITY_SURFACE_SEGMENTS,
  DETAIL_SURFACE_SEGMENTS,
  LEGACY_EXPLORE_VIEWS,
} from "./types";

interface ResolvePortalSurfaceArgs {
  pathname?: string;
  searchParams?: URLSearchParams;
  surfaceHint?: string | null;
}

function isExploreQuery(searchParams: URLSearchParams | undefined): boolean {
  if (!searchParams) return false;

  const requestedView = searchParams.get("view");

  return (
    (requestedView !== null &&
      (LEGACY_EXPLORE_VIEWS as readonly string[]).includes(requestedView)) ||
    searchParams.has("lane") ||
    searchParams.has("q") ||
    searchParams.has("display")
  );
}

export function resolvePortalSurface({
  pathname,
  searchParams,
  surfaceHint,
}: ResolvePortalSurfaceArgs): PortalSurfaceRouteMatch {
  const hintedSurface =
    surfaceHint === "feed" ||
    surfaceHint === "explore" ||
    surfaceHint === "detail" ||
    surfaceHint === "community"
      ? (surfaceHint as PortalSurface)
      : null;

  if (hintedSurface) {
    return {
      surface: hintedSurface,
      isLegacyExplore: false,
    };
  }

  const segments = pathname
    ? pathname.split("/").filter(Boolean)
    : [];
  const childSegment = segments[1] ?? null;

  if (childSegment === "explore" || childSegment === "map" || isExploreQuery(searchParams)) {
    return {
      surface: "explore",
      isLegacyExplore: childSegment !== "explore" && childSegment !== "map" && isExploreQuery(searchParams),
    };
  }

  if (childSegment && COMMUNITY_SURFACE_SEGMENTS.has(childSegment)) {
    return {
      surface: "community",
      isLegacyExplore: false,
    };
  }

  if (childSegment && DETAIL_SURFACE_SEGMENTS.has(childSegment)) {
    return {
      surface: "detail",
      isLegacyExplore: false,
    };
  }

  return {
    surface: "feed",
    isLegacyExplore: false,
  };
}
