import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  applyRateLimit,
  RATE_LIMITS,
  getClientIdentifier,
} from "@/lib/rate-limit";
import { successResponse, errorApiResponse } from "@/lib/api-utils";
import { isOpenAt, type HoursData } from "@/lib/hours";

// ── Types ──────────────────────────────────────────────────────────────────────

type TimeSlot = "morning" | "midday" | "happy_hour" | "evening" | "late_night";

interface DestinationItem {
  venue: {
    id: number;
    name: string;
    slug: string | null;
    neighborhood: string | null;
    venue_type: string | null;
    image_url: string | null;
  };
  occasion: string;
  contextual_label: string;
  editorial_quote: { snippet: string; source: string } | null;
}

type RouteContext = {
  params: Promise<{ slug: string }>;
};

// ── Time slot detection ────────────────────────────────────────────────────────

function getTimeSlot(now: Date): TimeSlot {
  const hour = now.getHours();
  if (hour < 11) return "morning";
  if (hour < 16) return "midday";
  if (hour < 18) return "happy_hour";
  if (hour < 22) return "evening";
  return "late_night";
}

function isWeekend(now: Date): boolean {
  const day = now.getDay(); // 0=Sun, 6=Sat
  return day === 0 || day === 6;
}

// ── Time slot → occasion mapping ───────────────────────────────────────────────

