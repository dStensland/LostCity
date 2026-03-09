import HotelConciergeFeed from "../_components/hotel/HotelConciergeFeed";
import DiscoverExperience from "../_components/concierge/DiscoverExperience";
import { isConciergePortal } from "@/lib/concierge/concierge-config";
import type { Portal } from "@/lib/portal-context";

interface HotelTemplateProps {
  portal: Portal;
}

/**
 * Hotel template - luxury concierge guided experience.
 * FORTH-variant portals use the single-surface Discover feed.
 * Falls back to HotelConciergeFeed for non-FORTH hotel portals.
 */
export async function HotelTemplate({ portal }: HotelTemplateProps) {
  if (isConciergePortal(portal)) {
    return <DiscoverExperience portal={portal} />;
  }

  return <HotelConciergeFeed portal={portal} />;
}

export type { HotelTemplateProps };
