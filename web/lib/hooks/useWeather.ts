"use client";

import { useState, useEffect } from "react";

// Atlanta coordinates
const LAT = 33.749;
const LNG = -84.388;
const OPEN_METEO_URL = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LNG}&current=temperature_2m,weather_code&temperature_unit=fahrenheit`;

// Cache key and TTL (30 minutes)
const CACHE_KEY = "weather_cache";
const CACHE_TTL_MS = 30 * 60 * 1000;

interface WeatherCache {
  temp: number;
  condition: string;
  emoji: string;
  fetchedAt: number;
}

/**
 * Map WMO weather codes to human-readable condition strings.
 * https://open-meteo.com/en/docs#weathervariables (WMO Weather Interpretation Codes)
 */
function wmoToCondition(code: number): string {
  if (code === 0) return "Clear";
  if (code >= 1 && code <= 3) return "Partly Cloudy";
  if (code >= 45 && code <= 48) return "Foggy";
  if (code >= 51 && code <= 55) return "Drizzle";
  if (code >= 61 && code <= 65) return "Rainy";
  if (code >= 71 && code <= 77) return "Snowy";
  if (code >= 80 && code <= 82) return "Showers";
  if (code >= 95 && code <= 99) return "Thunderstorm";
  return "Cloudy";
}

function conditionToEmoji(condition: string): string {
  switch (condition) {
    case "Clear": return "☀️";
    case "Partly Cloudy": return "⛅";
    case "Foggy": return "🌫️";
    case "Drizzle": return "🌦️";
    case "Rainy": return "🌧️";
    case "Snowy": return "❄️";
    case "Showers": return "🌧️";
    case "Thunderstorm": return "⛈️";
    default: return "🌥️";
  }
}

export interface WeatherData {
  temp: number;
  condition: string;
  emoji: string;
  loading: boolean;
}

/**
 * Fetches current Atlanta weather from Open-Meteo (no API key required).
 * Caches result in sessionStorage for 30 minutes to avoid redundant requests.
 * Returns null temp/condition while loading or on error — callers should hide
 * the weather pill entirely rather than showing stale/fake data.
 */
export function useWeather(): WeatherData {
  const [data, setData] = useState<{ temp: number; condition: string; emoji: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchWeather() {
      // Check sessionStorage cache first
      try {
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) {
          const parsed: WeatherCache = JSON.parse(cached);
          if (Date.now() - parsed.fetchedAt < CACHE_TTL_MS) {
            if (!cancelled) {
              setData({ temp: parsed.temp, condition: parsed.condition, emoji: parsed.emoji });
              setLoading(false);
            }
            return;
          }
        }
      } catch {
        // sessionStorage unavailable — proceed with fetch
      }

      try {
        const res = await fetch(OPEN_METEO_URL);
        if (!res.ok) throw new Error(`Weather fetch failed: ${res.status}`);
        const json = await res.json();

        const temp = Math.round(json.current?.temperature_2m as number);
        const code = json.current?.weather_code as number;
        const condition = wmoToCondition(code);
        const emoji = conditionToEmoji(condition);

        const cacheEntry: WeatherCache = { temp, condition, emoji, fetchedAt: Date.now() };
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify(cacheEntry));
        } catch {
          // sessionStorage write failed — non-fatal
        }

        if (!cancelled) {
          setData({ temp, condition, emoji });
          setLoading(false);
        }
      } catch {
        // Silently fail — callers hide the pill on error
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void fetchWeather();

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    temp: data?.temp ?? 0,
    condition: data?.condition ?? "",
    emoji: data?.emoji ?? "",
    loading,
  };
}
