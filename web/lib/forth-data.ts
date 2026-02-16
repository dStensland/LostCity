/**
 * Server-side data fetching for the FORTH hotel concierge portal.
 * All functions run on the server and return pre-computed data for client components.
 *
 * IMPORTANT: This module queries Supabase directly (no HTTP self-fetch).
 * The previous implementation called our own API routes over HTTP during SSR,
 * adding 200-500ms per round-trip. Direct queries eliminate that overhead.
 */

import type {
  ForthFeedData,
  ForthPropertyData,
  FeedSection,
  FeedEvent,
  Destination,
  SpecialsMeta,
  DayPart,
  SignatureVenue,
  ForthAmenity,
  InRoomRequest,
  QuickAction,
} from "./forth-types";
import type { Portal } from "./portal-context";
import { createClient } from "./supabase/server";
import { getPortalSourceAccess } from "./federation";
import { getLocalDateString } from "./formats";
import {
  haversineDistanceKm,
  getProximityTier,
  getProximityLabel,
  getWalkingMinutes,
  type ProximityTier,
} from "./geo";
import { addDays, startOfDay, nextFriday, nextSunday, isFriday, isSaturday, isSunday } from "date-fns";

// ---------------------------------------------------------------------------
// Daypart helpers
// ---------------------------------------------------------------------------

export function getDayPart(now: Date): DayPart {
  const hour = now.getHours();
  if (hour >= 6 && hour < 11) return "morning";
  if (hour >= 11 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 23) return "evening";
  return "late_night";
}

export function getDayPartGreeting(dayPart: DayPart, portalName?: string): { title: string; subtitle: string } {
  const name = portalName || "your hotel";
  switch (dayPart) {
    case "morning":
      return {
        title: "Good Morning",
        subtitle: `Start your stay with the best coffee, brunch, and nearby options around ${name}.`,
      };
    case "afternoon":
      return {
        title: "Your Afternoon Plan",
        subtitle: "Happy hour, dinner, and tonight's standout events, arranged for easy decisions.",
      };
    case "evening":
      return {
        title: "Good Evening",
        subtitle: "Live specials, top events, and walkable picks for a great evening.",
      };
    case "late_night":
      return {
        title: "Late Night",
        subtitle: "Best nightcap options now plus strong picks for tomorrow morning.",
      };
  }
}

export function getQuickActions(dayPart: DayPart): QuickAction[] {
  switch (dayPart) {
    case "morning":
      return [
        { label: "Coffee nearby", icon: "coffee", sectionId: "nearby" },
        { label: "Today's events", icon: "calendar", sectionId: "tonight" },
        { label: "Spa booking", icon: "spa", sectionId: "property" },
      ];
    case "afternoon":
      return [
        { label: "Lunch spots", icon: "utensils", sectionId: "nearby" },
        { label: "Tonight's picks", icon: "sparkles", sectionId: "tonight" },
        { label: "BeltLine walk", icon: "map", sectionId: "nearby" },
      ];
    case "evening":
      return [
        { label: "Dinner reservations", icon: "utensils", sectionId: "property" },
        { label: "Live tonight", icon: "music", sectionId: "tonight" },
        { label: "Rooftop drinks", icon: "glass", sectionId: "property" },
      ];
    case "late_night":
      return [
        { label: "Late-night bites", icon: "utensils", sectionId: "nearby" },
        { label: "Bars open now", icon: "glass", sectionId: "specials" },
        { label: "Nightcap spots", icon: "moon", sectionId: "nearby" },
      ];
  }
}

// ---------------------------------------------------------------------------
// Hero photos by daypart
// ---------------------------------------------------------------------------

export const HERO_PHOTOS_BY_DAYPART: Record<DayPart, string> = {
  morning: "https://images.unsplash.com/photo-1444201983204-c43cbd584d93?auto=format&fit=crop&w=2200&q=80",
  afternoon: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=2200&q=80",
  evening: "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=2200&q=80",
  late_night: "https://images.unsplash.com/photo-1544148103-0773bf10d330?auto=format&fit=crop&w=2200&q=80",
};

// ---------------------------------------------------------------------------
// Default property data (fallback when not in portal.settings)
// ---------------------------------------------------------------------------

