import HotelConciergeFeed from "../_components/hotel/HotelConciergeFeed";
import ConciergeExperience from "../_components/concierge/ConciergeExperience";
import { isConciergePortal } from "@/lib/concierge/concierge-config";
import type { Portal } from "@/lib/portal-context";
import type { Pillar } from "@/lib/concierge/concierge-types";

interface HotelTemplateProps {
  portal: Portal;
  initialPillar?: Pillar;
}

/**
 * Hotel template - luxury concierge guided experience
 * Uses the concierge framework for FORTH-variant portals,
 * falls back to HotelConciergeFeed for others.
 */
export async function HotelTemplate({ portal, initialPillar }: HotelTemplateProps) {
  if (isConciergePortal(portal)) {
    return <ConciergeExperience portal={portal} initialPillar={initialPillar} />;
  }

  return <HotelConciergeFeed portal={portal} />;
}

export type { HotelTemplateProps };
