/**
 * fetch-destinations.ts
 *
 * Shared destinations-fetching logic used by both:
 *   - GET /api/portals/[slug]/destinations (standalone route)
 *   - GET /api/portals/[slug]/city-pulse   (embedded in full feed response)
 *
 * Steps:
 *   1. Query venue_occasions for current time slot
 *   2. (Parallel) Fetch venue details + editorial mentions for matched IDs
 *   3. Merge, filter open-now, sort, enforce diversity, limit to 6
 *   4. Fallback path (parallel): editorial mentions + venue lookup
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { isOpenAt, type HoursData } from "@/lib/hours";

// ── Types ──────────────────────────────────────────────────────────────────────

export type TimeSlot =
  | "morning"
  | "midday"
  | "happy_hour"
  | "evening"
  | "late_night";

export interface DestinationItem {
  venue: {
    id: number;
    name: string;
    slug: string | null;
    neighborhood: string | null;
    place_type: string | null;
    image_url: string | null;
  };
  occasion: string;
  contextual_label: string;
  editorial_quote: { snippet: string; source: string } | null;
}

/** Local shape for a row fetched from the places table (Deploy 10: venue_* renamed). */
type PlaceRow = {
  id: number;
  name: string;
  slug: string | null;
  neighborhood: string | null;
  place_type: string | null;
  image_url: string | null;
  hours: HoursData | null;
};

type MentionRow = {
  place_id: number;
  source_key: string;
  snippet: string;
};

// ── Time slot detection ────────────────────────────────────────────────────────

export function getDestinationsTimeSlot(now: Date): TimeSlot {
  const hour = now.getHours();
  if (hour < 11) return "morning";
  if (hour < 16) return "midday";
  if (hour < 18) return "happy_hour";
  if (hour < 22) return "evening";
  return "late_night";
}

export function isWeekend(now: Date): boolean {
  const day = now.getDay(); // 0=Sun, 6=Sat
  return day === 0 || day === 6;
}

// ── Time slot → occasion mapping ───────────────────────────────────────────────

export function getOccasionsForTimeSlot(slot: TimeSlot, weekend: boolean): string[] {
  if (weekend && slot === "morning") {
    return ["brunch", "outdoor_dining", "family_friendly"];
  }
  switch (slot) {
    case "morning":
      return []; // morning weekday — fall back to editorial
    case "midday":
      return ["quick_bite", "outdoor_dining"];
    case "happy_hour":
      return ["outdoor_dining", "pre_game"];
    case "evening":
      return ["date_night", "live_music", "late_night"];
    case "late_night":
      return ["late_night", "dancing"];
  }
}

// ── Occasion → contextual label ────────────────────────────────────────────────

export function getContextualLabel(occasion: string): string {
  const labels: Record<string, string> = {
    date_night: "PERFECT FOR DATE NIGHT",
    brunch: "GREAT FOR BRUNCH",
    late_night: "LATE NIGHT SPOT",
    live_music: "LIVE MUSIC VENUE",
    outdoor_dining: "OUTDOOR DINING",
    dancing: "DANCE THE NIGHT AWAY",
    quick_bite: "QUICK BITE",
    pre_game: "PRE-GAME SPOT",
    family_friendly: "FAMILY FRIENDLY",
    groups: "GREAT FOR GROUPS",
    solo: "SOLO FRIENDLY",
    special_occasion: "FOR SPECIAL OCCASIONS",
    dog_friendly: "DOG FRIENDLY",
    beltline: "BELTLINE ADJACENT",
  };
  return labels[occasion] ?? "WORTH CHECKING OUT";
}

// ── Editorial snippet quality filter ──────────────────────────────────────────

const LOW_QUALITY_SNIPPET_PATTERNS = [
  /^in addition to/i,
  /^the following/i,
  /listed below/i,
  /^here are/i,
  /^check out/i,
  /^see (the|our|more)/i,
];

function isQualitySnippet(snippet: string): boolean {
  return !LOW_QUALITY_SNIPPET_PATTERNS.some((p) => p.test(snippet));
}

// ── Source key → readable name ────────────────────────────────────────────────

