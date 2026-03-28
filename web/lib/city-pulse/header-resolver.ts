/**
 * Header resolver for the CityPulse feed.
 *
 * Evaluates CMS header configs against the current context,
 * merges the winning config over algorithm defaults, resolves
 * template variables and dashboard card counts.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getLocalDateString } from "@/lib/formats";
import { sanitizeCssColor } from "@/lib/css-utils";
import { getEditorialHeadline, getCityPhoto, getDefaultAccentColor, getTimeLabel } from "./header-defaults";
import { getDashboardCards } from "./dashboard-cards";
import type { FeedEventData } from "@/components/EventCard";
import type {
  FeedContext,
  FeedHeaderRow,
  FeedHeaderConditions,
  FeedHeaderCardConfig,
  FeedHeaderCardQuery,
  ResolvedHeader,
  FlagshipEvent,
  DashboardCard,
  QuickLink,
  EventsPulse,
} from "./types";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ResolveHeaderOpts {
  candidates: FeedHeaderRow[];
  context: FeedContext;
  portalSlug: string;
  portalId: string;
  portalName: string;
  eventsPulse: EventsPulse;
  now: Date;
  user?: { display_name: string | null; username: string | null } | null;
  supabase: SupabaseClient;
  portalCity?: string;
  /** Today's events (with social proof) — used to identify the flagship hero event */
  todayEvents?: FeedEventData[];
}

export async function resolveHeader(opts: ResolveHeaderOpts): Promise<ResolvedHeader> {
  const {
    candidates, context, portalSlug, portalName,
    eventsPulse, now, user, supabase, portalCity, portalId,
    todayEvents,
  } = opts;

  // 1. Find first matching candidate
  let winner = findMatchingHeader(candidates, context, now);

  // 1b. Safety net: skip CMS header if headline has time-slot mismatch
  // e.g. headline says "night" but current time_slot is morning/midday
  if (winner?.headline) {
    const headlineLower = winner.headline.toLowerCase();
    const morningSlots = new Set(["morning", "midday"]);
    const nightKeywords = ["night", "tonight", "evening"];
    if (
      morningSlots.has(context.time_slot) &&
      nightKeywords.some((kw) => headlineLower.includes(kw))
    ) {
      console.warn(
        `[header-resolver] CMS header "${winner.slug}" headline "${winner.headline}" contains night keyword but time_slot is ${context.time_slot} — falling back to algorithm`,
      );
      winner = null;
    }
  }

  // 2. Merge winner's non-null fields over algorithm defaults
  const defaultHeadline = getEditorialHeadline(context);
  const defaultPhoto = getCityPhoto(context.time_slot, context.weather_signal, context.day_of_week);
  const defaultAccent = getDefaultAccentColor(context);
  const defaultCards = getDashboardCards(context, portalSlug);
  const defaultQuickLinks = context.quick_links;

  const rawHeadline = winner?.headline ?? defaultHeadline;
  const rawSubtitle = winner?.subtitle ?? undefined;
  const heroImage = winner?.hero_image_url ?? defaultPhoto;
  const rawAccent = winner?.accent_color;
  const accentColor = (rawAccent ? sanitizeCssColor(rawAccent) : null) ?? defaultAccent;
  const layoutVariant = winner?.layout_variant ?? null;
  const textTreatment = winner?.text_treatment ?? null;
  const cta = winner?.cta ?? undefined;
  const suppressedEventIds = winner?.suppressed_event_ids ?? [];
  const boostedEventIds = winner?.boosted_event_ids ?? [];

  // 3. Resolve template variables
  const templateVars: Record<string, string> = {
    display_name: user?.display_name || user?.username || "",
    city_name: portalName,
    day_theme: humanizeDayTheme(context.day_theme),
    weather_label: context.weather?.condition ?? "",
    time_label: getTimeLabel(context.time_slot),
  };

  const headline = resolveTemplateVars(rawHeadline, templateVars);
  const subtitle = rawSubtitle ? resolveTemplateVars(rawSubtitle, templateVars) : undefined;

  // 4. Resolve dashboard cards (with optional live counts)
  let dashboardCards: DashboardCard[];
  if (winner?.dashboard_cards) {
    dashboardCards = await resolveCardCounts(
      winner.dashboard_cards,
      supabase,
      portalId,
      portalCity,
      now,
      context.time_slot,
    );
  } else {
    dashboardCards = defaultCards;
  }

  // 5. Resolve quick links
  const quickLinks: QuickLink[] = winner?.quick_links ?? defaultQuickLinks;

  // 6. Identify flagship event — tentpole or festival event with an image
  const flagshipEvent = resolveFlagshipEvent(todayEvents, portalSlug);

  // 7. Identify sports tentpole — for signal strip display (e.g. "Braves vs Mets · 7:20")
  const sportsTentpole = resolveSportsTentpole(todayEvents, portalSlug);

  return {
    config_id: winner?.id ?? null,
    config_slug: winner?.slug ?? null,
    headline,
    subtitle,
    hero_image_url: heroImage,
    accent_color: accentColor,
    layout_variant: layoutVariant,
    text_treatment: textTreatment,
    dashboard_cards: dashboardCards,
    quick_links: quickLinks,
    cta,
    events_pulse: eventsPulse,
    suppressed_event_ids: suppressedEventIds,
    boosted_event_ids: boostedEventIds,
    flagship_event: flagshipEvent,
    sports_tentpole: sportsTentpole,
  };
}

