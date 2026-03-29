/**
 * Pipeline stage 5: Section assembly.
 *
 * Takes raw event pools + enrichments and assembles the CityPulseSection[]
 * array. Also resolves curated sections and computes the "open destinations"
 * and "trending destinations" sub-lists.
 *
 * Pure data transformation — no DB access.
 */

import type { FeedEventData } from "@/components/EventCard";
import type { Spot } from "@/lib/spots-constants";
import type { CityPulseSection, CityPulseSpecialItem, FriendGoingInfo, EditorialMention } from "@/lib/city-pulse/types";
import type { FeedSectionData } from "@/components/feed/FeedSection";
import type { UserSignals } from "@/lib/city-pulse/types";
import type { PipelineContext } from "./resolve-portal";
import type { PhaseAEnrichments, PhaseBEnrichments } from "./fetch-enrichments";
import type { EventPools } from "./fetch-events";
import { applySocialProof } from "@/lib/city-pulse/counts";
import { resolveCuratedSections } from "@/lib/city-pulse/curated-sections";
import {
  buildBannerSection,
  buildRightNowSection,
  buildTonightSection,
  buildThemedSpecialsSection,
  buildWeatherDiscoverySection,
  buildYourPeopleSection,
  buildNewFromSpotsSection,
  buildTrendingSection,
  buildPlanningHorizonSection,
  buildBrowseSection,
  type EditorialMap,
} from "@/lib/city-pulse/section-builders";
import { getAllConversionPrompts } from "@/lib/city-pulse/conversion-prompts";
import type { PersonalizationLevel } from "@/lib/city-pulse/types";

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export type BuiltSections = {
  sections: CityPulseSection[];
  curatedSections: FeedSectionData[];
  personalizationLevel: PersonalizationLevel;
  todayEventsWithProof: FeedEventData[];
  trendingEventsWithProof: FeedEventData[];
};

// ---------------------------------------------------------------------------
// Stage function
// ---------------------------------------------------------------------------

/**
 * Assemble all feed sections from event pools, enrichments, and social proof.
 *
 * Steps:
 *  1. Apply social proof to event pools
 *  2. Resolve curated sections from the CMS
 *  3. Build "Your People" (friend RSVP) section inputs
 *  4. Derive trending/open destinations from weather venues + specials
 *  5. Call section builders
 *  6. Inject conversion prompts
 */
export function buildSections(
  ctx: PipelineContext,
  pools: EventPools,
  phaseA: PhaseAEnrichments,
  phaseB: PhaseBEnrichments,
  allEventCategoryCounts: Record<string, number>,
  venueTypeCounts: Record<string, number>,
): BuiltSections {
  const { activeSpecials, rawCuratedSections, weatherVenues, weatherFilter, userSignals } = phaseA;
  const { socialCounts, friendsGoingMap, newFromSpots, editorialMap } = phaseB;
  const { todayEvents, trendingEvents, horizonEvents } = pools;

  // Apply social proof to today and trending event pools
  const todayEventsWithProof = applySocialProof(todayEvents, socialCounts);
  const trendingEventsWithProof = applySocialProof(trendingEvents, socialCounts);

  // Resolve CMS curated sections against the event pool
  const curatedSections = resolveCuratedSections(
    rawCuratedSections,
    [...todayEventsWithProof, ...trendingEventsWithProof],
  );

  // Build "Your People" inputs: events with friends going
  const friendRsvpEvents: Array<{ event: FeedEventData; friends: FriendGoingInfo[] }> = [];
  if (Object.keys(friendsGoingMap).length > 0) {
    const eventMap = new Map(todayEventsWithProof.map((e) => [e.id, e]));
    for (const [eventIdStr, friends] of Object.entries(friendsGoingMap)) {
      const eventId = Number(eventIdStr);
      const event = eventMap.get(eventId);
      if (event && friends.length > 0) {
        friendRsvpEvents.push({ event, friends });
      }
    }
    friendRsvpEvents.sort((a, b) => b.friends.length - a.friends.length);
  }

  // Derive trending destinations (featured venues from the weather-matched pool)
  const trendingDestinations: Spot[] = weatherVenues
    .filter((v) => v.featured)
    .slice(0, 6);

  // Open destinations: venues with active specials as proxy for "open now"
  const openDestinations = activeSpecials
    .filter((s) => s.state === "active_now" && s.venue)
    .reduce((acc, s) => {
      if (!acc.some((d) => d.id === s.venue.id)) {
        acc.push({
          ...s.venue,
          address: null,
          city: null,
          lat: null,
          lng: null,
          short_description: null,
          vibes: null,
          genres: null,
          price_level: null,
          hours_display: null,
          featured: false,
          active: true,
          venue_types: null,
          location_designator: null,
          is_open: true,
        } as never);
      }
      return acc;
    }, [] as Array<Spot & { is_open: boolean }>)
    .slice(0, 4);

  // Build all sections
  const rawSections = [
    buildBannerSection(ctx.feedContext),
    buildRightNowSection(
      ctx.feedContext,
      { todayEvents: todayEventsWithProof, activeSpecials, openDestinations },
      userSignals,
      friendsGoingMap,
      editorialMap,
    ),
    buildTonightSection(
      ctx.feedContext,
      { todayEvents: todayEventsWithProof, activeSpecials },
      userSignals,
      friendsGoingMap,
      editorialMap,
    ),
    buildThemedSpecialsSection(ctx.feedContext, activeSpecials),
    buildWeatherDiscoverySection(
      ctx.feedContext,
      weatherVenues,
      weatherFilter?.label ?? "",
      weatherFilter?.subtitle ?? "",
      userSignals,
    ),
    buildYourPeopleSection({ friendRsvps: friendRsvpEvents }, editorialMap),
    buildNewFromSpotsSection(newFromSpots, editorialMap),
    buildTrendingSection(trendingEventsWithProof, trendingDestinations, userSignals, friendsGoingMap, editorialMap),
    buildPlanningHorizonSection(horizonEvents, editorialMap),
    buildBrowseSection(ctx.canonicalSlug, venueTypeCounts, allEventCategoryCounts, todayEventsWithProof),
  ].filter(Boolean) as CityPulseSection[];

  // Filter sections suppressed by the portal's content policy
  const { suppressedSections } = ctx.manifest.contentPolicy;
  const sections = suppressedSections.size > 0
    ? rawSections.filter((s) => !suppressedSections.has(s.type))
    : rawSections;

  // Compute personalization level
  const personalizationLevel: PersonalizationLevel = !ctx.userId
    ? "anonymous"
    : userSignals?.prefs?.favorite_categories?.length
      ? (userSignals.friendIds?.length ?? 0) > 0
        ? "has_social"
        : "has_prefs"
      : "logged_in";

  // Inject conversion prompts after their target sections
  const conversionPrompts = getAllConversionPrompts(personalizationLevel, ctx.canonicalSlug);
  for (const section of sections) {
    const prompt = conversionPrompts.get(section.type);
    if (prompt) {
      section.items.push(prompt);
    }
  }

  return {
    sections,
    curatedSections,
    personalizationLevel,
    todayEventsWithProof,
    trendingEventsWithProof,
  };
}
