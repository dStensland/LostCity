import type { PortalSurface } from "./types";

export const PORTAL_SURFACE_REVALIDATE = {
  feed: 300,
  explore: 300,
  detail: 120,
  community: 180,
} as const satisfies Record<PortalSurface, number>;

export function getPortalSurfaceRevalidate(surface: PortalSurface): number {
  return PORTAL_SURFACE_REVALIDATE[surface];
}