const DEFAULT_SIGNATURE_VENUES: SignatureVenue[] = [
  {
    id: "il-premio",
    name: "Il Premio",
    typeLabel: "Steakhouse",
    kind: "restaurant",
    spotlight: "Signature dinner room with prime cuts and Italian influence.",
    mockSpecial: "Sommelier Pairing Menu",
    mockNote: "Four-course pairing from $95",
    photoUrl: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1600&q=80",
  },
  {
    id: "elektra",
    name: "Elektra",
    typeLabel: "Pool Restaurant",
    kind: "restaurant",
    spotlight: "Poolside Mediterranean with daytime-to-sunset transitions.",
    mockSpecial: "Poolside Lunch Prix Fixe",
    mockNote: "Weekdays until 3pm",
    photoUrl: "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1600&q=80",
  },
  {
    id: "bar-premio",
    name: "Bar Premio",
    typeLabel: "Cocktail Bar",
    kind: "bar",
    spotlight: "Pre-dinner cocktails anchored around classic Italian aperitivo.",
    mockSpecial: "Aperitivo Hour",
    mockNote: "5pm to 7pm",
    photoUrl: "https://images.unsplash.com/photo-1470337458703-46ad1756a187?auto=format&fit=crop&w=1600&q=80",
  },
  {
    id: "moonlight",
    name: "Moonlight at FORTH",
    typeLabel: "Rooftop Bar",
    kind: "bar",
    spotlight: "Rooftop views and late-night cocktail programming.",
    mockSpecial: "Sunset Martini Service",
    mockNote: "Daily from 6pm",
    photoUrl: "https://images.unsplash.com/photo-1514933651103-005eec06c04b2?auto=format&fit=crop&w=1600&q=80",
  },
];

const DEFAULT_AMENITIES: ForthAmenity[] = [
  {
    id: "spa",
    name: "FORTH Spa",
    serviceWindow: "Daily care",
    detail: "Treatment suites, hydrotherapy, private booking support.",
    photoUrl: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=1600&q=80",
  },
  {
    id: "fitness",
    name: "Fitness Club",
    serviceWindow: "Open 24/7",
    detail: "24/7 training floor with guest access and class blocks.",
    photoUrl: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1600&q=80",
  },
  {
    id: "pool",
    name: "Pool Deck",
    serviceWindow: "Daylight to sunset",
    detail: "Resort-style loungers, service programming, and private cabana options.",
    photoUrl: "https://images.unsplash.com/photo-1576013551627-0b0f2ecb12e1?auto=format&fit=crop&w=1600&q=80",
  },
  {
    id: "concierge",
    name: "Concierge Desk",
    serviceWindow: "Always on",
    detail: "Dining priority holds, route planning, and in-room recommendations.",
    photoUrl: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1600&q=80",
  },
];

const DEFAULT_IN_ROOM_SERVICES: InRoomRequest[] = [
  {
    id: "spa-reset",
    title: "Spa Reset (75 min)",
    detail: "Thermal circuit plus recovery treatment designed for arrival-day decompression.",
    etaLabel: "Earliest same-day",
    ctaLabel: "Request treatment",
  },
  {
    id: "dining-hold",
    title: "Priority Dinner Hold",
    detail: "Priority table hold at signature venues based on your selected preferences.",
    etaLabel: "2-5 min setup",
    ctaLabel: "Place hold",
  },
  {
    id: "house-car",
    title: "House Car Routing",
    detail: "Door-to-door transfer for key city stops when timing matters most.",
    etaLabel: "Dispatch window 10-20 min",
    ctaLabel: "Request car",
  },
  {
    id: "late-checkout",
    title: "Late Checkout",
    detail: "Extend departure based on occupancy and active itinerary.",
    etaLabel: "Response within minutes",
    ctaLabel: "Check availability",
  },
];

// ---------------------------------------------------------------------------
// Internal query types
// ---------------------------------------------------------------------------

type DbSection = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  section_type: "auto" | "curated" | "mixed";
  block_type: string;
  max_items: number;
  auto_filter: {
    categories?: string[];
    subcategories?: string[];
    tags?: string[];
    is_free?: boolean;
    date_filter?: string;
    sort_by?: string;
    source_ids?: number[];
    venue_ids?: number[];
    exclude_ids?: number[];
    exclude_categories?: string[];
    event_ids?: number[];
  } | null;
  display_order: number;
  is_visible: boolean;
  schedule_start: string | null;
  schedule_end: string | null;
  show_on_days: string[] | null;
  show_after_time: string | null;
  show_before_time: string | null;
  portal_section_items: Array<{
    id: string;
    entity_type: string;
    entity_id: number;
    display_order: number;
  }>;
};

