import type {
  PortalResolvedRequest,
  PortalSurface,
  PortalSurfaceRuntimePolicy,
} from "./types";
import { getPortalSurfaceRevalidate } from "./surface-runtime";

interface ResolvePortalRuntimePolicyArgs {
  surface: PortalSurface;
  request: Omit<PortalResolvedRequest, "surface" | "runtimePolicy">;
}

export function resolvePortalRuntimePolicy({
  surface,
  request,
}: ResolvePortalRuntimePolicyArgs): PortalSurfaceRuntimePolicy {
  const requiresSharedChrome =
    !request.isHotel &&
    !request.isMarketplace &&
    !request.isFilm &&
    !request.isDog;

  return {
    surface,
    cacheMode: "revalidate",
    revalidateSeconds: getPortalSurfaceRevalidate(surface),
    requiresSharedChrome,
    supportsOverlayEntry: surface === "feed" || surface === "explore",
    showTracker: surface !== "explore",
    showCannyWidget:
      (surface === "feed" || surface === "community") &&
      !request.isHotel &&
      !request.isMarketplace,
  };
}
