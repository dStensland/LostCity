import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { format, startOfDay, addDays, startOfWeek, startOfMonth } from "date-fns";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { resolvePortalQueryContext } from "@/lib/portal-query-context";
import { applyPortalScopeToQuery, filterByPortalCity } from "@/lib/portal-scope";

type HighlightsPeriod = "today" | "week" | "month";

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
  tags: string[] | null;
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
    image_url?: string | null;
    city?: string | null;
  } | null;
  event_artists?: {
    artist_id: string | null;
    is_headliner: boolean | null;
    billing_order: number | null;
    artist: {
      image_url: string | null;
    } | null;
  }[] | null;
};

type ScoredEvent = TonightEvent & {
  quality_score: number;
  rsvp_count: number;
};

// Period-specific configuration
const PERIOD_CONFIG: Record<HighlightsPeriod, { limit: number; candidateLimit: number; cacheSMaxAge: number; cacheStaleWhileRevalidate: number }> = {
  today: { limit: 12, candidateLimit: 200, cacheSMaxAge: 300, cacheStaleWhileRevalidate: 600 },
  week: { limit: 16, candidateLimit: 600, cacheSMaxAge: 900, cacheStaleWhileRevalidate: 1800 },
  month: { limit: 20, candidateLimit: 1000, cacheSMaxAge: 1800, cacheStaleWhileRevalidate: 3600 },
};

// Categories that appeal to young hip crowd
const HIP_CATEGORIES = ["music", "comedy", "nightlife", "art", "film", "theater", "sports"];
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
  // Arenas & stadiums (major concerts, sporting events)
  /\b(state farm arena|mercedes.benz stadium|gas south|cadence bank|lakewood)\b/i,
  // Breweries
  /\b(monday night|three taverns|orpheus|sweetwater|wild heaven)\b/i,
  // Shops & bookstores
  /\b(criminal records|wax n facts|a cappella books)\b/i,
  // Special venues
  /\b(atlanta botanical|oakland cemetery|fernbank|krog street market|ponce city)\b/i,
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

// Chain cinema patterns — regular showtimes here aren't highlight-worthy
const CHAIN_CINEMA_PATTERNS = [
  /^regal\b/i,
  /^amc\b/i,
  /^cinemark\b/i,
  /^cmx\b/i,
  /^ncg\b/i,
  /springs cinema/i,
];