type DbEvent = {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  end_date: string | null;
  is_all_day: boolean;
  is_free: boolean;
  price_min: number | null;
  category: string | null;
  subcategory: string | null;
  image_url: string | null;
  description: string | null;
  tags: string[] | null;
  source_id: number | null;
  venue: {
    id: number;
    name: string;
    neighborhood: string | null;
    slug: string | null;
    venue_type: string | null;
    city: string | null;
  } | null;
};

type DbVenue = {
  id: number;
  name: string;
  slug: string;
  neighborhood: string | null;
  venue_type: string | null;
  lat: number | null;
  lng: number | null;
  city: string | null;
  image_url: string | null;
  short_description: string | null;
};

type DbSpecial = {
  id: number;
  venue_id: number;
  title: string;
  type: string;
  days_of_week: number[] | null;
  time_start: string | null;
  time_end: string | null;
  start_date: string | null;
  end_date: string | null;
  price_note: string | null;
  confidence: string | null;
  last_verified_at: string | null;
};

type DbNextEvent = {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  venue_id: number | null;
  source_id: number | null;
  category: string | null;
};

// ---------------------------------------------------------------------------
// Section visibility + date range helpers (from feed route)
// ---------------------------------------------------------------------------

function isSectionVisible(section: DbSection): boolean {
  const now = new Date();
  const today = getLocalDateString();
  const currentTime = now.toTimeString().slice(0, 5);
  const currentDay = now.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();

  if (section.schedule_start && today < section.schedule_start) return false;
  if (section.schedule_end && today > section.schedule_end) return false;
  if (section.show_on_days?.length && !section.show_on_days.includes(currentDay)) return false;
  if (section.show_after_time && currentTime < section.show_after_time) return false;
  if (section.show_before_time && currentTime > section.show_before_time) return false;
  return true;
}

function getDateRange(filter: string): { start: string; end: string } {
  const now = new Date();
  const today = startOfDay(now);

  switch (filter) {
    case "today":
      return { start: getLocalDateString(today), end: getLocalDateString(today) };
    case "tomorrow": {
      const tomorrow = addDays(today, 1);
      return { start: getLocalDateString(tomorrow), end: getLocalDateString(tomorrow) };
    }
    case "this_weekend": {
      let friday: Date;
      let sunday: Date;
      if (isFriday(now) || isSaturday(now) || isSunday(now)) {
        friday = isFriday(now) ? today : addDays(today, -(now.getDay() - 5));
        sunday = isSunday(now) ? today : addDays(today, 7 - now.getDay());
      } else {
        friday = nextFriday(today);
        sunday = nextSunday(today);
      }
      return { start: getLocalDateString(friday), end: getLocalDateString(sunday) };
    }
    case "next_7_days":
      return { start: getLocalDateString(today), end: getLocalDateString(addDays(today, 7)) };
    case "next_30_days":
      return { start: getLocalDateString(today), end: getLocalDateString(addDays(today, 30)) };
    default:
      return { start: getLocalDateString(today), end: getLocalDateString(addDays(today, 14)) };
  }
}

// ---------------------------------------------------------------------------
// Specials status helpers (from specials route)
// ---------------------------------------------------------------------------

type SpecialState = "active_now" | "starting_soon" | "none";

function getTimeMinutes(time: string | null): number | null {
  if (!time) return null;
  const [hourStr, minuteStr] = time.split(":");
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  return hour * 60 + minute;
}