function getOccasionsForTimeSlot(slot: TimeSlot, weekend: boolean): string[] {
  if (weekend && slot === "morning") {
    return ["brunch", "outdoor_dining", "family_friendly"];
  }
  switch (slot) {
    case "morning":
      return []; // morning weekday — no morning occasion; fall back to editorial
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

function getContextualLabel(occasion: string): string {
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

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest, context: RouteContext) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request)
  );
  if (rateLimitResult) return rateLimitResult;

  // slug is available for future portal-specific filtering
  await context.params;

  try {
    const supabase = await createClient();
    const now = new Date();
    const slot = getTimeSlot(now);
    const weekend = isWeekend(now);
    const occasions = getOccasionsForTimeSlot(slot, weekend);

    // Step 1: venues matching current occasions (if any)
    let venueIds: number[] = [];
    const occasionByVenue = new Map<number, string>();

    if (occasions.length > 0) {
      const { data: occasionRows } = await supabase
        .from("venue_occasions")
        .select("venue_id, occasion, confidence")
        .in("occasion", occasions)
        .gte("confidence", 0.5) as unknown as {
          data: { venue_id: number; occasion: string; confidence: number }[] | null;
        };

      if (occasionRows && occasionRows.length > 0) {
        // Sort by confidence desc, deduplicate by venue keeping best occasion
        const sorted = [...occasionRows].sort((a, b) => b.confidence - a.confidence);
        for (const row of sorted) {
          if (!occasionByVenue.has(row.venue_id)) {
            occasionByVenue.set(row.venue_id, row.occasion);
          }
        }
        venueIds = [...occasionByVenue.keys()];
      }
    }

    // Step 2: venue details
    let venues: {
      id: number;
      name: string;
      slug: string | null;
      neighborhood: string | null;
      venue_type: string | null;
      image_url: string | null;
      hours: HoursData | null;
    }[] = [];

    if (venueIds.length > 0) {
      const { data: venueRows } = await supabase
        .from("venues")
        .select("id, name, slug, neighborhood, venue_type, image_url, hours")
        .in("id", venueIds)
        .eq("active", true)
        .eq("city", "Atlanta") as unknown as {
          data: typeof venues | null;
        };

      venues = venueRows ?? [];
    }

    // Step 3: editorial mentions for matched venues
    const mentionByVenue = new Map<number, { snippet: string; source_key: string }>();

    if (venueIds.length > 0) {
      const { data: mentionRows } = await supabase
        .from("editorial_mentions")
        .select("venue_id, source_key, snippet")
        .in("venue_id", venueIds) as unknown as {
          data: { venue_id: number; source_key: string; snippet: string }[] | null;
        };

      if (mentionRows) {
        for (const row of mentionRows) {
          // Keep first mention per venue
          if (!mentionByVenue.has(row.venue_id) && row.snippet) {
            mentionByVenue.set(row.venue_id, { snippet: row.snippet, source_key: row.source_key });
          }
        }
      }
    }

    // Step 4: merge, filter open-now, sort, limit
    let destinations: DestinationItem[] = venues.map((venue) => {
      const occasion = occasionByVenue.get(venue.id) ?? occasions[0] ?? "date_night";
      const mention = mentionByVenue.get(venue.id) ?? null;
      return {
        venue: {
          id: venue.id,
          name: venue.name,
          slug: venue.slug,
          neighborhood: venue.neighborhood,
          venue_type: venue.venue_type,
          image_url: venue.image_url,
        },
        occasion,
        contextual_label: getContextualLabel(occasion),
        editorial_quote: mention
          ? { snippet: mention.snippet, source: formatSourceName(mention.source_key) }
          : null,
      };
    });

    // Filter open now when hours data is available; keep venues with no hours data
    destinations = destinations.filter((d) => {
      const venueRow = venues.find((v) => v.id === d.venue.id);
      if (!venueRow?.hours) return true; // no hours data → include
      const { isOpen } = isOpenAt(venueRow.hours, now);
      return isOpen;
    });

    // Sort: has editorial mention DESC, then by occasion priority (first in list = higher priority)
    const occasionPriority = new Map(occasions.map((o, i) => [o, i]));
    destinations.sort((a, b) => {
      const aHasPress = a.editorial_quote ? 0 : 1;
      const bHasPress = b.editorial_quote ? 0 : 1;
      if (aHasPress !== bHasPress) return aHasPress - bHasPress;
      const aPriority = occasionPriority.get(a.occasion) ?? 99;
      const bPriority = occasionPriority.get(b.occasion) ?? 99;
      return aPriority - bPriority;
    });

    destinations = destinations.slice(0, 6);

    // Step 5: fallback — if < 3 results, fill with top editorial-mentioned venues
    if (destinations.length < 3) {
      const existingIds = new Set(destinations.map((d) => d.venue.id));
      const needed = 6 - destinations.length;

      const { data: fallbackMentions } = await supabase
        .from("editorial_mentions")
        .select("venue_id, source_key, snippet")
        .limit(needed * 3) as unknown as {
          data: { venue_id: number; source_key: string; snippet: string }[] | null;
        };

      if (fallbackMentions && fallbackMentions.length > 0) {
        const fallbackVenueIds = [...new Set(
          fallbackMentions
            .map((r) => r.venue_id)
            .filter((id) => !existingIds.has(id))
        )].slice(0, needed);

        if (fallbackVenueIds.length > 0) {
          const { data: fallbackVenues } = await supabase
            .from("venues")
            .select("id, name, slug, neighborhood, venue_type, image_url, hours")
            .in("id", fallbackVenueIds)
            .eq("active", true)
            .eq("city", "Atlanta") as unknown as {
              data: typeof venues | null;
            };

          if (fallbackVenues) {
            // Build mention map for fallback venues
            const fallbackMentionMap = new Map<number, { snippet: string; source_key: string }>();
            for (const row of fallbackMentions) {
              if (!fallbackMentionMap.has(row.venue_id) && row.snippet) {
                fallbackMentionMap.set(row.venue_id, { snippet: row.snippet, source_key: row.source_key });
              }
            }

            for (const venue of fallbackVenues) {
              const mention = fallbackMentionMap.get(venue.id);
              destinations.push({
                venue: {
                  id: venue.id,
                  name: venue.name,
                  slug: venue.slug,
                  neighborhood: venue.neighborhood,
                  venue_type: venue.venue_type,
                  image_url: venue.image_url,
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

    return successResponse(
      { destinations },
      {
        headers: {
          "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
        },
      }
    );
  } catch (error) {
    console.error("[GET /api/portals/[slug]/destinations]", error);
    return errorApiResponse("Failed to load destinations", 500);
  }
}
