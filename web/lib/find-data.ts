import { createClient } from "@/lib/supabase/server";
import { getPortalBySlug } from "@/lib/portal";

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
  return "Weekend picks";
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
    // -----------------------------------------------------------------------

    const [rightNowResult, pulseResult] = await Promise.all([
      supabase.rpc("get_right_now_feed", {
        p_portal_id: portal?.id ?? null,
        p_city: city,
        p_limit: 6,
      } as never),

      supabase
        .from("places")
        .select("place_type")
        .neq("is_active", false)
        .ilike("city", `${city}%`),
    ]);

    const rightNow: RightNowItem[] = rightNowResult.data ?? [];

    // Aggregate place_type counts into category buckets
    const typeCounts: Record<string, number> = {};
    for (const row of pulseResult.data ?? []) {
      const pt = (row as { place_type: string | null }).place_type;
      if (pt) typeCounts[pt] = (typeCounts[pt] ?? 0) + 1;
    }

    // Roll up type counts into category counts
    const categoryCounts: Record<string, number> = {};
    for (const [cat, cfg] of Object.entries(CATEGORY_MAP)) {
      categoryCounts[cat] = cfg.types.reduce(
        (sum, t) => sum + (typeCounts[t] ?? 0),
        0
      );
    }

    // Build pulse array (all categories, ordered by count desc)
    const pulse: CategoryPulse[] = Object.entries(CATEGORY_MAP)
      .map(([cat, cfg]) => ({
        category: cat,
        label: cfg.label,
        count: categoryCounts[cat] ?? 0,
        icon: cfg.icon,
        color: cfg.color,
        href: cfg.href,
      }))
      .sort((a, b) => b.count - a.count);

    // -----------------------------------------------------------------------
    // Phase 2: spotlight queries for top 3 qualifying categories (parallel)
    // -----------------------------------------------------------------------

    const SPOTLIGHT_MIN = 3;

    const spotlightCandidates = pulse
      .filter((p) => p.count >= SPOTLIGHT_MIN)
      .slice(0, 3);

    // If fewer than 3 candidates with data, pad with top categories by order
    // (global fallback — still queries; just may return fewer items)
    const spotlightCategories =
      spotlightCandidates.length >= 1
        ? spotlightCandidates
        : pulse.slice(0, 3);

    const spotlightResults = await Promise.all(
      spotlightCategories.map((cat) =>
        supabase
          .from("places")
          .select(
            "id, name, slug, image_url, place_type, neighborhood, short_description, price_level, vibes"
          )
          .neq("is_active", false)
          .ilike("city", `${city}%`)
          .in("place_type", CATEGORY_MAP[cat.category]?.types ?? [])
          .order("final_score", { ascending: false, nullsFirst: false })
          .limit(3)
      )
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
        }>;

        if (rows.length === 0) return null;

        const items: SpotlightItem[] = rows.map((row) => ({
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
        }));

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
