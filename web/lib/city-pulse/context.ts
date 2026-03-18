/**
 * Context engine for City Pulse.
 *
 * Resolves the current environmental context — time slot, day of week,
 * weather, active holidays, and active festivals — into a FeedContext
 * object that drives section assembly.
 */

import { createClient } from "@/lib/supabase/server";
import { getPortalWeather } from "@/lib/weather";
import { getWeatherSignal } from "@/lib/weather-utils";
import { getLocalDateString } from "@/lib/formats";
import { getTimeSlot, getDayOfWeek, getDayTheme } from "./time-slots";
import { getContextualQuickLinks } from "./quick-links";
import type { FeedContext, HolidayInfo, FestivalInfo, TimeSlot } from "./types";

// ---------------------------------------------------------------------------
// Holiday config (extracted from portal feed route)
// ---------------------------------------------------------------------------

interface HolidayConfig {
  slug: string;
  title: string;
  accent_color: string;
  /** Inclusive range: [startMonth, startDay, endMonth, endDay] */
  active: (year: number, month: number, day: number) => boolean;
}

const HOLIDAYS: HolidayConfig[] = [
  {
    slug: "valentines-day",
    title: "Valentine's Day",
    accent_color: "#FF69B4",
    active: (_y, m, d) => (m === 1 && d >= 20) || (m === 2 && d <= 14),
  },
  {
    slug: "lunar-new-year",
    title: "Lunar New Year",
    accent_color: "#DC143C",
    active: (_y, m, d) => (m === 1 && d >= 20) || m === 2,
  },
  {
    slug: "super-bowl",
    title: "Super Bowl",
    accent_color: "var(--neon-green)",
    active: (_y, m, d) => m === 2 && d >= 2 && d <= 9,
  },
  {
    slug: "black-history-month",
    title: "Black History Month",
    accent_color: "#e53935",
    active: (_y, m, d) => (m === 1 && d >= 20) || m === 2,
  },
  {
    slug: "mardi-gras",
    title: "Mardi Gras",
    accent_color: "#ffd700",
    active: (_y, m, d) => m === 2 && d >= 12 && d <= 17,
  },
  {
    slug: "friday-the-13th",
    title: "Friday the 13th",
    accent_color: "#00ff41",
    active: (_y, m, d) => m === 2 && d >= 10 && d <= 13,
  },
  {
    slug: "holi",
    title: "Holi",
    accent_color: "#e040fb",
    active: (_y, m, d) => (m === 2 && d >= 28) || (m === 3 && d <= 5),
  },
  {
    slug: "womens-history-month",
    title: "Women's History Month",
    accent_color: "#ab47bc",
    active: (_y, m, d) => (m === 2 && d >= 25) || m === 3,
  },
  {
    slug: "st-patricks-day",
    title: "St. Patrick's Day",
    accent_color: "#4caf50",
    active: (_y, m, d) => m === 3 && d >= 10 && d <= 17,
  },
  {
    slug: "juneteenth",
    title: "Juneteenth",
    accent_color: "#e53935",
    active: (_y, m, d) => m === 6 && d >= 14 && d <= 19,
  },
  {
    slug: "independence-day",
    title: "Fourth of July",
    accent_color: "#1565c0",
    active: (_y, m, d) => m === 6 && d >= 28 || m === 7 && d <= 4,
  },
  {
    slug: "halloween",
    title: "Halloween",
    accent_color: "#ff6d00",
    active: (_y, m, d) => (m === 10 && d >= 15) || (m === 10 && d <= 31),
  },
  {
    slug: "thanksgiving",
    title: "Thanksgiving",
    accent_color: "#ff8f00",
    active: (_y, m, d) => m === 11 && d >= 20 && d <= 28,
  },
  {
    slug: "holiday-season",
    title: "Holiday Season",
    accent_color: "#c62828",
    active: (_y, m, d) => (m === 11 && d >= 29) || m === 12,
  },
];

/**
 * Get currently active holidays based on the date.
 */
function getActiveHolidays(now: Date): HolidayInfo[] {
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-indexed
  const day = now.getDate();

  return HOLIDAYS.filter((h) => h.active(year, month, day)).map((h) => ({
    slug: h.slug,
    title: h.title,
    accent_color: h.accent_color,
  }));
}

// ---------------------------------------------------------------------------
// Festival query
// ---------------------------------------------------------------------------

/**
 * Query active festivals from the database.
 */
async function getActiveFestivals(
  portalId: string,
  today: string,
): Promise<FestivalInfo[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("festivals")
    .select("id, name, slug")
    .lte("announced_start", today)
    .gte("announced_end", today)
    .or(`portal_id.eq.${portalId},portal_id.is.null`)
    .limit(10);

  if (!data) return [];

  return (data as { id: string; name: string; slug: string }[]).map((f) => ({
    id: f.id,
    name: f.name,
    slug: f.slug,
  }));
}

// ---------------------------------------------------------------------------
// Context builder
// ---------------------------------------------------------------------------

export interface BuildContextOptions {
  portalId: string;
  portalSlug: string;
  portalLat?: number;
  portalLng?: number;
  /** Override for testing / admin preview */
  timeSlotOverride?: TimeSlot;
  dayOverride?: string;
  now?: Date;
}

/**
 * Build the complete FeedContext for a City Pulse request.
 * Runs weather + festival queries in parallel.
 */
export async function buildFeedContext(
  options: BuildContextOptions,
): Promise<FeedContext> {
  const { portalId, portalSlug, portalLat, portalLng, timeSlotOverride, dayOverride } = options;
  const now = options.now ?? new Date();
  const today = getLocalDateString(now);

  const timeSlot = timeSlotOverride ?? getTimeSlot(now.getHours());
  const dayOfWeek = dayOverride || getDayOfWeek(now);

  // Parallel: weather + festivals
  const [weather, activeFestivals] = await Promise.all([
    portalLat && portalLng
      ? getPortalWeather(portalId, portalLat, portalLng)
      : Promise.resolve(null),
    getActiveFestivals(portalId, today),
  ]);

  const activeHolidays = getActiveHolidays(now);

  // Build contextual quick links based on moment + weather
  const weatherSignal = weather ? getWeatherSignal(weather) : null;
  const quickLinks = getContextualQuickLinks(
    portalSlug,
    timeSlot,
    dayOfWeek,
    weatherSignal,
  );

  // Day-of-week theme
  const dayTheme = getDayTheme(dayOfWeek, timeSlot);

  return {
    time_slot: timeSlot,
    day_of_week: dayOfWeek,
    weather: weather
      ? {
          temperature_f: weather.temperature_f,
          condition: weather.condition,
          icon: weather.icon,
        }
      : null,
    active_holidays: activeHolidays,
    active_festivals: activeFestivals,
    quick_links: quickLinks,
    day_theme: dayTheme,
    weather_signal: weatherSignal ?? undefined,
  };
}

// getDayTheme is imported from ./time-slots (shared with client-side shell)
