import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { format, startOfDay } from "date-fns";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

type TonightEvent = {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  end_date: string | null;
  end_time: string | null;
  is_all_day: boolean;
  is_free: boolean;
  category: string | null;
  image_url: string | null;
  description: string | null;
  venue_id: number | null;
  series_id?: string | null;
  series?: {
    id: string;
    slug: string;
    title: string;
    series_type: string;
    image_url: string | null;
    frequency: string | null;
    day_of_week: string | null;
    festival?: {
      id: string;
      slug: string;
      name: string;
      image_url: string | null;
      festival_type?: string | null;
      location: string | null;
      neighborhood: string | null;
    } | null;
  } | null;
  venue: {
    name: string;
    neighborhood: string | null;
  } | null;
};

type ScoredEvent = TonightEvent & {
  quality_score: number;
  rsvp_count: number;
};

// Categories that appeal to young hip crowd
const HIP_CATEGORIES = ["music", "comedy", "nightlife", "art", "film", "theater"];
const GENERIC_CATEGORIES = ["family", "fitness", "classes"];

// Venue name patterns that indicate hip/cool venues
const HIP_VENUE_PATTERNS = [
  // Live music venues
  /\b(earl|529|variety|terminal west|masquerade|drunken unicorn|star bar|aisle ?5)\b/i,
  /\b(tabernacle|the eastern|vinyl|center stage|coca.cola roxy|buckhead theatre)\b/i,
  /\b(atlanta symphony|symphony hall|cobb energy)\b/i,
  /\b(city winery|eddie'?s attic|red light cafe|smith'?s olde bar|blind willie)\b/i,
  // Comedy & theater
  /\b(dad'?s garage|laughing skull|punchline|improv|helium comedy)\b/i,
  /\b(fox theatre|alliance|horizon|theatrical outfit|7 stages|actor'?s express)\b/i,
  // Film
  /\b(plaza theatre|aurora|tara)\b/i,
  // Art & culture
  /\b(goat farm|eyedrum|wonderroot|dashboard|mammal|pullman yards)\b/i,
  /\b(high museum|carlos museum|atlanta contemporary|moca ga|moda)\b/i,
  // Nightlife & bars
  /\b(mary'?s|sister louisa|joystick|mother|church|octopus)\b/i,
  /\b(tongue.groove|opera|ravine|compound|believe music)\b/i,
  // Breweries
  /\b(monday night|three taverns|orpheus|sweetwater|wild heaven)\b/i,
  // Shops & bookstores
  /\b(criminal records|wax n facts)\b/i,
];

// Venue patterns to deprioritize (generic/chain/kids)
const GENERIC_VENUE_PATTERNS = [
  /painting with a twist/i,
  /board & brush/i,
  /sur la table/i,
  /williams.sonoma/i,
  /cook'?s warehouse/i,
  /pottery|ceramics class/i,
  /ymca|rec center/i,
  /library/i,
  /children'?s museum/i,
  /legoland/i,
  /chuck e/i,
];

// Calculate quality score optimized for young hip audience
function calculateQualityScore(
  event: TonightEvent,
  rsvpCounts: Map<number, { going: number; interested: number }>,
  venueRecCounts: Map<number, number>,
  currentHour: number
): number {
  let score = 0;
  const venueName = event.venue?.name || "";
  const cat = event.category || "other";

  // === VENUE QUALITY (biggest factor) ===

  // Check if it's a known hip venue (+20)
  if (HIP_VENUE_PATTERNS.some(p => p.test(venueName))) {
    score += 20;
  }

  // Penalize generic/chain venues (-30, effectively removes them)
  if (GENERIC_VENUE_PATTERNS.some(p => p.test(venueName))) {
    score -= 30;
  }

  // Venue has user recommendations (+3 per rec, cap at 15)
  if (event.venue_id) {
    const venueRecs = venueRecCounts.get(event.venue_id) || 0;
    score += Math.min(venueRecs * 3, 15);
  }

  // === CATEGORY QUALITY ===

  // Hip categories get boost (+10)
  if (HIP_CATEGORIES.includes(cat)) {
    score += 10;
  }

  // Generic categories get penalty (-15)
  if (GENERIC_CATEGORIES.includes(cat)) {
    score -= 15;
  }

  // === SOCIAL PROOF ===

  const rsvps = rsvpCounts.get(event.id);
  if (rsvps) {
    score += rsvps.going * 4;
    score += rsvps.interested * 2;
    // Bonus for events with 3+ RSVPs
    if (rsvps.going + rsvps.interested >= 3) {
      score += 8;
    }
  }

  // === CONTENT QUALITY ===

  // Has image (+5)
  if (event.image_url) {
    score += 5;
  }

  // Has substantial description (+3)
  if (event.description && event.description.length > 100) {
    score += 3;
  }

  // Penalize ALL_CAPS titles (often low-quality data)
  const title = event.title || "";
  if (title.length > 5 && title === title.toUpperCase()) {
    score -= 8;
  }

  // Penalize very short or generic titles
  if (title.length <= 5) {
    score -= 10;
  }

  // Hard penalty for canceled events
  if (/cancel[le]d/i.test(title)) {
    score -= 100;
  }

  // Penalize kid/family-focused events in hip categories
  const titleAndDesc = `${title} ${event.description || ""}`.toLowerCase();
  if (/\b(toddler|children'?s|kid'?s|pre-?k|storytime|story time)\b/i.test(titleAndDesc)) {
    score -= 25;
  }

  // Boost events with hip keywords
  if (/\b(tour|live|dj|party|21\+|18\+|drag|burlesque|improv|open mic|showcase)\b/i.test(title)) {
    score += 5;
  }

  // Penalize nightlife events in the morning (likely miscategorized)
  if (cat === "nightlife" && event.start_time) {
    const hour = parseInt(event.start_time.split(":")[0]);
    if (hour >= 6 && hour < 17) {
      score -= 15;
    }
  }

  // Penalize events with stale month names in title (old data not updated)
  const months = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
  const currentMonth = new Date().getMonth(); // 0-indexed
  const staleMonths = months.filter((_, i) => i !== currentMonth);
  if (staleMonths.some(m => title.toLowerCase().includes(m))) {
    score -= 20;
  }

  // Penalize 00:00 start time (likely means unknown, not midnight)
  if (event.start_time === "00:00:00") {
    score -= 15;
  }

  // === TIME RELEVANCE ===

  const isEvening = currentHour >= 17 || currentHour < 4;

  // Evening events at night get boost
  if (isEvening && event.start_time) {
    const eventHour = parseInt(event.start_time.split(":")[0]);
    if (eventHour >= 19 || eventHour < 4) {
      score += 5; // Late night events
    }
  }

  // Penalty for no venue (sketchy)
  if (!event.venue) {
    score -= 10;
  }

  // Penalty for venue with no neighborhood (often out-of-area or bad data)
  if (event.venue && !event.venue.neighborhood) {
    score -= 8;
  }

  return score;
}

export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  try {
    const today = format(startOfDay(new Date()), "yyyy-MM-dd");
    const tomorrow = format(new Date(Date.now() + 24 * 60 * 60 * 1000), "yyyy-MM-dd");
    const dayAfter = format(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), "yyyy-MM-dd");
    const now = new Date();
    const currentHour = now.getHours();

    const supabase = await createClient();

    // Get the main Atlanta portal ID
    const { data: atlantaPortal } = await supabase
      .from("portals")
      .select("id")
      .eq("slug", "atlanta")
      .single<{ id: string }>();

    if (!atlantaPortal) {
      console.error("Atlanta portal not found");
      return NextResponse.json({ events: [] }, { status: 500 });
    }

    // Fetch events for today, tomorrow, and day after
    // Include both portal-specific AND public events (matching feed route pattern)
    const { data: events, error } = await supabase
      .from("events")
      .select(`
        id,
        title,
        start_date,
        start_time,
        end_date,
        end_time,
        is_all_day,
        is_free,
        category,
        image_url,
        description,
        venue_id,
        series_id,
        series:series_id(
          id,
          slug,
          title,
          series_type,
          image_url,
          frequency,
          day_of_week,
          festival:festivals(id, slug, name, image_url, festival_type, location, neighborhood)
        ),
        venue:venues(name, neighborhood)
      `)
      .in("start_date", [today, tomorrow, dayAfter])
      .is("canonical_event_id", null)
      .or("is_class.eq.false,is_class.is.null")
      .or(`portal_id.eq.${atlantaPortal.id},portal_id.is.null`)
      .order("start_date", { ascending: true })
      .order("start_time", { ascending: true })
      .limit(500); // Need large limit — 200+ events per day

    if (error || !events) {
      console.error("Failed to fetch tonight events:", error);
      return NextResponse.json({ events: [] }, {
        headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" }
      });
    }

    const allEvents = events as unknown as TonightEvent[];

    // Filter out today's events that already happened (started > 2 hours ago)
    // At early morning hours (before 6 AM), show all of today's events since they're upcoming
    const isEarlyMorning = currentHour < 6;
    const twoHoursAgo = format(new Date(now.getTime() - 2 * 60 * 60 * 1000), "HH:mm:ss");
    const typedEvents = allEvents.filter(event => {
      // Future days: always include
      if (event.start_date > today) return true;
      // All-day events: always include
      if (event.is_all_day || !event.start_time) return true;
      // Early morning: include all of today's events (they're all upcoming)
      if (isEarlyMorning) return true;
      // Later in the day: only include if not too far in the past
      return event.start_time >= twoHoursAgo;
    });

    if (typedEvents.length === 0) {
      return NextResponse.json({ events: [] }, {
        headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" }
      });
    }

    // Fetch RSVP counts for these events
    const eventIds = typedEvents.map(e => e.id);
    const { data: rsvpData } = await supabase
      .from("event_rsvps")
      .select("event_id, status")
      .in("event_id", eventIds)
      .in("status", ["going", "interested"]);

    // Aggregate RSVP counts
    const rsvpCounts = new Map<number, { going: number; interested: number }>();
    const typedRsvps = (rsvpData || []) as { event_id: number; status: string }[];
    for (const rsvp of typedRsvps) {
      const counts = rsvpCounts.get(rsvp.event_id) || { going: 0, interested: 0 };
      if (rsvp.status === "going") counts.going++;
      else if (rsvp.status === "interested") counts.interested++;
      rsvpCounts.set(rsvp.event_id, counts);
    }

    // Fetch venue recommendation counts
    const venueIds = typedEvents.map(e => e.venue_id).filter((id): id is number => id !== null);
    const venueRecCounts = new Map<number, number>();

    if (venueIds.length > 0) {
      const { data: recData } = await supabase
        .from("recommendations")
        .select("venue_id")
        .in("venue_id", venueIds)
        .eq("visibility", "public");

      const typedRecs = (recData || []) as { venue_id: number }[];
      for (const rec of typedRecs) {
        if (rec.venue_id) {
          venueRecCounts.set(rec.venue_id, (venueRecCounts.get(rec.venue_id) || 0) + 1);
        }
      }
    }

    // Score all events
    const scoredEvents: ScoredEvent[] = typedEvents.map(event => {
      const rsvps = rsvpCounts.get(event.id);
      let score = calculateQualityScore(event, rsvpCounts, venueRecCounts, currentHour);

      // Bonus for today's events
      if (event.start_date === today) {
        score += 5;
      }

      return {
        ...event,
        quality_score: score,
        rsvp_count: rsvps ? rsvps.going + rsvps.interested : 0,
      };
    });

    // Filter out events with very negative scores (generic/low quality)
    // Require images for highlights (first thing people see)
    // Also dedupe by title+venue (some events appear multiple times)
    const seen = new Set<string>();
    const qualityEvents = scoredEvents.filter(e => {
      if (e.quality_score <= -10) return false;
      if (!e.image_url) return false; // Require image for highlights

      // Dedupe key: normalized title + venue
      const key = `${e.title.toLowerCase().trim()}|${e.venue?.name?.toLowerCase() || ""}`;
      if (seen.has(key)) return false;
      seen.add(key);

      return true;
    });

    // Sort by quality score (descending)
    qualityEvents.sort((a, b) => b.quality_score - a.quality_score);

    // Normalize venue name for dedup: "The Masquerade - Purgatory" -> "masquerade"
    const normalizeVenueName = (name: string): string => {
      return name
        .toLowerCase()
        .replace(/^the\s+/, "")
        .replace(/\s*-\s*.+$/, "") // Strip sub-venue suffixes like "- Purgatory", "- Hell"
        .replace(/\s*\(.+\)$/, "") // Strip parenthetical suffixes
        .trim();
    };

    // Two-pass diversity: first grab variety across hip categories, then fill
    const venuesSeen = new Set<string>();
    const selected: ScoredEvent[] = [];
    const selectedIds = new Set<number>();

    // Pass 1: Pick top-scoring event from each hip category (ensures variety)
    // Only include if the event meets a quality bar (score >= 20)
    const MIN_FEATURED_SCORE = 20;
    const hipCategoriesSeen = new Set<string>();
    for (const event of qualityEvents) {
      const cat = event.category || "other";
      const venueName = normalizeVenueName(event.venue?.name || "");

      // Only pick from hip categories in pass 1
      if (!HIP_CATEGORIES.includes(cat)) continue;
      if (hipCategoriesSeen.has(cat)) continue;
      if (venueName && venuesSeen.has(venueName)) continue;
      // Don't force a weak event just for diversity
      if (event.quality_score < MIN_FEATURED_SCORE) continue;

      selected.push(event);
      selectedIds.add(event.id);
      hipCategoriesSeen.add(cat);
      if (venueName) venuesSeen.add(venueName);

      if (selected.length >= 8) break;
    }

    // Pass 2: Fill remaining slots with highest-scoring events (unique venues, any category)
    if (selected.length < 8) {
      for (const event of qualityEvents) {
        if (selectedIds.has(event.id)) continue;
        const venueName = normalizeVenueName(event.venue?.name || "");
        if (venueName && venuesSeen.has(venueName)) continue;

        selected.push(event);
        selectedIds.add(event.id);
        if (venueName) venuesSeen.add(venueName);

        if (selected.length >= 8) break;
      }
    }

    // If still not enough, fall back to any events (but sorted by score)
    if (selected.length < 3) {
      scoredEvents.sort((a, b) => b.quality_score - a.quality_score);
      const selectedIds = new Set(selected.map(e => e.id));
      for (const event of scoredEvents) {
        if (!selectedIds.has(event.id)) {
          selected.push(event);
          if (selected.length >= 8) break;
        }
      }
    }

    // Pin: move The Masqueraders to front (best poster/image)
    const pinIdx = selected.findIndex(e => /masqueraders/i.test(e.title));
    if (pinIdx > 0) {
      const [pinned] = selected.splice(pinIdx, 1);
      selected.unshift(pinned);
    }

    // Strip internal scoring fields before returning
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const result = selected.map(({ quality_score: _, rsvp_count, description: _d, venue_id: _v, ...event }) => ({
      ...event,
      // Include rsvp_count for display if desired
      rsvp_count: rsvp_count > 0 ? rsvp_count : undefined,
    }));

    return NextResponse.json({ events: result }, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" }
    });
  } catch (error) {
    console.error("Error in tonight API:", error);
    return NextResponse.json({ events: [] }, { status: 500 });
  }
}
