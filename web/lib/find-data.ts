import { createClient } from "@/lib/supabase/server";
import { getPortalBySlug } from "@/lib/portal";
import { isOpenAt, type HoursData } from "@/lib/hours";

export interface RightNowItem {
  entity_type: "event" | "place";
  id: number;
  name: string;
  slug: string;
  image_url: string | null;
  place_type: string | null;
  neighborhood: string | null;
  venue_name: string | null;
  start_date: string | null;
  start_time: string | null;
  category_id: string | null;
  is_free: boolean | null;
  price_min: number | null;
  is_open: boolean | null;
  google_rating: number | null;
  short_description: string | null;
  relevance_score: number | null;
}

export interface CategoryPulse {
  category: string;
  label: string;
  count: number;
  icon: string;
  color: string;
  href: string;
}

export interface SpotlightItem {
  entity_type: "place" | "event";
  id: number;
  name: string;
  slug: string;
  image_url: string | null;
  place_type: string | null;
  neighborhood: string | null;
  short_description: string | null;
  is_open?: boolean;
  closes_at?: string | null;
  price_level?: number | null;
  vibes?: string[];
  event_count?: number;
  venue_name?: string | null;
  start_time?: string | null;
  is_free?: boolean;
}

export interface FindSpotlight {
  category: string;
  label: string;
  reason: string;
  color: string;
  href: string;
  items: SpotlightItem[];
}

export interface ServerFindData {
  rightNow: RightNowItem[];
  pulse: CategoryPulse[];
  spotlights: FindSpotlight[];
}

// ---------------------------------------------------------------------------
// Category configuration
// ---------------------------------------------------------------------------

const CATEGORY_MAP: Record<
  string,
  { label: string; icon: string; color: string; types: string[]; href: string }
