/**
 * Concierge Data Layer
 *
 * Wraps forth-data.ts functions with concierge-typed interfaces.
 * All functions run server-side and return pre-computed data for client components.
 */

import type { Portal } from "@/lib/portal-context";
import type {
  ConciergePillarData,
  ConciergeExperienceData,
  ServicesPillarData,
  AroundYouPillarData,
  PlannerPillarData,
} from "./concierge-types";
import type { WeatherData } from "@/lib/weather-utils";
import type { AgentNarrative } from "@/lib/forth-types";
import { getForthFeed, getForthPropertyData } from "@/lib/forth-data";
import { getPortalWeather } from "@/lib/weather";
import { getConciergeConfig } from "./concierge-config";
import { buildAmbientContext } from "./ambient-context";

/**
 * Fetch all concierge data in parallel. This is the single entry point
 * for server components to get everything needed for the concierge experience.
 */
export async function getConciergeExperienceData(
  portal: Portal
): Promise<ConciergeExperienceData> {
  const now = new Date();
  const dayOfWeek = now.getDay();

  // Fetch all data in parallel
  const geoCenter = portal.filters?.geo_center;
  const [feedData, weather] = await Promise.all([
    getForthFeed(portal),
    geoCenter?.[0] && geoCenter?.[1]
      ? getPortalWeather(portal.id, geoCenter[0], geoCenter[1])
      : Promise.resolve(null as WeatherData | null),
  ]);

  const propertyData = getForthPropertyData(portal);
  const { sections, destinations, liveDestinations, specialsMeta, agentNarrative } = feedData;
  const { signatureVenues, amenities, inRoomServices, conciergePhone } = propertyData;

  // Find tonight events (no fallback — empty is fine if no tonight section exists)
  const tonightSection = sections.find(
    (s) => s.slug === "tonight" || s.slug === "today" || s.slug === "this-evening"
  );
  const tonightEvents = tonightSection?.events || [];

  // Build pillar data
  const pillarData: ConciergePillarData = {
    services: {
      signatureVenues,
      amenities,
      inRoomServices,
      conciergePhone,
    } satisfies ServicesPillarData,
    around: {
      destinations,
      liveDestinations,
      tonightEvents,
      specialsMeta,
      sections,
      dayOfWeek,
    } satisfies AroundYouPillarData,
    planner: {
      sections,
    } satisfies PlannerPillarData,
  };

  // Build ambient context
  const ambient = buildAmbientContext(now, weather, portal.name);

  // Build config
  const config = getConciergeConfig(portal, conciergePhone);

  return {
    config,
    pillarData,
    ambient,
    agentNarrative: agentNarrative as AgentNarrative | null,
  };
}