// Calculate quality score optimized for young hip audience
function calculateQualityScore(
  event: TonightEvent,
  rsvpCounts: Map<number, { going: number; interested: number }>,
  venueRecCounts: Map<number, number>,
  currentHour: number,
  period: HighlightsPeriod,
  curatedEventIds?: Set<number>
): number {
  let score = 0;
  const venueName = event.venue?.name || "";
  const cat = event.category || "other";

  // Editor-curated boost: if this event was hand-picked but curated set was too
  // small to return standalone, give it a strong scoring advantage
  if (curatedEventIds?.has(event.id)) {
    score += 25;
  }

  // === VENUE QUALITY (biggest factor) ===

  // Check if it's a known hip venue (+20)
  if (HIP_VENUE_PATTERNS.some(p => p.test(venueName))) {
    score += 20;
  }

  // Penalize generic/chain venues (-30, effectively removes them)
  if (GENERIC_VENUE_PATTERNS.some(p => p.test(venueName))) {
    score -= 30;
  }

  // Hard-exclude chain cinema showtimes — never highlight-worthy.
  // Only indie/arthouse cinemas (Plaza, Tara, etc.) belong in highlights.
  const tags = event.tags || [];
  const isChainCinema = CHAIN_CINEMA_PATTERNS.some(p => p.test(venueName));
  if (cat === "film" && isChainCinema) {
    score -= 200; // effectively removed
  }

  // Hard-exclude corporate upsells, VIP suite packages, sponsored add-ons.
  // These are premium ticket add-ons, not real events people discover.
  const title = event.title || "";
  if (/\b(delta sky\s?360|sky360|suite (add-on|pass|f\/b)|premium (seating|tasting)|red carpet experience|private suite|hawks suite)\b/i.test(title)) {
    score -= 200;
  }
  // "- Suites" or "- Suite" suffix = corporate suite listing (e.g. "Gladiators vs Orlando - Suites")
  if (/\s-\s+suites?\s*$/i.test(title)) {
    score -= 200;
  }
  if (/\b(co-?sponsored|sponsored by)\b/i.test(title)) {
    score -= 50;
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

  // Has image — strong bonus since highlights are visual-first
  if (event.image_url) {
    score += 8;
  } else {
    score -= 5; // Penalty for no image — pushed down in ranking, only fills remaining slots
  }

  // Has substantial description (+3)
  if (event.description && event.description.length > 100) {
    score += 3;
  }

  // Penalize ALL_CAPS titles (often low-quality data)
  if (title.length > 5 && title === title.toUpperCase()) {
    score -= 8;
  }

  // Penalize very short or generic titles
  if (title.length <= 5) {
    score -= 10;
  }

  // Penalize truncated/stub titles (e.g. "Swarm vs.", "TBA -", "Artist:")
  if (/\b(vs\.?|feat\.?|with|at|the|-|:)\s*$/i.test(title.trim())) {
    score -= 50;
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
  if (/\b(tour|live|dj|party|21\+|18\+|drag|burlesque|improv|open mic|showcase|headliner|sold out)\b/i.test(title)) {
    score += 5;
  }

  // Extra boost for touring acts / concerts (often highest quality events)
  if ((cat === "music" || cat === "comedy") && /\b(tour|presents|live at|feat\.?|w\/|with special guest)\b/i.test(title)) {
    score += 5;
  }

  // Marquee events: touring acts at major venues are the crown jewels
  const isMajorVenue = /\b(state farm|mercedes.benz|fox theatre|tabernacle|coca.cola roxy|the eastern|buckhead theatre|variety)\b/i.test(venueName);
  if (isMajorVenue && /\b(tour|world tour|live)\b/i.test(title)) {
    score += 15;
  }

  // === DISCOVERY BONUS ===
  // The whole point: surface events you'd never find on your own.
  // These are the "oddities festival" moments — unique, one-of-a-kind experiences.
  const titleLower = title.toLowerCase();
  const titleDesc = `${titleLower} ${(event.description || "").toLowerCase()}`;

  // Immersive / experiential / one-of-a-kind (+12)
  if (/\b(immersive|experiential|pop-?up|speakeasy|secret|underground)\b/i.test(titleDesc)) {
    score += 12;
  }

  // Performance spectacle: burlesque, cabaret, variety, circus, drag show (+10)
  if (/\b(burlesque|cabaret|variety show|vaudeville|circus|aerial|sideshow|fire.?dance|fire.?show)\b/i.test(titleDesc)) {
    score += 10;
  }

  // Festivals, fairs, and special gatherings (+10)
  if (/\b(festival|fest\b|block party|night market|flea market|art market|bazaar|craft fair|expo)\b/i.test(titleLower) &&
      !/\bfilm fest/i.test(titleLower)) { // Separate boost for film fests below
    score += 10;
  }

  // Oddball / counterculture / niche (+8)
  if (/\b(oddities|bizarre|weird|occult|tarot|paranormal|ghost|séance|fortune|mystic|witchy)\b/i.test(titleDesc)) {
    score += 8;
  }

  // Unique experiences: silent disco, murder mystery, scavenger hunt, etc (+8)
  if (/\b(silent disco|murder mystery|escape room|scavenger hunt|supper club|listening party|glow hike|moonlight|stargazing)\b/i.test(titleDesc)) {
    score += 8;
  }

  // Craft / maker culture (+6)
  if (/\b(blacksmith|glass.?blow|letterpress|taxidermy|foraging|ferment|zine|comic con|cosplay)\b/i.test(titleDesc)) {
    score += 6;
  }

  // Drag + themed events at bars/venues (+6, stacks with hip keywords above)
  if (/\b(drag (brunch|bingo|show|race|queen)|themed night|costume|masquerade ball)\b/i.test(titleDesc)) {
    score += 6;
  }

  // Film premieres / special screenings (not regular showtimes) (+5)
  if (/\b(premiere|film fest|special screening|documentary|cast (meet|q&a))\b/i.test(titleDesc)) {
    score += 5;
  }

  // Penalize academic/institutional screenings — fine events but not "discovery"
  if (cat === "film" && /\b(cinematheque|film (series|club)|screening series)\b/i.test(titleLower)) {
    score -= 5;
  }

  // Boost community events that feel special/unique (not boring admin stuff)
  if (cat === "community" || cat === "learning" || cat === "food_drink") {
    const specialTags = ["date-night", "holiday", "21+", "late-night", "outdoor", "festival"];
    const specialTagCount = specialTags.filter(t => tags.includes(t)).length;
    score += specialTagCount * 3;

    // Boost events at interesting venues
    if (/museum|cemetery|botanical|aquarium|market|historic|ferst|pullman/i.test(venueName)) {
      score += 8;
    }

    // Penalize boring/administrative community events hard
    if (/\b(meeting|board meeting|authorities|committee|council|symposium|preview day|registration|volunteer registration|orientation|open house)\b/i.test(title)) {
      score -= 40;
    }

    // Penalize generic class/workshop titles
    if (/\b(class|workshop|certification|training session|webinar|seminar)\b/i.test(title) &&
        !/\b(master\s*class|cocktail|mixology|pottery|art|paint|cook)/i.test(title)) {
      score -= 15;
    }
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

  // === TIME RELEVANCE (stronger time-of-day awareness) ===
  const timeWeight = period === "today" ? 1.0 : period === "week" ? 0.3 : 0.1;

  if (event.start_time && event.start_time !== "00:00:00") {
    const eventHour = parseInt(event.start_time.split(":")[0]);

    if (currentHour < 12) {
      // Morning user: boost morning/afternoon events
      if (eventHour >= 6 && eventHour < 17) score += 8 * timeWeight;
    } else if (currentHour < 17) {
      // Afternoon user: boost afternoon/evening events
      if (eventHour >= 12 && eventHour < 22) score += 8 * timeWeight;
    } else {
      // Evening user: boost evening/late night, penalize already-passed morning
      if (eventHour >= 17 || eventHour < 4) score += 10 * timeWeight;
      const todayStr = new Date().toISOString().split("T")[0];
      if (event.start_date === todayStr && eventHour < 14) score -= 10 * timeWeight;
    }
  }

  // === FRESHNESS SIGNAL ===
  // Deprioritize weekly recurring — prefer one-off specials and discovery events.
  // Weekly open mics and recurring shows are fine but shouldn't crowd out unique stuff.
  if (event.series?.frequency === "weekly") {
    score -= 4;
    // Extra penalty for very generic recurring titles
    if (/\b(open mic|trivia night|karaoke night|bingo night|jazz jam)\b/i.test(titleLower)) {
      score -= 6;
    }
  }
  // Boost one-time events (no series — likely special/unique)
  if (!event.series_id) {
    score += 5;
  }

  // === WEEKEND PREMIUM ===
  {
    const eventDate = new Date(event.start_date + "T12:00:00");
    const dayOfWeek = eventDate.getDay(); // 0=Sun, 5=Fri, 6=Sat
    const isWeekendEvening = (dayOfWeek === 5 || dayOfWeek === 6) && event.start_time && parseInt(event.start_time.split(":")[0]) >= 18;
    if (isWeekendEvening) {
      score += 5;
      // Music and comedy are the stars of weekend nights
      if (cat === "music" || cat === "comedy" || cat === "nightlife") {
        score += 8;
      }
    }
  }

  // === FREE EVENT SIGNAL ===
  if (event.is_free) {
    score += 3;
  }

  // Penalty for no venue (sketchy)
  if (!event.venue) {
    score -= 10;
  }

  // Penalty for venue with no neighborhood (often out-of-area or bad data)
  if (event.venue && !event.venue.neighborhood) {
    score -= 8;
  }

  // For month view: meaningful boost for events in weeks 2-4 to spread beyond
  // the first week (which already appears in the "This Week" tab).
  // Without this, nearby events always outscore future marquee events.
  if (period === "month") {
    const daysOut = Math.floor((new Date(event.start_date).getTime() - new Date().getTime()) / 86400000);
    if (daysOut >= 7 && daysOut < 21) {
      score += 8; // Sweet spot: not too far, not already in "This Week"
    } else if (daysOut >= 21) {
      score += 5; // Still good, just further out
    }
  }

  return score;
}

/** Calculate date range and curated_picks lookup date for a given period */
function getDateRange(period: HighlightsPeriod, now: Date): { startDate: string; endDate: string; curatedDate: string } {
  const today = format(startOfDay(now), "yyyy-MM-dd");

  if (period === "today") {
    // Today + 2-day fallback
    const dayAfter = format(addDays(now, 2), "yyyy-MM-dd");
    return { startDate: today, endDate: dayAfter, curatedDate: today };
  }

  if (period === "week") {
    const endDate = format(addDays(now, 7), "yyyy-MM-dd");
    const monday = format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
    return { startDate: today, endDate, curatedDate: monday };
  }

  // month: next 30 days
  const endDate = format(addDays(now, 30), "yyyy-MM-dd");
  const firstOfMonth = format(startOfMonth(now), "yyyy-MM-dd");
  return { startDate: today, endDate, curatedDate: firstOfMonth };
}

const EVENT_SELECT = `
  id, title, start_date, start_time, end_date, end_time,
  is_all_day, is_free, category, image_url, description, venue_id,
  tags, series_id,
  series:series_id(
    id, slug, title, series_type, image_url, frequency, day_of_week,
    festival:festivals(id, slug, name, image_url, festival_type, location, neighborhood)
  ),
  venue:venues(name, neighborhood, image_url, city),
  event_artists(artist_id, is_headliner, billing_order, artist:artists(image_url))
`;

export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  try {
    // Parse period param
    const periodParam = request.nextUrl.searchParams.get("period") || "today";
    const period: HighlightsPeriod = (["today", "week", "month"] as const).includes(periodParam as HighlightsPeriod)
      ? (periodParam as HighlightsPeriod)
      : "today";

    const config = PERIOD_CONFIG[period];
    const now = new Date();
    const currentHour = now.getHours();
    const today = format(startOfDay(now), "yyyy-MM-dd");
    const { startDate, endDate, curatedDate } = getDateRange(period, now);

    const cacheHeaders = {
      "Cache-Control": `public, s-maxage=${config.cacheSMaxAge}, stale-while-revalidate=${config.cacheStaleWhileRevalidate}`,
    };

    const supabase = await createClient();

    const portalContext = await resolvePortalQueryContext(supabase, request.nextUrl.searchParams);
    if (portalContext.hasPortalParamMismatch) {
      return NextResponse.json(
        { error: "portal and portal_id parameters must reference the same portal" },
        { status: 400 }
      );
    }

    // PERFORMANCE: Run portal lookup and curated picks fetch in parallel
    const [curatedPicksResult, activePortalResult] = await Promise.all([
      // Check for curated picks first — if editor-curated picks exist for this period,
      // return those directly instead of running the scoring algorithm
      supabase
        .from("curated_picks")
        .select("event_id, position")
        .eq("pick_date", curatedDate)
        .eq("period", period)
        .order("position", { ascending: true }),

      portalContext.portalId
        ? Promise.resolve({ data: { id: portalContext.portalId } })
        : supabase
            .from("portals")
            .select("id")
            .eq("slug", "atlanta")
            .single<{ id: string }>()
    ]);

    const { data: curatedPicks } = curatedPicksResult;
    const { data: activePortal } = activePortalResult;

    if (!activePortal) {
      console.error("Active portal not found");
      return NextResponse.json({ events: [], period }, { status: 500 });
    }

    // Curated picks: only use if they provide at least 80% of the target limit.
    // Otherwise fall through to the algorithm and boost curated events in scoring.
    const curatedEventIds = new Set<number>();
    if (curatedPicks && curatedPicks.length > 0) {
      const curatedIds = (curatedPicks as { event_id: number; position: number }[]).map(p => p.event_id);

      // Only return curated-only if they fill most of the target
      if (curatedIds.length >= Math.floor(config.limit * 0.8)) {
        const { data: curatedEvents } = await supabase
          .from("events")
          .select(EVENT_SELECT)
          .in("id", curatedIds);

        if (curatedEvents && curatedEvents.length >= Math.floor(config.limit * 0.8)) {
          // Filter to only future events (curated picks may include past events)
          const validEvents = (curatedEvents as unknown as TonightEvent[]).filter(
            e => e.start_date >= today
          );

          if (validEvents.length >= Math.floor(config.limit * 0.8)) {
            const orderMap = new Map(curatedIds.map((id, i) => [id, i]));
            const sorted = validEvents.sort(
              (a, b) => (orderMap.get(a.id) ?? 99) - (orderMap.get(b.id) ?? 99)
            );

            const cIds = sorted.map(e => e.id);
            const { data: cRsvps } = await supabase
              .from("event_rsvps")
              .select("event_id, status")
              .in("event_id", cIds)
              .in("status", ["going", "interested"]);

            const cRsvpCounts = new Map<number, number>();
            for (const r of (cRsvps || []) as { event_id: number; status: string }[]) {
              cRsvpCounts.set(r.event_id, (cRsvpCounts.get(r.event_id) || 0) + 1);
            }

            const result = sorted.map(({ description: _d, venue_id: _v, ...event }) => {
              void _d;
              void _v;
              return {
                ...event,
                rsvp_count:
                  (cRsvpCounts.get(event.id) || 0) > 0 ? cRsvpCounts.get(event.id) : undefined,
              };
            });

            return NextResponse.json({ events: result, period }, { headers: cacheHeaders });
          }
        }
      }

      // If curated picks didn't fill the target, use them as a scoring boost
      for (const id of curatedIds) {
        curatedEventIds.add(id);
      }
    }

    // Fetch candidates in two pools to ensure diversity:
    // 1. Non-film events (the diverse pool — music, comedy, art, etc.)
    // 2. Small indie film sample (chain cinemas excluded entirely — only arthouse/indie)
    // Without this split, film showtimes (~60% of all events) flood the candidate pool.
    const baseFilters = (query: ReturnType<typeof supabase.from>) => {
      let scoped = query
        .gte("start_date", startDate)
        .lte("start_date", endDate)
        .is("canonical_event_id", null)
        .or("is_class.eq.false,is_class.is.null")
        .or("is_sensitive.eq.false,is_sensitive.is.null");

      scoped = applyPortalScopeToQuery(scoped, {
        portalId: activePortal.id,
        portalExclusive: false,
        publicOnlyWhenNoPortal: true,
      });

      return scoped;
    };

    // For month: fetch candidates per-week-bucket to ensure temporal diversity.
    // Without this, the 1000-row limit fills entirely with W0 events (1200+ exist)
    // and W2+ events never enter the candidate pool.
    // For today/week: single query is fine (7 days max, all fit in the limit).
    let allEvents: TonightEvent[] = [];

    if (period === "month") {
      // Split 30-day range into weekly buckets, fetch top candidates from each
      const PER_WEEK_LIMIT = Math.floor(config.candidateLimit / 5); // ~200 per week
      const weekQueries: Promise<{ data: unknown[] | null }>[] = [];
      for (let w = 0; w < 5; w++) {
        const wStart = format(addDays(now, w * 7), "yyyy-MM-dd");
        const wEnd = format(addDays(now, (w + 1) * 7 - 1), "yyyy-MM-dd");
        weekQueries.push(
          baseFilters(supabase.from("events").select(EVENT_SELECT))
            .gte("start_date", wStart)
            .lte("start_date", wEnd)
            .neq("category", "film")
            .not("image_url", "is", null)
            .order("start_date", { ascending: true })
            .order("start_time", { ascending: true })
            .limit(PER_WEEK_LIMIT)
        );
      }
      // Also fetch indie film sample
      weekQueries.push(
        baseFilters(supabase.from("events").select(EVENT_SELECT))
          .eq("category", "film")
          .not("image_url", "is", null)
          .not("tags", "cs", "{showtime}")
          .order("start_date", { ascending: true })
          .order("start_time", { ascending: true })
          .limit(50)
      );

      const weekResults = await Promise.all(weekQueries);
      for (const result of weekResults) {
        if (result.data) {
          allEvents.push(...(result.data as unknown as TonightEvent[]));
        }
      }
    } else {
      // Today/week: single fetch is fine
      const [nonFilmResult, filmResult] = await Promise.all([
        baseFilters(supabase.from("events").select(EVENT_SELECT))
          .neq("category", "film")
          .not("image_url", "is", null)
          .order("start_date", { ascending: true })
          .order("start_time", { ascending: true })
          .limit(config.candidateLimit),
        // Only fetch film events that AREN'T regular chain showtimes
        baseFilters(supabase.from("events").select(EVENT_SELECT))
          .eq("category", "film")
          .not("image_url", "is", null)
          .not("tags", "cs", "{showtime}")
          .order("start_date", { ascending: true })
          .order("start_time", { ascending: true })
          .limit(period === "today" ? 30 : 50),
      ]);

      if (nonFilmResult.error && filmResult.error) {
        console.error("Failed to fetch tonight events:", nonFilmResult.error);
        return NextResponse.json({ events: [], period }, {
          headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" }
        });
      }

      allEvents = [
        ...((nonFilmResult.data || []) as unknown as TonightEvent[]),
        ...((filmResult.data || []) as unknown as TonightEvent[]),
      ];
    }

    // Pass B: For week/month, backfill with imageless events if the image pool is thin.
    // This ensures we always have enough candidates to fill 16-20 slots.
    if (period !== "today" && allEvents.length < config.candidateLimit) {
      const imageEventIds = new Set(allEvents.map(e => e.id));
      const backfillLimit = config.candidateLimit - allEvents.length;

      const { data: backfillData } = await baseFilters(supabase.from("events").select(EVENT_SELECT))
        .neq("category", "film")
        .is("image_url", null)
        .order("start_date", { ascending: true })
        .order("start_time", { ascending: true })
        .limit(backfillLimit);

      if (backfillData) {
        const backfillEvents = (backfillData as unknown as TonightEvent[]).filter(e => !imageEventIds.has(e.id));
        allEvents = [...allEvents, ...backfillEvents];
      }
    }

    // Filter out cross-city leakage when including portal_id IS NULL rows.
    allEvents = filterByPortalCity(
      allEvents,
      portalContext.filters.city || "Atlanta",
      { allowMissingCity: false }
    );

    // Filter out today's events that already happened (started > 2 hours ago)
    // Only applies to today's date — future dates always included
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
      return NextResponse.json({ events: [], period }, { headers: cacheHeaders });
    }

    // PERFORMANCE: Fetch RSVP counts and venue recommendations in parallel
    const eventIds = typedEvents.map(e => e.id);
    const venueIds = typedEvents.map(e => e.venue_id).filter((id): id is number => id !== null);

    const [rsvpResult, recResult] = await Promise.all([
      // Fetch RSVP counts for these events
      supabase
        .from("event_rsvps")
        .select("event_id, status")
        .in("event_id", eventIds)
        .in("status", ["going", "interested"]),

      // Fetch venue recommendation counts
      venueIds.length > 0
        ? supabase
            .from("recommendations")
            .select("venue_id")
            .in("venue_id", venueIds)
            .eq("visibility", "public")
        : Promise.resolve({ data: [] })
    ]);

    // Aggregate RSVP counts
    const rsvpCounts = new Map<number, { going: number; interested: number }>();
    const typedRsvps = (rsvpResult.data || []) as { event_id: number; status: string }[];
    for (const rsvp of typedRsvps) {
      const counts = rsvpCounts.get(rsvp.event_id) || { going: 0, interested: 0 };
      if (rsvp.status === "going") counts.going++;
      else if (rsvp.status === "interested") counts.interested++;
      rsvpCounts.set(rsvp.event_id, counts);
    }

    // Aggregate venue recommendation counts
    const venueRecCounts = new Map<number, number>();
    const typedRecs = (recResult.data || []) as { venue_id: number }[];
    for (const rec of typedRecs) {
      if (rec.venue_id) {
        venueRecCounts.set(rec.venue_id, (venueRecCounts.get(rec.venue_id) || 0) + 1);
      }
    }

    // Image resolution: for events without their own image, try to resolve one.
    // For shows (music/comedy), prioritize headliner artist image over venue.
    // Chain: headliner artist -> series -> festival -> venue
    for (const event of typedEvents) {
      if (!event.image_url) {
        // Find headliner artist image (best for shows)
        const headlinerImage = event.event_artists
          ?.sort((a, b) => (a.billing_order || 99) - (b.billing_order || 99))
          .find(ea => ea.artist?.image_url)
          ?.artist?.image_url;

        event.image_url =
          headlinerImage ||
          event.series?.image_url ||
          event.series?.festival?.image_url ||
          event.venue?.image_url ||
          null;
      }
    }

    // Score all events (after image resolution so the image bonus is accurate)
    const scoredEvents: ScoredEvent[] = typedEvents.map(event => {
      const rsvps = rsvpCounts.get(event.id);
      let score = calculateQualityScore(event, rsvpCounts, venueRecCounts, currentHour, period, curatedEventIds);

      // Bonus for today's events (only relevant for today period)
      if (period === "today" && event.start_date === today) {
        score += 5;
      }

      return {
        ...event,
        quality_score: score,
        rsvp_count: rsvps ? rsvps.going + rsvps.interested : 0,
      };
    });

    // Filter out events with very negative scores (generic/low quality)
    // Today requires images (hero carousel). Week/month allow imageless events
    // as backfill — they rank lower since image resolution already ran.
    // Also dedupe by title+venue (some events appear multiple times)
    const seen = new Set<string>();
    const qualityEvents = scoredEvents.filter(e => {
      if (e.quality_score <= -10) return false;
      if (period === "today" && !e.image_url) return false;

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

    // Multi-pass diversity: first grab variety across hip categories, then fill
    const venueCounts = new Map<string, number>();
    const selected: ScoredEvent[] = [];
    const selectedIds = new Set<number>();
    const categoryCounts = new Map<string, number>();
    const seriesCounts = new Map<string, number>();
    const neighborhoodCounts = new Map<string, number>();
    // Category caps — generous enough for music/comedy on a Saturday
    const MAX_PER_CATEGORY = period === "today" ? 3 : period === "week" ? 5 : 7;
    // Film gets a tighter cap — screenings are fine but shouldn't dominate the feed
    const MAX_FILM = period === "today" ? 2 : period === "week" ? 2 : 3;
    const MAX_PER_NEIGHBORHOOD = period === "today" ? 4 : period === "week" ? 6 : 8;
    // Allow 2 events per venue for today, 3 for longer periods (sub-venues like Masquerade rooms)
    const MAX_PER_VENUE = period === "today" ? 2 : 3;
    // Series dedup: today=1 (don't show same series twice), week=2, month=3
    // A great weekly series should appear on multiple dates in a 30-day view
    const MAX_PER_SERIES = period === "today" ? 1 : period === "week" ? 2 : 3;

    // Date spread: for week/month, cap events per date to encourage temporal diversity
    const dateCounts = new Map<string, number>();
    const MAX_PER_DATE = period === "today" ? 999 : period === "week" ? 3 : 2;
    // Week-bucket spread: for month, also track per-week counts to ensure
    // we showcase events from weeks 2-4, not just the upcoming few days
    const weekBucketCounts = new Map<number, number>();
    // Month: max 5 per week (20 events / ~4 weeks = 5 ideal). Tight cap forces
    // temporal diversity — without it W0 grabs 10+ slots via Pass 3 relaxation.
    const MAX_PER_WEEK_BUCKET = period === "month" ? 5 : 999;
    const getWeekBucket = (dateStr: string) => {
      const daysOut = Math.floor((new Date(dateStr).getTime() - new Date(today).getTime()) / 86400000);
      return Math.floor(daysOut / 7);
    };
    const trackDate = (date: string) => {
      dateCounts.set(date, (dateCounts.get(date) || 0) + 1);
      if (period === "month") {
        const wb = getWeekBucket(date);
        weekBucketCounts.set(wb, (weekBucketCounts.get(wb) || 0) + 1);
      }
    };
    const isDateFull = (date: string) => {
      if ((dateCounts.get(date) || 0) >= MAX_PER_DATE) return true;
      if (period === "month") {
        const wb = getWeekBucket(date);
        if ((weekBucketCounts.get(wb) || 0) >= MAX_PER_WEEK_BUCKET) return true;
      }
      return false;
    };

    // Diversity helpers
    const trackNeighborhood = (event: ScoredEvent) => {
      const hood = event.venue?.neighborhood;
      if (hood) neighborhoodCounts.set(hood, (neighborhoodCounts.get(hood) || 0) + 1);
    };
    const isNeighborhoodFull = (event: ScoredEvent) => {
      const hood = event.venue?.neighborhood;
      return hood ? (neighborhoodCounts.get(hood) || 0) >= MAX_PER_NEIGHBORHOOD : false;
    };
    const trackVenue = (venueName: string) => {
      if (venueName) venueCounts.set(venueName, (venueCounts.get(venueName) || 0) + 1);
    };
    const isVenueFull = (venueName: string) => {
      return venueName ? (venueCounts.get(venueName) || 0) >= MAX_PER_VENUE : false;
    };
    const trackSeries = (seriesId: string) => {
      seriesCounts.set(seriesId, (seriesCounts.get(seriesId) || 0) + 1);
    };
    const isSeriesFull = (seriesId: string | null | undefined) => {
      if (!seriesId) return false;
      return (seriesCounts.get(seriesId) || 0) >= MAX_PER_SERIES;
    };

    // Pass 1: Pick top-scoring event from each hip category (ensures variety)
    const MIN_FEATURED_SCORE = 10;
    const hipCategoriesSeen = new Set<string>();
    for (const event of qualityEvents) {
      const cat = event.category || "other";
      const venueName = normalizeVenueName(event.venue?.name || "");

      if (!HIP_CATEGORIES.includes(cat)) continue;
      if (hipCategoriesSeen.has(cat)) continue;
      if (isVenueFull(venueName)) continue;
      if (event.quality_score < MIN_FEATURED_SCORE) continue;
      if (isSeriesFull(event.series_id)) continue;
      if (isNeighborhoodFull(event)) continue;
      if (isDateFull(event.start_date)) continue;

      selected.push(event);
      selectedIds.add(event.id);
      hipCategoriesSeen.add(cat);
      categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
      trackVenue(venueName);
      if (event.series_id) trackSeries(event.series_id);
      trackNeighborhood(event);
      trackDate(event.start_date);

      if (selected.length >= config.limit) break;
    }

    // Pass 1b (month only): Reserve top 2 events from each future week.
    // Without this, weeks 2-4 get zero representation because Pass 2 fills
    // all slots with high-scoring nearby events. This ensures Lady Gaga,
    // TWICE, and other marquee future events always appear.
    if (period === "month" && selected.length < config.limit) {
      const weekEventCounts = new Map<number, number>();
      for (const e of selected) {
        const wb = getWeekBucket(e.start_date);
        weekEventCounts.set(wb, (weekEventCounts.get(wb) || 0) + 1);
      }
      const RESERVE_PER_WEEK = 2;
      for (let w = 1; w <= 4; w++) {
        const alreadyHave = weekEventCounts.get(w) || 0;
        const needed = RESERVE_PER_WEEK - alreadyHave;
        if (needed <= 0) continue;
        let added = 0;
        for (const e of qualityEvents) {
          if (added >= needed) break;
          if (selectedIds.has(e.id)) continue;
          if (getWeekBucket(e.start_date) !== w) continue;
          if (e.quality_score < MIN_FEATURED_SCORE) continue;

          const cat = e.category || "other";
          const venueName = normalizeVenueName(e.venue?.name || "");
          selected.push(e);
          selectedIds.add(e.id);
          categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
          trackVenue(venueName);
          if (e.series_id) trackSeries(e.series_id);
          trackNeighborhood(e);
          trackDate(e.start_date);
          added++;
        }
        if (selected.length >= config.limit) break;
      }
    }

    // Pass 2: Fill remaining slots with highest-scoring events
    // Enforce category, neighborhood, date diversity and series/venue caps
    if (selected.length < config.limit) {
      for (const event of qualityEvents) {
        if (selectedIds.has(event.id)) continue;
        const cat = event.category || "other";
        const venueName = normalizeVenueName(event.venue?.name || "");

        if (isVenueFull(venueName)) continue;
        if ((categoryCounts.get(cat) || 0) >= MAX_PER_CATEGORY) continue;
        if (cat === "film" && (categoryCounts.get("film") || 0) >= MAX_FILM) continue;
        if (isSeriesFull(event.series_id)) continue;
        if (isNeighborhoodFull(event)) continue;
        if (isDateFull(event.start_date)) continue;

        selected.push(event);
        selectedIds.add(event.id);
        categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
        trackVenue(venueName);
        if (event.series_id) trackSeries(event.series_id);
        trackNeighborhood(event);
        trackDate(event.start_date);

        if (selected.length >= config.limit) break;
      }
    }

    // Pass 3: If still short, relax category/neighborhood/series caps but keep date diversity
    if (selected.length < config.limit) {
      for (const event of qualityEvents) {
        if (selectedIds.has(event.id)) continue;
        const cat = event.category || "other";
        const venueName = normalizeVenueName(event.venue?.name || "");

        if (isVenueFull(venueName)) continue;
        if ((categoryCounts.get(cat) || 0) >= MAX_PER_CATEGORY + 3) continue;
        if (cat === "film" && (categoryCounts.get("film") || 0) >= MAX_FILM + 1) continue;
        // Relaxed date cap: allow 1 more per date, but keep week-bucket cap
        if ((dateCounts.get(event.start_date) || 0) >= MAX_PER_DATE + 1) continue;
        if (period === "month") {
          const wb = getWeekBucket(event.start_date);
          if ((weekBucketCounts.get(wb) || 0) >= MAX_PER_WEEK_BUCKET + 2) continue;
        }

        selected.push(event);
        selectedIds.add(event.id);
        categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
        trackVenue(venueName);
        if (event.series_id) trackSeries(event.series_id);
        trackNeighborhood(event);
        trackDate(event.start_date);

        if (selected.length >= config.limit) break;
      }
    }

    // Strip internal scoring fields, venue image_url, and event_artists before returning
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const result = selected.map(({ quality_score: _, rsvp_count, description: _d, venue_id: _v, tags: _t, event_artists: _ea, ...event }) => ({
      ...event,
      // Strip venue.image_url (only used internally for image resolution)
      venue: event.venue ? { name: event.venue.name, neighborhood: event.venue.neighborhood } : null,
      rsvp_count: rsvp_count > 0 ? rsvp_count : undefined,
    }));

    return NextResponse.json({ events: result, period }, { headers: cacheHeaders });
  } catch (error) {
    console.error("Error in tonight API:", error);
    return NextResponse.json({ events: [], period: "today" }, { status: 500 });
  }
}