// ---------------------------------------------------------------------------
// Flagship event selection
// ---------------------------------------------------------------------------

/**
 * Find the best flagship event from today's pool — a tentpole or festival
 * event that has an image and can own the hero area.
 *
 * Priority order:
 *  1. importance === "flagship"
 *  2. is_tentpole
 *  3. festival_id set
 *
 * Returns null when no qualifying event with an image exists.
 */
function resolveFlagshipEvent(
  todayEvents: FeedEventData[] | undefined,
  portalSlug: string,
): FlagshipEvent | null {
  if (!todayEvents || todayEvents.length === 0) return null;

  const candidates = todayEvents.filter(
    (e) =>
      (e.importance === "flagship" || e.is_tentpole || !!e.festival_id) &&
      !!e.image_url,
  );

  if (candidates.length === 0) return null;

  // Sort: flagship importance first, then tentpole, then festival
  const priority = (e: FeedEventData): number => {
    if (e.importance === "flagship") return 0;
    if (e.is_tentpole) return 1;
    return 2;
  };
  candidates.sort((a, b) => priority(a) - priority(b));

  const best = candidates[0];
  if (!best.image_url) return null;

  const priceInfo =
    best.is_free
      ? "Free"
      : best.price_min != null
        ? best.price_min === 0
          ? "Free"
          : `$${best.price_min}+`
        : null;

  return {
    id: best.id,
    title: best.title,
    image_url: best.image_url,
    venue_name: best.venue?.name ?? null,
    start_time: best.start_time ?? null,
    price_info: priceInfo,
    href: `/${portalSlug}/events/${best.id}`,
  };
}

// ---------------------------------------------------------------------------
// Sports tentpole selection
// ---------------------------------------------------------------------------

/**
 * Find the highest-priority sports tentpole event today.
 * Used by the signal strip to surface game-day context (e.g. "Braves vs Mets · 7:20").
 *
 * Picks the first is_tentpole event in the "sports" category, ordered by start_time.
 * Returns null when none exists.
 */
function resolveSportsTentpole(
  todayEvents: FeedEventData[] | undefined,
  portalSlug: string,
): ResolvedHeader["sports_tentpole"] {
  if (!todayEvents || todayEvents.length === 0) return null;

  const candidates = todayEvents.filter(
    (e) => e.is_tentpole && e.category === "sports",
  );

  if (candidates.length === 0) return null;

  // Pick the earliest game of the day
  candidates.sort((a, b) => {
    const ta = a.start_time ?? "";
    const tb = b.start_time ?? "";
    return ta < tb ? -1 : ta > tb ? 1 : 0;
  });

  const best = candidates[0];
  return {
    title: best.title,
    start_time: best.start_time ?? null,
    venue_name: best.venue?.name,
    href: `/${portalSlug}/events/${best.id}`,
  };
}

