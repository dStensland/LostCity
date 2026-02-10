import HotelConciergeFeed from "../_components/hotel/HotelConciergeFeed";
import type { Portal } from "@/lib/portal-context";

interface HotelTemplateProps {
  portal: Portal;
}

/**
 * Hotel template - luxury concierge guided experience
 * Shows tonight-first feed, hotel amenities, neighborhood venues, and curated picks
 */
export async function HotelTemplate({ portal }: HotelTemplateProps) {
  return <HotelConciergeFeed portal={portal} />;
}

export type { HotelTemplateProps };
