import HotelConciergeFeed from "../_components/hotel/HotelConciergeFeed";
import ForthConciergeExperience from "../_components/hotel/ForthConciergeExperience";
import type { Portal } from "@/lib/portal-context";

interface HotelTemplateProps {
  portal: Portal;
}

/**
 * Hotel template - luxury concierge guided experience
 * Shows tonight-first feed, hotel amenities, neighborhood venues, and curated picks
 */
export async function HotelTemplate({ portal }: HotelTemplateProps) {
  const variant = typeof portal.settings?.experience_variant === "string"
    ? portal.settings.experience_variant.toLowerCase()
    : "";
  const isForthVariant = portal.slug === "forth" || variant === "forth" || variant === "forth_signature";

  if (isForthVariant) {
    return <ForthConciergeExperience portal={portal} />;
  }

  return <HotelConciergeFeed portal={portal} />;
}

export type { HotelTemplateProps };