// ---------------------------------------------------------------------------
// Schedule + condition matching
// ---------------------------------------------------------------------------

function findMatchingHeader(
  candidates: FeedHeaderRow[],
  context: FeedContext,
  now: Date,
): FeedHeaderRow | null {
  const today = getLocalDateString(now);
  const currentDay = context.day_of_week || getDayName(now);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  for (const candidate of candidates) {
    if (!matchesSchedule(candidate, today, currentDay, currentMinutes)) continue;
    if (!matchesConditions(candidate.conditions, context)) continue;
    return candidate;
  }

  return null;
}

function matchesSchedule(
  header: FeedHeaderRow,
  today: string,
  currentDay: string,
  currentMinutes: number,
): boolean {
  if (header.schedule_start && today < header.schedule_start) return false;
  if (header.schedule_end && today > header.schedule_end) return false;

  if (header.show_on_days && header.show_on_days.length > 0) {
    if (!header.show_on_days.includes(currentDay)) return false;
  }

  if (header.show_after_time) {
    const afterMinutes = parseTimeToMinutes(header.show_after_time);
    if (afterMinutes !== null && currentMinutes < afterMinutes) return false;
  }

  if (header.show_before_time) {
    const beforeMinutes = parseTimeToMinutes(header.show_before_time);
    if (beforeMinutes !== null && currentMinutes >= beforeMinutes) return false;
  }

  return true;
}

function matchesConditions(
  conditions: FeedHeaderConditions,
  context: FeedContext,
): boolean {
  if (!conditions || Object.keys(conditions).length === 0) return true;

  if (conditions.weather_signals?.length) {
    if (!context.weather_signal || !conditions.weather_signals.includes(context.weather_signal)) {
      return false;
    }
  }

  if (conditions.holidays?.length) {
    const activeSlugs = context.active_holidays.map((h) => h.slug);
    if (!conditions.holidays.some((slug) => activeSlugs.includes(slug))) {
      return false;
    }
  }

  if (conditions.festivals === true) {
    if (context.active_festivals.length === 0) return false;
  }
  if (conditions.festivals === false) {
    if (context.active_festivals.length > 0) return false;
  }

  if (conditions.time_slots?.length) {
    if (!conditions.time_slots.includes(context.time_slot)) return false;
  }

  if (conditions.day_themes?.length) {
    if (!context.day_theme || !conditions.day_themes.includes(context.day_theme)) {
      return false;
    }
  }

  return true;
}

// ---------------------------------------------------------------------------
// Template variable resolution
// ---------------------------------------------------------------------------

function resolveTemplateVars(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}

// ---------------------------------------------------------------------------
// Dashboard card count resolution
// ---------------------------------------------------------------------------

async function resolveCardCounts(
  configs: FeedHeaderCardConfig[],
  supabase: SupabaseClient,
  portalId: string,
  portalCity: string | undefined,
  now: Date,
  timeSlot?: string,
): Promise<DashboardCard[]> {
  const results = await Promise.all(
    configs.map(async (config): Promise<DashboardCard | null> => {
      if (!config.query) {
        return {
          id: config.id,
          label: config.label,
          icon: config.icon,
          href: config.href,
          accent: config.accent,
          value: config.value || "",
        };
      }

      const count = await resolveQuery(config.query, supabase, portalId, portalCity, now);

      if (count === 0 && config.hide_when_empty) return null;

      const value = formatCardValue(count, config.query, timeSlot);

      return {
        id: config.id,
        label: config.label,
        icon: config.icon,
        href: config.href,
        accent: config.accent,
        value,
      };
    }),
  );

  return results.filter((c): c is DashboardCard => c !== null);
}

async function resolveQuery(
  query: FeedHeaderCardQuery,
  supabase: SupabaseClient,
  portalId: string,
  portalCity: string | undefined,
  now: Date,
): Promise<number> {
  try {
    if (query.entity === "events") {
      return await countEvents(query, supabase, portalId, portalCity, now);
    }
    if (query.entity === "venues") {
      return await countVenues(query, supabase, portalCity);
    }
    return 0;
  } catch {
    return 0;
  }
}