function formatSourceName(sourceKey: string): string {
  const names: Record<string, string> = {
    eater_atlanta: "Eater Atlanta",
    infatuation_atlanta: "The Infatuation",
    rough_draft_atlanta: "Rough Draft Atlanta",
    atlanta_eats: "Atlanta Eats",
  };
  return names[sourceKey] ?? sourceKey.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Core fetch function ────────────────────────────────────────────────────────

/**
 * Fetches contextual destination items for the current time slot.
 * Safe to call from both the standalone route and the city-pulse pipeline.
 *
 * @param supabase - Any Supabase client (anon or service role)
 * @param _portalSlug - Reserved for future portal-specific filtering
 * @param nowOverride - Override the current time (for testing)
 */
export async function fetchDestinations(
  supabase: SupabaseClient,
  _portalSlug: string,
  nowOverride?: Date,
): Promise<DestinationItem[]> {
  const now = nowOverride ?? new Date();
  const slot = getDestinationsTimeSlot(now);
  const weekend = isWeekend(now);
  const occasions = getOccasionsForTimeSlot(slot, weekend);

  // Step 1: venues matching current occasions (if any)
  let venueIds: number[] = [];
  const occasionByVenue = new Map<number, string>();

  if (occasions.length > 0) {
    const { data: occasionRows } = await supabase
      .from("place_occasions")
      .select("place_id, occasion, confidence")
      .in("occasion", occasions)
      .gte("confidence", 0.5) as unknown as {
        data: { place_id: number; occasion: string; confidence: number }[] | null;
      };

    if (occasionRows && occasionRows.length > 0) {
      // Sort by confidence desc, deduplicate by venue keeping best occasion
      const sorted = [...occasionRows].sort((a, b) => b.confidence - a.confidence);
      for (const row of sorted) {
        if (!occasionByVenue.has(row.place_id)) {
          occasionByVenue.set(row.place_id, row.occasion);
        }
      }
      venueIds = [...occasionByVenue.keys()];
    }
  }

  // Steps 2 & 3 (parallel): venue details + editorial mentions
  let venues: PlaceRow[] = [];
  const mentionByVenue = new Map<number, { snippet: string; source_key: string }>();

  if (venueIds.length > 0) {
    const [venueResult, mentionResult] = await Promise.all([
      supabase
        .from("places")
        .select("id, name, slug, neighborhood, place_type, image_url, hours")
        .in("id", venueIds)
        .eq("is_active", true)
        .eq("city", "Atlanta") as unknown as Promise<{ data: PlaceRow[] | null }>,
      supabase
        .from("editorial_mentions")
        .select("place_id, source_key, snippet")
        .in("place_id", venueIds) as unknown as Promise<{ data: MentionRow[] | null }>,
    ]);

    venues = venueResult.data ?? [];

    if (mentionResult.data) {
      for (const row of mentionResult.data) {
        if (!mentionByVenue.has(row.place_id) && row.snippet && isQualitySnippet(row.snippet)) {
          mentionByVenue.set(row.place_id, { snippet: row.snippet, source_key: row.source_key });
        }
      }
    }
  }

  // Step 4: merge, filter open-now, sort, limit
  let destinations: DestinationItem[] = venues.map((place) => {
    const occasion = occasionByVenue.get(place.id) ?? occasions[0] ?? "date_night";
    const mention = mentionByVenue.get(place.id) ?? null;
    return {
      venue: {
        id: place.id,
        name: place.name,
        slug: place.slug,
        neighborhood: place.neighborhood,
        place_type: place.place_type,
        image_url: place.image_url,
      },
      occasion,
      contextual_label: getContextualLabel(occasion),
      editorial_quote: mention
        ? { snippet: mention.snippet, source: formatSourceName(mention.source_key) }
        : null,
    };
  });

  // Filter open now when hours data is available; keep places with no hours data
  destinations = destinations.filter((d) => {
    const placeRow = venues.find((v) => v.id === d.venue.id);
    if (!placeRow?.hours) return true;
    const { isOpen } = isOpenAt(placeRow.hours, now);
    return isOpen;
  });

  // Sort: has editorial mention DESC, then by occasion priority
  const occasionPriority = new Map(occasions.map((o, i) => [o, i]));
  destinations.sort((a, b) => {
    const aHasPress = a.editorial_quote ? 0 : 1;
    const bHasPress = b.editorial_quote ? 0 : 1;
    if (aHasPress !== bHasPress) return aHasPress - bHasPress;
    const aPriority = occasionPriority.get(a.occasion) ?? 99;
    const bPriority = occasionPriority.get(b.occasion) ?? 99;
    return aPriority - bPriority;
  });

  // Enforce occasion diversity — cap any single occasion at 3 of 6 slots
  const seenOccasions: Record<string, number> = {};
  const diverseDestinations = destinations.filter((d) => {
    const occ = d.occasion || "default";
    seenOccasions[occ] = (seenOccasions[occ] || 0) + 1;
    return seenOccasions[occ] <= 3;
  });
  destinations = diverseDestinations.slice(0, 6);

  // Step 5: fallback — if < 3 results, fill with top editorial-mentioned venues
  if (destinations.length < 3) {
    const existingIds = new Set(destinations.map((d) => d.venue.id));
    const needed = 6 - destinations.length;

    const { data: fallbackMentions } = await supabase
      .from("editorial_mentions")
      .select("place_id, source_key, snippet")
      .limit(needed * 3) as unknown as {
        data: MentionRow[] | null;
      };

    if (fallbackMentions && fallbackMentions.length > 0) {
      const fallbackPlaceIds = [...new Set(
        fallbackMentions
          .map((r) => r.place_id)
          .filter((id) => !existingIds.has(id))
      )].slice(0, needed);

      if (fallbackPlaceIds.length > 0) {
        // Fallback steps: place details + mention map in parallel
        const [fallbackPlaceResult] = await Promise.all([
          supabase
            .from("places")
            .select("id, name, slug, neighborhood, place_type, image_url, hours")
            .in("id", fallbackPlaceIds)
            .eq("is_active", true)
            .eq("city", "Atlanta") as unknown as Promise<{ data: PlaceRow[] | null }>,
        ]);

        if (fallbackPlaceResult.data) {
          // Build mention map for fallback places (quality-filtered)
          const fallbackMentionMap = new Map<number, { snippet: string; source_key: string }>();
          for (const row of fallbackMentions) {
            if (!fallbackMentionMap.has(row.place_id) && row.snippet && isQualitySnippet(row.snippet)) {
              fallbackMentionMap.set(row.place_id, { snippet: row.snippet, source_key: row.source_key });
            }
          }

          for (const place of fallbackPlaceResult.data) {
            const mention = fallbackMentionMap.get(place.id);
            destinations.push({
              venue: {
                id: place.id,
                name: place.name,
                slug: place.slug,
                neighborhood: place.neighborhood,
                place_type: place.place_type,
                image_url: place.image_url,
              },
              occasion: "date_night",
              contextual_label: "WORTH CHECKING OUT",
              editorial_quote: mention
                ? { snippet: mention.snippet, source: formatSourceName(mention.source_key) }
                : null,
            });
          }
        }
      }
    }

    destinations = destinations.slice(0, 6);
  }

  return destinations;
}
