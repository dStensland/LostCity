/**
 * GET /api/portals/[slug]/playbook
 *
 * Unified "What's On" feed — returns a flat, time-sorted list of mixed
 * content types (events, specials, exhibits) grouped into time blocks.
 * Reuses query infrastructure from the City Pulse API.
 */

import { createClient, createPortalScopedClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { addDays, format } from "date-fns";
import { getLocalDateString } from "@/lib/formats";
import { fetchSocialProofCounts } from "@/lib/social-proof";
import { getPortalSourceAccess } from "@/lib/federation";
import {
  applyRateLimit,
  RATE_LIMITS,
  getClientIdentifier,
} from "@/lib/rate-limit";
import { errorResponse } from "@/lib/api-utils";
import {
  normalizePortalSlug,
  resolvePortalSlugAlias,
} from "@/lib/portal-aliases";
import { applyManifestFederatedScopeToQuery } from "@/lib/portal-scope";
import { buildPortalManifest } from "@/lib/portal-manifest";
import {
  suppressEventImagesIfVenueFlagged,
} from "@/lib/image-quality-suppression";
import { getTimeSlot } from "@/lib/city-pulse/time-slots";
import type { TimeSlot } from "@/lib/city-pulse/types";

export const revalidate = 120;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Props = { params: Promise<{ slug: string }> };

type PlaybookItem = {
  item_type: "event" | "special" | "exhibit" | "festival";
  id: number;
  title: string;
  subtitle: string;
  time_label: string;
  start_time: string | null;
  date: string;
  venue: {
    id: number;
    name: string;
    slug: string;
    lat: number | null;
    lng: number | null;
    neighborhood: string | null;
  };
  image_url: string | null;
  category: string | null;
  is_active_now: boolean;
  active_special?: { title: string; type: string } | null;
};

type PlaybookTimeBlock = {
  label: string;
  time_slot: string;
  items: PlaybookItem[];
};

type PlaybookResponse = {
  date: string;
  time_blocks: PlaybookTimeBlock[];
  context: { time_slot: TimeSlot; weather_signal?: string };
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimeLabel(
  startTime: string | null,
  isAllDay: boolean | null,
  endDate: string | null,
  startDate: string,
): string {
  if (isAllDay) {
    if (endDate && endDate !== startDate) {
      return `Through ${format(new Date(endDate + "T00:00:00"), "MMM d")}`;
    }
    return "All day";
  }
  if (!startTime) return "TBA";
  const [h, m] = startTime.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return "TBA";
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${m.toString().padStart(2, "0")} ${period}`;
}

function getTimeBlockLabel(startTime: string | null, isAllDay: boolean | null): string {
  if (isAllDay || !startTime) return "all_day";
  const [h] = startTime.split(":").map(Number);
  if (isNaN(h)) return "all_day";
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  if (h < 21) return "evening";
  return "late_night";
}

function getTimeBlockDisplayLabel(block: string, dateStr: string, today: string, tomorrow: string): string {
  const dayPrefix = dateStr === today ? "" : dateStr === tomorrow ? "Tomorrow " : `${format(new Date(dateStr + "T00:00:00"), "EEE")} `;
  switch (block) {
    case "happening_now": return "Happening Now";
    case "all_day": return `${dayPrefix}All Day & Ongoing`;
    case "morning": return `${dayPrefix}Morning`;
    case "afternoon": return `${dayPrefix}Afternoon`;
    case "evening": return `${dayPrefix}Evening`;
    case "late_night": return `${dayPrefix}Late Night`;
    default: return block;
  }
}

// ISO 8601 weekday: 1=Monday, 7=Sunday
function getCurrentISOWeekday(now: Date): number {
  const jsDay = now.getDay();
  return jsDay === 0 ? 7 : jsDay;
}

function getTimeMinutes(time: string | null): number | null {
  if (!time) return null;
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

type SpecialRow = {
  id: number;
  venue_id: number;
  title: string;
  type: string;
  description: string | null;
  days_of_week: number[] | null;
  time_start: string | null;
  time_end: string | null;
  start_date: string | null;
  end_date: string | null;
  price_note: string | null;
  venue: {
    id: number;
    name: string;
    slug: string;
    neighborhood: string | null;
    venue_type: string | null;
    image_url: string | null;
    lat: number | null;
    lng: number | null;
    city: string | null;
  };
};

function isSpecialActive(
  special: SpecialRow,
  now: Date,
  today: string,
): boolean {
  if (special.start_date && special.start_date > today) return false;
  if (special.end_date && special.end_date < today) return false;

  const currentIsoDay = getCurrentISOWeekday(now);
  if (special.days_of_week?.length && !special.days_of_week.includes(currentIsoDay)) {
    return false;
  }

  // Guard: infer from title keywords
  if (!special.days_of_week?.length) {
    const titleLower = special.title.toLowerCase();
    const DAY_KEYWORDS: Record<string, number> = {
      monday: 1, tuesday: 2, wednesday: 3, thursday: 4,
      friday: 5, saturday: 6, sunday: 7,
    };
    for (const [dayName, isoDay] of Object.entries(DAY_KEYWORDS)) {
      if (titleLower.includes(dayName) && currentIsoDay !== isoDay) {
        return false;
      }
    }
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const start = getTimeMinutes(special.time_start);
  const end = getTimeMinutes(special.time_end);

  if (start === null && end === null) return true;

  if (start !== null && end !== null) {
    if (start > end) {
      return currentMinutes >= start || currentMinutes <= end;
    }
    return currentMinutes >= start && currentMinutes <= end;
  }

  if (start !== null) return currentMinutes >= start;
  if (end !== null) return currentMinutes <= end;

  return true;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EVENT_SELECT = `
  id, title, start_date, start_time, end_date, end_time,
  is_all_day, is_free, price_min, price_max,
  category, genres, image_url, content_kind, tags,
  series:series_id(id, frequency, day_of_week),
  venue:venues(id, name, neighborhood, slug, venue_type, lat, lng, city, image_url)
`;

const CACHE_CONTROL = "public, s-maxage=120, stale-while-revalidate=600";

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest, { params }: Props) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request),
  );
  if (rateLimitResult) return rateLimitResult;

  const { slug } = await params;
  const requestSlug = normalizePortalSlug(slug);
  const canonicalSlug = resolvePortalSlugAlias(requestSlug);
  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date");
  const categoriesParam = searchParams.get("categories");
  const neighborhoodsParam = searchParams.get("neighborhoods");
  const activeNowParam = searchParams.get("active_now") === "true";

  const now = new Date();
  const timeSlot = getTimeSlot(now.getHours());
  const today = getLocalDateString(now);
  const tomorrow = getLocalDateString(addDays(now, 1));
  const targetDate = dateParam || today;

  // -----------------------------------------------------------------------
  // Portal lookup
  // -----------------------------------------------------------------------

  const supabase = await createClient();

  let portalResult = await supabase
    .from("portals")
    .select("id, slug, name, portal_type, parent_portal_id, settings, filters")
    .eq("slug", canonicalSlug)
    .eq("status", "active")
    .maybeSingle();

  if (portalResult.error && portalResult.error.message?.includes("column")) {
    portalResult = await supabase
      .from("portals")
      .select("id, slug, name, portal_type, settings")
      .eq("slug", canonicalSlug)
      .eq("status", "active")
      .maybeSingle();
  }

  const portalData = portalResult.data as {
    id: string;
    slug: string;
    name: string;
    portal_type: string;
    parent_portal_id?: string | null;
    settings: Record<string, unknown> | null;
    filters?: Record<string, unknown> | string | null;
  } | null;

  if (!portalData) {
    return errorResponse("Portal not found", "playbook", 404);
  }

  const portalFilters = (() => {
    const raw = portalData.filters;
    if (!raw) return {} as { city?: string; cities?: string[] };
    if (typeof raw === "string") {
      try { return JSON.parse(raw); } catch { return {}; }
    }
    return raw as { city?: string; cities?: string[] };
  })();
  const portalCity = portalFilters.city;

  const portalClient = await createPortalScopedClient(portalData.id);
  const federationAccess = await getPortalSourceAccess(portalData.id);
  const hasSubscribedSources =
    federationAccess.sourceIds && federationAccess.sourceIds.length > 0;

  const manifest = buildPortalManifest({
    portalId: portalData.id,
    slug: canonicalSlug,
    portalType: portalData.portal_type,
    parentPortalId: (portalData as { parent_portal_id?: string | null }).parent_portal_id,
    settings: portalData.settings,
    filters: portalFilters as { city?: string; cities?: string[] },
    sourceIds: hasSubscribedSources ? federationAccess.sourceIds : [],
  });

  const applyPortalScope = <T>(query: T): T => {
    return applyManifestFederatedScopeToQuery(query, manifest, {
      sourceIds: hasSubscribedSources ? federationAccess.sourceIds : [],
      publicOnlyWhenNoPortal: true,
    });
  };

  // -----------------------------------------------------------------------
  // Parallel data queries
  // -----------------------------------------------------------------------

  const endDate = getLocalDateString(addDays(new Date(targetDate + "T00:00:00"), 0));

  // Events for the target date (including exhibits)
  const buildEventsQuery = () => {
    let q = portalClient
      .from("events")
      .select(EVENT_SELECT)
      .lte("start_date", endDate)
      .or(`end_date.gte.${endDate},end_date.is.null,start_date.eq.${endDate}`)
      .is("canonical_event_id", null)
      .or("is_class.eq.false,is_class.is.null")
      .or("is_sensitive.eq.false,is_sensitive.is.null");
    q = applyPortalScope(q);
    return q
      .order("start_time", { ascending: true })
      .limit(100);
  };

  // Active specials
  const buildSpecialsQuery = () => {
    let q = supabase
      .from("venue_specials")
      .select(`
        id, venue_id, title, type, description,
        days_of_week, time_start, time_end,
        start_date, end_date, price_note,
        venue:venues!inner(id, name, slug, neighborhood, venue_type, image_url, lat, lng, city)
      `)
      .eq("is_active", true)
      .eq("venue.active", true);
    if (portalCity) {
      q = q.ilike("venue.city", `%${portalCity}%`);
    }
    return q.limit(80);
  };

  // Festivals
  const buildFestivalsQuery = () => {
    return supabase
      .from("festivals")
      .select("id, name, slug, start_date, end_date, image_url, description")
      .lte("start_date", getLocalDateString(addDays(new Date(targetDate + "T00:00:00"), 7)))
      .gte("end_date", targetDate)
      .limit(10);
  };

  const [eventsResult, specialsResult, festivalsResult] = await Promise.all([
    buildEventsQuery(),
    buildSpecialsQuery(),
    buildFestivalsQuery(),
  ]);

  // -----------------------------------------------------------------------
  // Process events
  // -----------------------------------------------------------------------

  type EventRow = {
    id: number;
    title: string;
    start_date: string;
    start_time: string | null;
    end_date: string | null;
    end_time: string | null;
    is_all_day: boolean | null;
    is_free: boolean | null;
    category: string | null;
    genres: string[] | null;
    image_url: string | null;
    content_kind: string | null;
    tags: string[] | null;
    venue: {
      id: number;
      name: string;
      slug: string;
      neighborhood: string | null;
      venue_type: string | null;
      lat: number | null;
      lng: number | null;
      city: string | null;
      image_url: string | null;
    } | null;
  };

  const rawEvents = suppressEventImagesIfVenueFlagged(
    (eventsResult.data || []) as EventRow[],
  ) as EventRow[];

  // Classify events: regular events vs exhibits
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const playItems: PlaybookItem[] = [];

  for (const event of rawEvents) {
    if (!event.venue) continue;

    const isExhibit =
      event.content_kind === "exhibit" ||
      (event.is_all_day &&
        !event.start_time &&
        event.end_date &&
        event.end_date !== event.start_date);

    const itemType = isExhibit ? "exhibit" as const : "event" as const;

    // Determine if active now
    let isActiveNow = false;
    if (targetDate === today) {
      if (event.is_all_day) {
        isActiveNow = true;
      } else if (event.start_time) {
        const startMins = getTimeMinutes(event.start_time);
        const endMins = event.end_time ? getTimeMinutes(event.end_time) : (startMins !== null ? startMins + 120 : null);
        if (startMins !== null && endMins !== null) {
          isActiveNow = currentMinutes >= startMins && currentMinutes <= endMins;
        }
      }
    }

    playItems.push({
      item_type: itemType,
      id: event.id,
      title: event.title,
      subtitle: event.venue.name,
      time_label: formatTimeLabel(event.start_time, event.is_all_day, event.end_date, event.start_date),
      start_time: event.start_time,
      date: event.start_date,
      venue: {
        id: event.venue.id,
        name: event.venue.name,
        slug: event.venue.slug,
        lat: event.venue.lat,
        lng: event.venue.lng,
        neighborhood: event.venue.neighborhood,
      },
      image_url: event.image_url || event.venue.image_url,
      category: event.category,
      is_active_now: isActiveNow,
    });
  }

  // -----------------------------------------------------------------------
  // Process specials
  // -----------------------------------------------------------------------

  const rawSpecials = (specialsResult.data || []) as SpecialRow[];

  for (const special of rawSpecials) {
    if (!special.venue) continue;
    const active = isSpecialActive(special, now, today);
    if (!active && targetDate === today) continue;

    const timeLabel = (() => {
      if (special.time_start && special.time_end) {
        const startLabel = formatTimeLabel(special.time_start, false, null, today);
        const endLabel = formatTimeLabel(special.time_end, false, null, today);
        return `${startLabel} – ${endLabel}`;
      }
      if (special.time_start) return `From ${formatTimeLabel(special.time_start, false, null, today)}`;
      return "All day";
    })();

    playItems.push({
      item_type: "special",
      id: special.id,
      title: special.title,
      subtitle: special.venue.name,
      time_label: timeLabel,
      start_time: special.time_start,
      date: targetDate,
      venue: {
        id: special.venue.id,
        name: special.venue.name,
        slug: special.venue.slug,
        lat: special.venue.lat,
        lng: special.venue.lng,
        neighborhood: special.venue.neighborhood,
      },
      image_url: special.venue.image_url,
      category: special.type,
      is_active_now: active,
      active_special: { title: special.title, type: special.type },
    });
  }

  // -----------------------------------------------------------------------
  // Process festivals
  // -----------------------------------------------------------------------

  type FestivalRow = {
    id: number;
    name: string;
    slug: string;
    start_date: string;
    end_date: string;
    image_url: string | null;
    description: string | null;
  };

  const rawFestivals = (festivalsResult.data || []) as FestivalRow[];

  for (const festival of rawFestivals) {
    const isActiveNow = targetDate >= festival.start_date && targetDate <= festival.end_date;

    playItems.push({
      item_type: "festival",
      id: festival.id,
      title: festival.name,
      subtitle: `${format(new Date(festival.start_date + "T00:00:00"), "MMM d")} – ${format(new Date(festival.end_date + "T00:00:00"), "MMM d")}`,
      time_label: `Through ${format(new Date(festival.end_date + "T00:00:00"), "MMM d")}`,
      start_time: null,
      date: festival.start_date,
      venue: {
        id: 0,
        name: festival.name,
        slug: festival.slug,
        lat: null,
        lng: null,
        neighborhood: null,
      },
      image_url: festival.image_url,
      category: "festival",
      is_active_now: isActiveNow,
    });
  }

  // -----------------------------------------------------------------------
  // Apply filters
  // -----------------------------------------------------------------------

  let filtered = playItems;

  if (categoriesParam) {
    const cats = new Set(categoriesParam.split(",").map((c) => c.trim().toLowerCase()));
    filtered = filtered.filter((item) => {
      if (!item.category) return false;
      return cats.has(item.category.toLowerCase());
    });
  }

  if (neighborhoodsParam) {
    const hoods = new Set(neighborhoodsParam.split(",").map((n) => n.trim().toLowerCase()));
    filtered = filtered.filter((item) => {
      if (!item.venue.neighborhood) return false;
      return hoods.has(item.venue.neighborhood.toLowerCase());
    });
  }

  if (activeNowParam) {
    filtered = filtered.filter((item) => item.is_active_now);
  }

  // -----------------------------------------------------------------------
  // Group into time blocks
  // -----------------------------------------------------------------------

  const blockOrder = ["happening_now", "morning", "afternoon", "evening", "late_night", "all_day"];
  const blockMap = new Map<string, PlaybookItem[]>();

  for (const item of filtered) {
    let block: string;
    if (item.is_active_now && targetDate === today) {
      block = "happening_now";
    } else {
      block = getTimeBlockLabel(item.start_time, item.item_type === "exhibit" || item.item_type === "festival");
    }
    const existing = blockMap.get(block) || [];
    existing.push(item);
    blockMap.set(block, existing);
  }

  // Sort items within each block by start_time
  for (const items of blockMap.values()) {
    items.sort((a, b) => {
      if (a.start_time === null && b.start_time === null) return 0;
      if (a.start_time === null) return 1;
      if (b.start_time === null) return -1;
      return a.start_time.localeCompare(b.start_time);
    });
  }

  const timeBlocks: PlaybookTimeBlock[] = blockOrder
    .filter((key) => blockMap.has(key))
    .map((key) => ({
      label: getTimeBlockDisplayLabel(key, targetDate, today, tomorrow),
      time_slot: key,
      items: blockMap.get(key)!,
    }));

  // -----------------------------------------------------------------------
  // Social proof
  // -----------------------------------------------------------------------

  const eventIds = filtered
    .filter((i) => i.item_type === "event" || i.item_type === "exhibit")
    .map((i) => i.id);

  if (eventIds.length > 0) {
    const socialCounts = await fetchSocialProofCounts(eventIds);
    // Attach to items (consumers can use this for sorting/display)
    for (const block of timeBlocks) {
      for (const item of block.items) {
        if (item.item_type === "event" || item.item_type === "exhibit") {
          const counts = socialCounts.get(item.id);
          if (counts) {
            (item as PlaybookItem & { going_count?: number }).going_count = counts.going;
          }
        }
      }
    }
  }

  // -----------------------------------------------------------------------
  // Response
  // -----------------------------------------------------------------------

  const response: PlaybookResponse = {
    date: targetDate,
    time_blocks: timeBlocks,
    context: {
      time_slot: timeSlot,
    },
  };

  return NextResponse.json(response, {
    headers: { "Cache-Control": CACHE_CONTROL },
  });
}