async function countEvents(
  query: FeedHeaderCardQuery,
  supabase: SupabaseClient,
  portalId: string,
  portalCity: string | undefined,
  now: Date,
): Promise<number> {
  const today = getLocalDateString(now);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (supabase as any)
    .from("events")
    .select("id", { count: "exact", head: true })
    .eq("portal_id", portalId)
    .is("canonical_event_id", null)
    .or("is_class.eq.false,is_class.is.null")
    .or("is_sensitive.eq.false,is_sensitive.is.null");

  if (query.date_filter) {
    const { start, end } = getDateRange(query.date_filter, now);
    q = q.gte("start_date", start).lte("start_date", end);
  } else {
    q = q.gte("start_date", today);
  }

  if (query.category) q = q.eq("category_id", query.category);
  if (query.time_after) q = q.gte("start_time", query.time_after);
  if (query.is_free) q = q.eq("is_free", true);

  const { count } = await q;
  return count ?? 0;
}

async function countVenues(
  query: FeedHeaderCardQuery,
  supabase: SupabaseClient,
  portalCity: string | undefined,
): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (supabase as any)
    .from("places")
    .select("id", { count: "exact", head: true })
    .eq("active", true);

  if (query.venue_type) q = q.eq("place_type", query.venue_type);
  if (query.category) q = q.contains("venue_types", [query.category]);
  if (portalCity) q = q.ilike("city", `%${portalCity}%`);

  const { count } = await q;
  return count ?? 0;
}

function formatCardValue(count: number, query: FeedHeaderCardQuery, timeSlot?: string): string {
  let suffix: string;
  if (query.date_filter === "today") {
    // morning/midday → "today", evening slots → "tonight"
    const eveningSlots = new Set(["happy_hour", "evening", "late_night"]);
    suffix = timeSlot && eveningSlots.has(timeSlot) ? "tonight" : "today";
  } else if (query.date_filter === "this_weekend") {
    suffix = "this weekend";
  } else if (query.is_open) {
    suffix = "open now";
  } else {
    suffix = "active";
  }
  return `${count} ${suffix}`;
}

function getDateRange(filter: string, now: Date): { start: string; end: string } {
  const today = getLocalDateString(now);
  switch (filter) {
    case "today":
      return { start: today, end: today };
    case "tomorrow": {
      const tmrw = new Date(now);
      tmrw.setDate(tmrw.getDate() + 1);
      return { start: getLocalDateString(tmrw), end: getLocalDateString(tmrw) };
    }
    case "this_weekend": {
      const day = now.getDay();
      const fri = new Date(now);
      fri.setDate(fri.getDate() + ((5 - day + 7) % 7 || 7));
      if (day >= 5 || day === 0) fri.setDate(now.getDate());
      const sun = new Date(fri);
      sun.setDate(fri.getDate() + (day === 0 ? 0 : 7 - fri.getDay()));
      return { start: getLocalDateString(fri), end: getLocalDateString(sun) };
    }
    case "this_week": {
      const end = new Date(now);
      end.setDate(end.getDate() + 7);
      return { start: today, end: getLocalDateString(end) };
    }
    default:
      return { start: today, end: today };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseTimeToMinutes(time: string): number | null {
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function getDayName(now: Date): string {
  return now.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
}

const DAY_THEME_LABELS: Record<string, string> = {
  taco_tuesday: "Taco Tuesday",
  wine_wednesday: "Wine Wednesday",
  thirsty_thursday: "Thirsty Thursday",
  friday_night: "Friday Night",
  brunch_weekend: "Brunch Weekend",
  saturday_night: "Saturday Night",
  sunday_funday: "Sunday Funday",
};

function humanizeDayTheme(theme?: string): string {
  if (!theme) return "";
  return DAY_THEME_LABELS[theme] ?? theme.replace(/_/g, " ");
}
