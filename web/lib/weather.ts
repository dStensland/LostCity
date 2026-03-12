/**
 * Server-side weather service
 * Fetches from OpenWeatherMap, caches in portal_weather_cache table
 */

import { createServiceClient } from "@/lib/supabase/service";
import type { WeatherData, ForecastDay } from "@/lib/weather-utils";

const OPENWEATHER_BASE = "https://api.openweathermap.org/data/2.5/weather";
const OPENWEATHER_FORECAST = "https://api.openweathermap.org/data/2.5/forecast";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Get weather for a portal, with caching
 */
export async function getPortalWeather(
  portalId: string,
  lat: number,
  lng: number
): Promise<WeatherData | null> {
  const serviceClient = createServiceClient();

  // Check cache first
  const { data: cached } = await serviceClient
    .from("portal_weather_cache")
    .select("*")
    .eq("portal_id", portalId)
    .maybeSingle();

  const cachedData = cached as {
    temperature_f: number;
    condition: string;
    icon: string;
    humidity: number;
    wind_mph: number;
    fetched_at: string;
  } | null;

  if (cachedData?.fetched_at) {
    const cacheAge = Date.now() - new Date(cachedData.fetched_at).getTime();
    if (cacheAge < CACHE_TTL_MS) {
      return {
        temperature_f: cachedData.temperature_f,
        condition: cachedData.condition,
        icon: cachedData.icon,
        humidity: cachedData.humidity,
        wind_mph: cachedData.wind_mph,
        fetched_at: cachedData.fetched_at,
      };
    }
  }

  // Fetch fresh data from OpenWeatherMap
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    console.warn("OPENWEATHER_API_KEY not set, skipping weather fetch");
    return cachedData || null;
  }

  try {
    const url = `${OPENWEATHER_BASE}?lat=${lat}&lon=${lng}&units=imperial&appid=${apiKey}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      console.error("OpenWeatherMap API error:", res.status);
      return cachedData || null;
    }

    const data = await res.json();

    const weatherData: WeatherData = {
      temperature_f: data.main?.temp ?? 72,
      condition: data.weather?.[0]?.description ?? "clear",
      icon: data.weather?.[0]?.icon ?? "01d",
      humidity: data.main?.humidity ?? 50,
      wind_mph: data.wind?.speed ?? 0,
      fetched_at: new Date().toISOString(),
    };

    // Upsert cache
    await serviceClient
      .from("portal_weather_cache")
      .upsert(
        {
          portal_id: portalId,
          temperature_f: weatherData.temperature_f,
          condition: weatherData.condition,
          icon: weatherData.icon,
          humidity: weatherData.humidity,
          wind_mph: weatherData.wind_mph,
          fetched_at: weatherData.fetched_at,
        } as never,
        { onConflict: "portal_id" }
      );

    return weatherData;
  } catch (err) {
    console.error("Weather fetch error:", err);
    return cachedData || null;
  }
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Get 3-day forecast for a location.
 * Uses OpenWeatherMap 5-day/3-hour forecast, aggregated to daily hi/lo.
 */
export async function getPortalForecast(
  lat: number,
  lng: number,
): Promise<ForecastDay[]> {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) return [];

  try {
    const url = `${OPENWEATHER_FORECAST}?lat=${lat}&lon=${lng}&units=imperial&cnt=24&appid=${apiKey}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return [];
    const data = await res.json();

    // Group 3-hour slots by date, compute hi/lo per day
    const dayMap = new Map<string, { temps: number[]; condition: string; icon: string }>();
    for (const slot of data.list || []) {
      const date = slot.dt_txt?.slice(0, 10);
      if (!date) continue;
      const entry = dayMap.get(date) || { temps: [], condition: "", icon: "" };
      entry.temps.push(slot.main?.temp ?? 72);
      // Use midday condition as representative (slot closest to noon)
      const hour = parseInt(slot.dt_txt?.slice(11, 13) || "0", 10);
      if (hour >= 11 && hour <= 15 && !entry.condition) {
        entry.condition = slot.weather?.[0]?.description ?? "clear";
        entry.icon = slot.weather?.[0]?.icon ?? "01d";
      }
      dayMap.set(date, entry);
    }

    const today = new Date().toISOString().slice(0, 10);
    const result: ForecastDay[] = [];

    for (const [date, info] of dayMap) {
      if (result.length >= 3) break;
      // Ensure we have a condition fallback
      if (!info.condition) {
        const lastSlot = (data.list || []).find((s: { dt_txt: string }) => s.dt_txt?.startsWith(date));
        info.condition = lastSlot?.weather?.[0]?.description ?? "clear";
        info.icon = lastSlot?.weather?.[0]?.icon ?? "01d";
      }

      const d = new Date(date + "T12:00:00");
      const dayLabel = date === today
        ? "Today"
        : date === new Date(Date.now() + 86400000).toISOString().slice(0, 10)
          ? "Tomorrow"
          : DAY_NAMES[d.getDay()];

      result.push({
        date,
        day_label: dayLabel,
        high_f: Math.round(Math.max(...info.temps)),
        low_f: Math.round(Math.min(...info.temps)),
        condition: info.condition,
        icon: info.icon,
      });
    }

    return result;
  } catch {
    return [];
  }
}
