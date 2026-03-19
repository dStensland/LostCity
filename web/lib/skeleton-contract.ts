import { coercePortalVertical } from "@/lib/portal-taxonomy";
import type { PortalVertical } from "@/lib/portal-taxonomy";

export const PORTAL_SKELETON_VERTICALS = [
  "city",
  "hotel",
  "film",
  "hospital",
  "adventure",
  "family",
] as const;

export type PortalSkeletonVertical = (typeof PORTAL_SKELETON_VERTICALS)[number];

export const PORTAL_SKELETON_ROUTES = [
  "portal-root",
  "feed-view",
  "find-view",
  "community-view",
  "event-detail",
  "happening-now",
] as const;

export type PortalSkeletonRoute = (typeof PORTAL_SKELETON_ROUTES)[number];

export const PORTAL_SKELETON_REGISTRY: Record<PortalSkeletonRoute, Record<PortalSkeletonVertical, string>> = {
  "portal-root": {
    city: "Default city feed shell loading state.",
    hotel: "Hotel concierge loading state.",
    film: "Film marquee loading state.",
    hospital: "Hospital care navigation loading state.",
    adventure: "Adventure destination explorer loading state.",
    family: "Family portal (Lost Youth) loading state.",
  },
  "feed-view": {
    city: "Default curated feed fallback.",
    hotel: "Hotel feed fallback.",
    film: "Film feed fallback.",
    hospital: "Hospital feed fallback.",
    adventure: "Adventure feed fallback.",
    family: "Family feed fallback.",
  },
  "find-view": {
    city: "Default find fallback.",
    hotel: "Hotel find fallback.",
    film: "Film find fallback.",
    hospital: "Hospital find fallback.",
    adventure: "Adventure find fallback.",
    family: "Family find fallback.",
  },
  "community-view": {
    city: "Default community fallback.",
    hotel: "Hotel community fallback.",
    film: "Film community fallback.",
    hospital: "Hospital community fallback.",
    adventure: "Adventure community fallback.",
    family: "Family community fallback.",
  },
  "event-detail": {
    city: "Default event detail fallback.",
    hotel: "Hotel event detail fallback.",
    film: "Film event detail fallback.",
    hospital: "Hospital event detail fallback.",
    adventure: "Adventure event detail fallback.",
    family: "Family event detail fallback.",
  },
  "happening-now": {
    city: "Default happening now fallback.",
    hotel: "Hotel happening now fallback.",
    film: "Film happening now fallback.",
    hospital: "Hospital happening now fallback.",
    adventure: "Adventure happening now fallback.",
    family: "Family happening now fallback.",
  },
};

type PortalLike = {
  settings?: {
    vertical?: PortalVertical | string | null;
  } | null;
} | null | undefined;

function isSupportedVertical(value: string): value is PortalSkeletonVertical {
  return PORTAL_SKELETON_VERTICALS.includes(value as PortalSkeletonVertical);
}

export function inferSkeletonVerticalFromSlug(slug: string): PortalSkeletonVertical {
  const normalized = slug.toLowerCase();
  if (normalized === "forth" || normalized.includes("hotel")) return "hotel";
  if (normalized.includes("film") || normalized.includes("cinema") || normalized.includes("movie")) return "film";
  if (normalized.includes("emory") || normalized.includes("hospital") || normalized.includes("health")) return "hospital";
  if (normalized.includes("yonder") || normalized.includes("adventure") || normalized.includes("track")) return "adventure";
  if (normalized.includes("famil") || normalized.includes("youth") || normalized.includes("hooky")) return "family";
  return "city";
}

export function resolveSkeletonVertical(portal: PortalLike, fallbackSlug: string): PortalSkeletonVertical {
  const configured = coercePortalVertical(portal?.settings?.vertical);
  if (configured && isSupportedVertical(configured)) {
    return configured;
  }
  return inferSkeletonVerticalFromSlug(fallbackSlug);
}