function getSpecialStatus(
  special: DbSpecial,
  now: Date,
  includeUpcomingHours: number,
  today: string
): { state: "active_now" | "starting_soon" | "inactive"; startsInMinutes: number | null; remainingMinutes: number | null } {
  // Date eligibility
  if (special.start_date && special.start_date > today) return { state: "inactive", startsInMinutes: null, remainingMinutes: null };
  if (special.end_date && special.end_date < today) return { state: "inactive", startsInMinutes: null, remainingMinutes: null };

  // Day of week check (ISO: 1=Mon, 7=Sun)
  const jsDay = now.getDay();
  const currentIsoDay = jsDay === 0 ? 7 : jsDay;
  if (special.days_of_week?.length && !special.days_of_week.includes(currentIsoDay)) {
    return { state: "inactive", startsInMinutes: null, remainingMinutes: null };
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = getTimeMinutes(special.time_start);
  const endMinutes = getTimeMinutes(special.time_end);
  const upcomingWindow = Math.max(0, Math.floor(includeUpcomingHours * 60));

  if (startMinutes === null && endMinutes === null) {
    return { state: "active_now", startsInMinutes: null, remainingMinutes: null };
  }
  if (startMinutes !== null && endMinutes === null) {
    if (currentMinutes >= startMinutes) return { state: "active_now", startsInMinutes: 0, remainingMinutes: null };
    const startsIn = startMinutes - currentMinutes;
    if (startsIn <= upcomingWindow) return { state: "starting_soon", startsInMinutes: startsIn, remainingMinutes: null };
    return { state: "inactive", startsInMinutes: startsIn, remainingMinutes: null };
  }
  if (startMinutes === null && endMinutes !== null) {
    if (currentMinutes <= endMinutes) return { state: "active_now", startsInMinutes: null, remainingMinutes: endMinutes - currentMinutes };
    return { state: "inactive", startsInMinutes: null, remainingMinutes: null };
  }
  if (startMinutes !== null && endMinutes !== null) {
    // Overnight specials
    if (startMinutes > endMinutes) {
      const isActive = currentMinutes >= startMinutes || currentMinutes <= endMinutes;
      if (isActive) {
        const remaining = currentMinutes <= endMinutes
          ? endMinutes - currentMinutes
          : (24 * 60 - currentMinutes) + endMinutes;
        return { state: "active_now", startsInMinutes: 0, remainingMinutes: remaining };
      }
      const startsIn = startMinutes - currentMinutes;
      if (startsIn >= 0 && startsIn <= upcomingWindow) return { state: "starting_soon", startsInMinutes: startsIn, remainingMinutes: null };
      return { state: "inactive", startsInMinutes: startsIn, remainingMinutes: null };
    }
    if (currentMinutes >= startMinutes && currentMinutes <= endMinutes) {
      return { state: "active_now", startsInMinutes: 0, remainingMinutes: endMinutes - currentMinutes };
    }
    if (currentMinutes < startMinutes) {
      const startsIn = startMinutes - currentMinutes;
      if (startsIn <= upcomingWindow) return { state: "starting_soon", startsInMinutes: startsIn, remainingMinutes: null };
      return { state: "inactive", startsInMinutes: startsIn, remainingMinutes: null };
    }
  }
  return { state: "inactive", startsInMinutes: null, remainingMinutes: null };
}

function scoreDestination(
  tier: ProximityTier,
  state: SpecialState,
  confidence: string | null,
  lastVerifiedAt: string | null
): number {
  const proximityWeight = tier === "walkable" ? 100 : tier === "close" ? 60 : 30;
  const stateWeight = state === "active_now" ? 50 : state === "starting_soon" ? 20 : 0;
  const confScore = { high: 3, medium: 2, low: 1 }[(confidence || "medium").toLowerCase()] || 1;
  let freshnessWeight = 0;
  if (lastVerifiedAt) {
    const ageDays = (Date.now() - new Date(lastVerifiedAt).getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays <= 7) freshnessWeight = 10;
    else if (ageDays <= 30) freshnessWeight = 5;
  }
  return proximityWeight + stateWeight + confScore * 3 + freshnessWeight;
}

// ---------------------------------------------------------------------------
// Direct database queries
// ---------------------------------------------------------------------------

const EVENT_SELECT = `
  id, title, start_date, start_time, end_date, is_all_day, is_free, price_min,
  category, subcategory, image_url, description, tags, source_id,
  venue:venues(id, name, neighborhood, slug, venue_type, city)
`;

/**
 * Fetch feed sections + events directly from Supabase.
 * Simplified version of the feed route — skips holiday sections, nightlife compound mode,
 * social proof counts, and date bucket distribution. FORTH doesn't need those.
 */
async function fetchFeedSectionsDirect(portal: Portal): Promise<FeedSection[]> {
  const supabase = await createClient();
  const federationAccess = await getPortalSourceAccess(portal.id);
  const hasSubscribedSources = federationAccess.sourceIds.length > 0;
  const isExclusivePortal = portal.portal_type === "business" && !portal.parent_portal_id;

  // Parse city filters for geo-filtering
  const portalCities = Array.from(new Set(
    [...(portal.filters?.city ? [portal.filters.city] : [])]
      .map((c) => c?.trim().toLowerCase())
      .filter(Boolean) as string[]
  ));

  // 1. Fetch visible sections for this portal
  const { data: sectionsRaw } = await supabase
    .from("portal_sections")
    .select(`
      id, title, slug, description, section_type, block_type, max_items,
      auto_filter, display_order, is_visible,
      schedule_start, schedule_end, show_on_days, show_after_time, show_before_time,
      portal_section_items(id, entity_type, entity_id, display_order)
    `)
    .eq("portal_id", portal.id)
    .eq("is_visible", true)
    .order("display_order", { ascending: true });

  const sections = ((sectionsRaw || []) as DbSection[]).filter(isSectionVisible);
  if (sections.length === 0) return [];

  // 2. Collect curated event IDs
  const curatedEventIds = new Set<number>();
  for (const section of sections) {
    if (section.section_type === "curated" || section.section_type === "mixed") {
      for (const item of section.portal_section_items || []) {
        if (item.entity_type === "event") curatedEventIds.add(item.entity_id);
      }
    }
    if (section.auto_filter?.event_ids?.length) {
      for (const id of section.auto_filter.event_ids) curatedEventIds.add(id);
    }
  }

  // 3. Fetch curated/pinned events
  const eventMap = new Map<number, DbEvent>();
  if (curatedEventIds.size > 0) {
    const { data: curatedEvents } = await supabase
      .from("events")
      .select(EVENT_SELECT)
      .in("id", Array.from(curatedEventIds))
      .or(`start_date.gte.${getLocalDateString()},end_date.gte.${getLocalDateString()}`)
      .is("canonical_event_id", null)
      .or("is_class.eq.false,is_class.is.null")
      .or("is_sensitive.eq.false,is_sensitive.is.null");

    for (const event of (curatedEvents || []) as DbEvent[]) {
      eventMap.set(event.id, event);
    }
  }

  // 4. Fetch auto-filter event pool
  const autoSections = sections.filter(
    (s) => (s.section_type === "auto" || s.section_type === "mixed") &&
           s.auto_filter && !s.auto_filter.event_ids?.length
  );

  const autoEventPool = new Map<number, DbEvent>();
  if (autoSections.length > 0) {
    const today = getLocalDateString();
    const maxDate = getLocalDateString(addDays(new Date(), 14));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let eventsQuery = supabase
      .from("events")
      .select(EVENT_SELECT)
      .gte("start_date", today)
      .lte("start_date", maxDate)
      .is("canonical_event_id", null)
      .or("is_class.eq.false,is_class.is.null")
      .or("is_sensitive.eq.false,is_sensitive.is.null") as any; // eslint-disable-line @typescript-eslint/no-explicit-any

    // Apply portal access filtering
    if (isExclusivePortal) {
      if (hasSubscribedSources) {
        const sourceIdList = federationAccess.sourceIds.join(",");
        eventsQuery = eventsQuery.or(`portal_id.eq.${portal.id},source_id.in.(${sourceIdList})`);
      } else {
        eventsQuery = eventsQuery.eq("portal_id", portal.id);
      }
    } else if (hasSubscribedSources) {
      const sourceIdList = federationAccess.sourceIds.join(",");
      eventsQuery = eventsQuery.or(`portal_id.eq.${portal.id},portal_id.is.null,source_id.in.(${sourceIdList})`);
    } else {
      eventsQuery = eventsQuery.or(`portal_id.eq.${portal.id},portal_id.is.null`);
    }

    const { data: poolEvents } = await eventsQuery
      .order("start_date", { ascending: true })
      .order("start_time", { ascending: true })
      .limit(300);

    for (const event of (poolEvents || []) as DbEvent[]) {
      // Apply federation category constraints
      if (event.source_id && federationAccess.categoryConstraints.has(event.source_id)) {
        const allowed = federationAccess.categoryConstraints.get(event.source_id);
        if (allowed !== null && allowed !== undefined && event.category && !allowed.includes(event.category)) continue;
      }
      // City geo-filter
      if (portalCities.length > 0 && event.venue?.city) {
        const venueCity = event.venue.city.trim().toLowerCase();
        if (venueCity && !portalCities.some((pc) => {
          if (venueCity === pc) return true;
          const regex = new RegExp(`\\b${pc.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
          return regex.test(venueCity);
        })) continue;
      }
      // Skip showtimes
      if (event.tags?.includes("showtime")) continue;
      autoEventPool.set(event.id, event);
    }
  }

  // 5. Build sections with their events
  const result: FeedSection[] = [];
  for (const section of sections) {
    if (["category_grid", "announcement", "external_link", "countdown"].includes(section.block_type)) continue;

    const limit = section.max_items || 8;
    let events: DbEvent[] = [];

    if (section.auto_filter?.event_ids?.length) {
      events = section.auto_filter.event_ids
        .map((id) => eventMap.get(id))
        .filter((e): e is DbEvent => e !== undefined);
    } else if (section.section_type === "curated") {
      const items = (section.portal_section_items || [])
        .filter((item) => item.entity_type === "event")
        .sort((a, b) => a.display_order - b.display_order);
      events = items
        .map((item) => eventMap.get(item.entity_id))
        .filter((e): e is DbEvent => e !== undefined)
        .slice(0, limit);
    } else if (section.auto_filter) {
      let filtered = Array.from(autoEventPool.values());
      const filter = section.auto_filter;

      if (filter.date_filter) {
        const { start, end } = getDateRange(filter.date_filter);
        filtered = filtered.filter((e) => e.start_date >= start && e.start_date <= end);
      }
      if (filter.categories?.length) {
        filtered = filtered.filter((e) => e.category && filter.categories!.includes(e.category));
      }
      if (filter.tags?.length) {
        const tagSet = new Set(filter.tags);
        filtered = filtered.filter((e) => Array.isArray(e.tags) && e.tags.some((tag) => tagSet.has(tag)));
      }
      if (filter.exclude_categories?.length) {
        filtered = filtered.filter((e) => !e.category || !filter.exclude_categories!.includes(e.category));
      }
      if (filter.source_ids?.length) {
        const sourceSet = new Set(filter.source_ids);
        filtered = filtered.filter((e) => e.source_id !== null && e.source_id !== undefined && sourceSet.has(e.source_id));
      }
      if (filter.venue_ids?.length) {
        const venueSet = new Set(filter.venue_ids);
        filtered = filtered.filter((e) => e.venue?.id !== null && e.venue?.id !== undefined && venueSet.has(e.venue.id));
      }
      if (filter.is_free) {
        filtered = filtered.filter((e) => e.is_free);
      }
      if (filter.exclude_ids?.length) {
        const excludeSet = new Set(filter.exclude_ids);
        filtered = filtered.filter((e) => !excludeSet.has(e.id));
      }

      events = filtered.slice(0, limit);

      // For mixed sections, merge curated items at the top
      if (section.section_type === "mixed") {
        const curatedItems = (section.portal_section_items || [])
          .filter((item) => item.entity_type === "event")
          .sort((a, b) => a.display_order - b.display_order);
        const curatedEvents = curatedItems
          .map((item) => eventMap.get(item.entity_id))
          .filter((e): e is DbEvent => e !== undefined);
        const curatedIds = new Set(curatedEvents.map((e) => e.id));
        events = [...curatedEvents, ...events.filter((e) => !curatedIds.has(e.id))].slice(0, limit);
      }
    }

    if (events.length < 2) continue;

    result.push({
      title: section.title,
      slug: section.slug || undefined,
      description: section.description || undefined,
      events: events.map((e) => ({
        id: String(e.id),
        title: e.title,
        start_date: e.start_date,
        start_time: e.start_time,
        image_url: e.image_url,
        description: e.description,
        venue_name: e.venue?.name || null,
        category: e.category,
        subcategory: e.subcategory,
        is_free: e.is_free,
        price_min: e.price_min,
        distance_km: null,
      })),
    });
  }

  return result;
}

/**
 * Fetch nearby destinations with specials directly from Supabase.
 * Replicates core logic from the specials API route.
 */
async function fetchDestinationsDirect(portal: Portal): Promise<{
  destinations: Destination[];
  liveDestinations: Destination[];
  specialsMeta: SpecialsMeta | null;
}> {
  const center = portal.filters?.geo_center;
  if (!center?.[0] || !center?.[1]) {
    return { destinations: [], liveDestinations: [], specialsMeta: null };
  }

  const centerLat = center[0];
  const centerLng = center[1];
  const radiusKm = portal.filters?.geo_radius_km ?? 5;
  const includeUpcomingHours = 5;

  const supabase = await createClient();
  const federationAccess = await getPortalSourceAccess(portal.id);
  const hasSubscribedSources = federationAccess.sourceIds.length > 0;
  const isExclusivePortal = portal.portal_type === "business" && !portal.parent_portal_id;

  // Bounding box for initial filter
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos((centerLat * Math.PI) / 180));

  // 1. Fetch venues within bounding box
  const { data: venuesRaw } = await supabase
    .from("venues")
    .select("id, name, slug, neighborhood, venue_type, lat, lng, city, image_url, short_description")
    .neq("active", false)
    .not("lat", "is", null)
    .not("lng", "is", null)
    .gte("lat", centerLat - latDelta)
    .lte("lat", centerLat + latDelta)
    .gte("lng", centerLng - lngDelta)
    .lte("lng", centerLng + lngDelta)
    .limit(2000);

  // Filter by actual haversine distance
  const venuesInRadius = ((venuesRaw || []) as DbVenue[])
    .map((v) => {
      if (v.lat === null || v.lng === null) return null;
      const distanceKm = haversineDistanceKm(centerLat, centerLng, v.lat, v.lng);
      if (distanceKm > radiusKm) return null;
      return { ...v, distance_km: distanceKm, proximity_tier: getProximityTier(distanceKm), proximity_label: getProximityLabel(distanceKm) };
    })
    .filter((v): v is DbVenue & { distance_km: number; proximity_tier: ProximityTier; proximity_label: string } => v !== null);

  if (venuesInRadius.length === 0) {
    return { destinations: [], liveDestinations: [], specialsMeta: null };
  }

  const venueIds = venuesInRadius.map((v) => v.id);

  // 2. Fetch specials + next events in parallel
  const today = getLocalDateString();
  const [{ data: specialsRaw }, { data: eventsRaw }] = await Promise.all([
    supabase
      .from("venue_specials")
      .select("id, venue_id, title, type, days_of_week, time_start, time_end, start_date, end_date, price_note, confidence, last_verified_at")
      .in("venue_id", venueIds)
      .eq("is_active", true),
    (() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q = supabase
        .from("events")
        .select("id, title, start_date, start_time, venue_id, source_id, category")
        .in("venue_id", venueIds)
        .gte("start_date", today)
        .is("canonical_event_id", null)
        .or("is_class.eq.false,is_class.is.null")
        .or("is_sensitive.eq.false,is_sensitive.is.null") as any; // eslint-disable-line @typescript-eslint/no-explicit-any

      if (isExclusivePortal) {
        q = hasSubscribedSources
          ? q.or(`portal_id.eq.${portal.id},source_id.in.(${federationAccess.sourceIds.join(",")})`)
          : q.eq("portal_id", portal.id);
      } else {
        q = hasSubscribedSources
          ? q.or(`portal_id.eq.${portal.id},portal_id.is.null,source_id.in.(${federationAccess.sourceIds.join(",")})`)
          : q.or(`portal_id.eq.${portal.id},portal_id.is.null`);
      }
      return q.order("start_date", { ascending: true }).order("start_time", { ascending: true }).limit(1000);
    })(),
  ]);

  // Group specials by venue
  const specialsByVenue = new Map<number, DbSpecial[]>();
  for (const special of (specialsRaw || []) as DbSpecial[]) {
    if (!specialsByVenue.has(special.venue_id)) specialsByVenue.set(special.venue_id, []);
    specialsByVenue.get(special.venue_id)!.push(special);
  }

  // Find next event per venue
  const nextEventByVenue = new Map<number, DbNextEvent>();
  for (const event of (eventsRaw || []) as DbNextEvent[]) {
    if (!event.venue_id) continue;
    if (event.source_id && federationAccess.categoryConstraints.has(event.source_id)) {
      const allowed = federationAccess.categoryConstraints.get(event.source_id);
      if (allowed !== null && allowed !== undefined && event.category && !allowed.includes(event.category)) continue;
    }
    if (!nextEventByVenue.has(event.venue_id)) nextEventByVenue.set(event.venue_id, event);
  }

  // 3. Build destination list
  const now = new Date();
  const CONFIDENCE_SCORE: Record<string, number> = { high: 3, medium: 2, low: 1 };

  const allDestinations = venuesInRadius
    .map((venue): Destination | null => {
      const specials = specialsByVenue.get(venue.id) || [];
      const withStatus = specials.map((s) => ({ special: s, status: getSpecialStatus(s, now, includeUpcomingHours, today) }));

      const activeSpecials = withStatus.filter((s) => s.status.state === "active_now");
      const startingSoonSpecials = withStatus.filter((s) => s.status.state === "starting_soon");

      let state: SpecialState = "none";
      if (activeSpecials.length > 0) state = "active_now";
      else if (startingSoonSpecials.length > 0) state = "starting_soon";

      // Sort specials by state priority then confidence
      withStatus.sort((a, b) => {
        const statePriority = (s: string) => s === "active_now" ? 3 : s === "starting_soon" ? 2 : 1;
        const delta = statePriority(b.status.state) - statePriority(a.status.state);
        if (delta !== 0) return delta;
        const confA = CONFIDENCE_SCORE[(a.special.confidence || "medium").toLowerCase()] || 1;
        const confB = CONFIDENCE_SCORE[(b.special.confidence || "medium").toLowerCase()] || 1;
        return confB - confA;
      });

      const top = withStatus[0];
      const nextEvent = nextEventByVenue.get(venue.id);
      const score = scoreDestination(venue.proximity_tier, state, top?.special.confidence || null, top?.special.last_verified_at || null);

      return {
        venue: {
          id: venue.id,
          slug: venue.slug,
          name: venue.name,
          neighborhood: venue.neighborhood,
          venue_type: venue.venue_type,
          image_url: venue.image_url,
          short_description: venue.short_description,
        },
        distance_km: Math.round(venue.distance_km * 100) / 100,
        proximity_tier: venue.proximity_tier,
        proximity_label: venue.proximity_label,
        special_state: state,
        top_special: top
          ? {
              title: top.special.title,
              type: top.special.type,
              price_note: top.special.price_note,
              confidence: top.special.confidence as "high" | "medium" | "low" | null,
              starts_in_minutes: top.status.startsInMinutes,
              remaining_minutes: top.status.remainingMinutes,
              last_verified_at: top.special.last_verified_at,
            }
          : null,
        next_event: nextEvent
          ? { title: nextEvent.title, start_date: nextEvent.start_date, start_time: nextEvent.start_time }
          : null,
        _score: score,
      } as Destination & { _score: number };
    })
    .filter((d): d is Destination & { _score: number } => d !== null)
    .sort((a, b) => b._score !== a._score ? b._score - a._score : a.distance_km - b.distance_km);

  // Split into all destinations and live-only
  const destinations: Destination[] = allDestinations.slice(0, 120).map(({ _score: _, ...rest }) => rest);
  const liveDestinations: Destination[] = allDestinations
    .filter((d) => d.special_state === "active_now")
    .slice(0, 36)
    .map(({ _score: _, ...rest }) => rest);

  const specialsMeta: SpecialsMeta = {
    total: destinations.length,
    active_now: destinations.filter((d) => d.special_state === "active_now").length,
    starting_soon: destinations.filter((d) => d.special_state === "starting_soon").length,
    tiers: {
      walkable: destinations.filter((d) => d.proximity_tier === "walkable").length,
      close: destinations.filter((d) => d.proximity_tier === "close").length,
      destination: destinations.filter((d) => d.proximity_tier === "destination").length,
    },
  };

  return { destinations, liveDestinations, specialsMeta };
}

// ---------------------------------------------------------------------------
// Public data fetching API
// ---------------------------------------------------------------------------

/**
 * Fetch all feed data for the FORTH portal via direct Supabase queries.
 * No HTTP self-fetch — saves 200-500ms per request vs the old approach.
 */
export async function getForthFeed(portal: Portal): Promise<ForthFeedData> {
  const [sections, destResult] = await Promise.all([
    fetchFeedSectionsDirect(portal),
    fetchDestinationsDirect(portal),
  ]);

  return {
    sections,
    ...destResult,
    agentNarrative: null,
    agentJourney: null,
  };
}

/**
 * Get FORTH property data (signature venues, amenities, services).
 * Reads from portal.settings with hardcoded fallback.
 */
export function getForthPropertyData(portal: Portal): ForthPropertyData {
  const settings = portal.settings || {};

  const conciergePhone = typeof settings.concierge_phone === "string"
    ? settings.concierge_phone
    : "+1 (404) 418-2241";

  const signatureVenues = Array.isArray(settings.signature_venues)
    ? (settings.signature_venues as SignatureVenue[])
    : DEFAULT_SIGNATURE_VENUES;

  const amenities = Array.isArray(settings.amenities)
    ? (settings.amenities as ForthAmenity[])
    : DEFAULT_AMENITIES;

  const inRoomServices = Array.isArray(settings.in_room_services)
    ? (settings.in_room_services as InRoomRequest[])
    : DEFAULT_IN_ROOM_SERVICES;

  return { signatureVenues, amenities, inRoomServices, conciergePhone };
}
