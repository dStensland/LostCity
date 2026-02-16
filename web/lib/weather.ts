/**
 * Server-side weather service
 * Fetches from OpenWeatherMap, caches in portal_weather_cache table
 */

import { createServiceClient } from "@/lib/supabase/service";
import type { WeatherData } from "@/lib/weather-utils";

const OPENWEATHER_BASE = "https://api.openweathermap.org/data/2.5/weather";
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