> = {
  arts: {
    label: "Arts & Culture",
    icon: "palette",
    color: "#C9874F",
    types: ["museum", "gallery", "arts_center", "theater"],
    href: "?view=places&tab=things-to-do&venue_type=museum,gallery,arts_center,theater&from=find",
  },
  dining: {
    label: "Eat & Drink",
    icon: "fork-knife",
    color: "#FF6B7A",
    types: [
      "restaurant",
      "bar",
      "brewery",
      "cocktail_bar",
      "coffee_shop",
      "food_hall",
      "wine_bar",
      "rooftop",
      "lounge",
    ],
    href: "?view=places&tab=eat-drink&from=find",
  },
  nightlife: {
    label: "Nightlife",
    icon: "moon-stars",
    color: "#E855A0",
    types: [
      "bar",
      "nightclub",
      "cocktail_bar",
      "lounge",
      "music_venue",
      "comedy_club",
      "karaoke",
      "lgbtq",
    ],
    href: "?view=places&tab=nightlife&from=find",
  },
  outdoors: {
    label: "Outdoors",
    icon: "tree",
    color: "#00D9A0",
    types: ["park", "trail", "recreation", "viewpoint", "landmark"],
    href: "?view=places&tab=things-to-do&venue_type=park,trail,recreation,viewpoint,landmark&from=find",
  },
  music: {
    label: "Music & Shows",
    icon: "music-notes",
    color: "#A78BFA",
    types: ["music_venue", "amphitheater", "arena", "stadium"],
    href: "?view=happening&content=showtimes&vertical=music&from=find",
  },
  entertainment: {
    label: "Entertainment",
    icon: "ticket",
    color: "#A78BFA",
    types: [
      "arcade",
      "attraction",
      "entertainment",
      "escape_room",
      "bowling",
      "zoo",
      "aquarium",
      "cinema",
    ],
    href: "?view=places&tab=things-to-do&venue_type=arcade,attraction,entertainment,escape_room,bowling,zoo,aquarium,cinema&from=find",
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a contextual reason string based on the current hour (Eastern time).
 */
function buildSpotlightReason(hourEt: number): string {
  if (hourEt < 11) return "Open now and worth a visit";
  if (hourEt < 15) return "Explore this afternoon";
  if (hourEt < 20) return "Tonight's best spots";
  return "Late night picks";
}

/**
 * Returns category priority order based on time of day.
 * Categories earlier in the list are preferred for spotlight slots.
 */
function getTimePriority(hourEt: number): string[] {
  if (hourEt < 11) return ["outdoors", "dining", "arts", "entertainment", "music", "nightlife"];
  if (hourEt < 15) return ["arts", "dining", "outdoors", "entertainment", "music", "nightlife"];
  if (hourEt < 20) return ["nightlife", "dining", "music", "arts", "entertainment", "outdoors"];
  return ["nightlife", "music", "dining", "entertainment", "arts", "outdoors"];
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Server-side data fetcher for the unified Find tab.
 *
 * Runs 6 Supabase queries in parallel:
 *  1. get_right_now_feed RPC — mixed events + places ranked by temporal relevance
 *  2. places GROUP BY place_type — pulse counts per category
 *  3–5. Top 3 category spotlight queries — 3 places each
 *
 * Returns null on any error so FindView can degrade gracefully.
 */
export async function getServerFindData(
  portalSlug: string
): Promise<ServerFindData | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const supabase = await createClient();
    const portal = await getPortalBySlug(portalSlug);
    const city = (portal?.filters as { city?: string } | null)?.city || "Atlanta";

    // Determine current Eastern hour for contextual reason strings
    const nowEt = new Date(
      new Date().toLocaleString("en-US", { timeZone: "America/New_York" })
    );
    const hourEt = nowEt.getHours();
    const reason = buildSpotlightReason(hourEt);

    // -----------------------------------------------------------------------
    // Phase 1: right-now feed + pulse counts (parallel)
    // 7 queries: 1 RPC + 6 category count queries (head:true — no row data)
    // -----------------------------------------------------------------------

    const categoryEntries = Object.entries(CATEGORY_MAP);

    const [rightNowResult, ...pulseCountResults] = await Promise.all([
      supabase.rpc("get_right_now_feed", {
        p_portal_id: portal?.id ?? null,
        p_city: city,
        p_limit: 6,
      } as never),

      // 6 parallel count queries — head:true returns only the count, no rows
      ...categoryEntries.map(([, cfg]) =>
        supabase
          .from("places")
          .select("id", { count: "exact", head: true })
          .neq("is_active", false)
          .ilike("city", `${city}%`)
          .in("place_type", cfg.types)
      ),
    ]);

    const rightNow: RightNowItem[] = rightNowResult.data ?? [];

    // Build pulse array from count results, sorted by time-of-day priority
    const timePriority = getTimePriority(hourEt);
    const pulse: CategoryPulse[] = categoryEntries
      .map(([cat, cfg], idx) => ({
        category: cat,
        label: cfg.label,
        count: pulseCountResults[idx]?.count ?? 0,
        icon: cfg.icon,
        color: cfg.color,
        href: cfg.href,
      }))
      .sort((a, b) => {
        // Primary: time-of-day priority (lower index = higher priority)
        const aPriority = timePriority.indexOf(a.category);
        const bPriority = timePriority.indexOf(b.category);
        if (aPriority !== bPriority) return aPriority - bPriority;
        // Secondary: count
        return b.count - a.count;
      });

    // -----------------------------------------------------------------------
    // Phase 2: spotlight queries for top 3 qualifying categories (parallel)
    // -----------------------------------------------------------------------

    const SPOTLIGHT_MIN = 3;

    // Pick top 3 categories meeting the min threshold (already sorted by time priority)
    const spotlightCandidates = pulse.filter((p) => p.count >= SPOTLIGHT_MIN);

    // If fewer than 3 qualify, pad from the full pulse list (preserving time priority order)
    const spotlightCategories: CategoryPulse[] = [];
    const used = new Set<string>();
    for (const cat of spotlightCandidates) {
      if (spotlightCategories.length >= 3) break;
      spotlightCategories.push(cat);
      used.add(cat.category);
    }
    // Pad from full pulse if needed
    if (spotlightCategories.length < 3) {
      for (const cat of pulse) {
        if (spotlightCategories.length >= 3) break;
        if (!used.has(cat.category)) {
          spotlightCategories.push(cat);
          used.add(cat.category);
        }
      }
    }

    // Spotlight queries include hours for is_open computation
    const now = new Date();
    const spotlightResults = await Promise.all(
      spotlightCategories.map(async (cat) => {
        const types = CATEGORY_MAP[cat.category]?.types ?? [];
        return supabase
          .from("places")
          .select(
            "id, name, slug, image_url, place_type, neighborhood, short_description, price_level, vibes, hours"
          )
          .neq("is_active", false)
          .ilike("city", `${city}%`)
          .in("place_type", types)
          .order("name")
          .limit(3);
      })
    );

    const spotlights: FindSpotlight[] = spotlightCategories
      .map((cat, idx) => {
        const rows = (spotlightResults[idx]?.data ?? []) as Array<{
          id: number;
          name: string;
          slug: string;
          image_url: string | null;
          place_type: string | null;
          neighborhood: string | null;
          short_description: string | null;
          price_level: number | null;
          vibes: string[] | null;
          hours: HoursData | null;
        }>;

        if (rows.length === 0) return null;

        const items: SpotlightItem[] = rows.map((row) => {
          const openStatus = isOpenAt(row.hours, now);
          return {
            entity_type: "place" as const,
            id: row.id,
            name: row.name,
            slug: row.slug,
            image_url: row.image_url,
            place_type: row.place_type,
            neighborhood: row.neighborhood,
            short_description: row.short_description,
            price_level: row.price_level,
            vibes: row.vibes ?? undefined,
            is_open: openStatus.isOpen,
            closes_at: openStatus.closesAt ?? null,
          };
        });

        return {
          category: cat.category,
          label: cat.label,
          reason,
          color: cat.color,
          href: cat.href,
          items,
        } satisfies FindSpotlight;
      })
      .filter((s): s is FindSpotlight => s !== null);

    return { rightNow, pulse, spotlights };
  } catch (err) {
    console.error("[find-data] getServerFindData error:", err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
