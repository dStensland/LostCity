import HotelConciergeFeed from "../_components/hotel/HotelConciergeFeed";
import TonightExperienceView from "../_components/hotel/forth/views/TonightExperienceView";
import { isForthVariantPortal } from "../_components/hotel/forth/server-utils";
import type { Portal } from "@/lib/portal-context";

interface HotelTemplateProps {
  portal: Portal;
}

/**
 * Hotel template - luxury concierge guided experience
 * Shows tonight-first feed, hotel amenities, neighborhood venues, and curated picks
 */
export async function HotelTemplate({ portal }: HotelTemplateProps) {
  const isForthVariant = isForthVariantPortal(portal);

  if (isForthVariant) {
    return <TonightExperienceView portal={portal} />;
  }

  return <HotelConciergeFeed portal={portal} />;
}

export type { HotelTemplateProps };
