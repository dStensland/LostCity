"use client";

import { useState, useEffect } from "react";

export interface WeatherData {
  temp: number;
  condition: string;
  emoji: string;
  windSpeed: number;
  humidity: number;
  uvIndex: number;
  loading: boolean;
}

/**
 * Fetches current Atlanta weather via the server-side proxy at /api/weather/current.
 * The proxy caches at both the CDN level (s-maxage=600) and in-memory (10 min),
 * so all users share one upstream Open-Meteo request instead of each making their own.
 *
 * Returns zero values while loading or on error — callers should hide the weather pill
 * rather than showing stale/fake data.
 *
 * Note: uvIndex is not returned by the proxy (Open-Meteo current only requested the
 * four fields the proxy fetches). This field remains in WeatherData for API compat
 * but will always be 0.
 */
export function useWeather(): WeatherData {
  const [data, setData] = useState<Omit<WeatherData, "loading"> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchWeather() {
      try {
        const res = await fetch("/api/weather/current");
        if (!res.ok) throw new Error(`Weather proxy returned ${res.status}`);
        const json = (await res.json()) as {
          temperature: number;
          condition: string;
          emoji: string;
          humidity: number;
          windSpeed: number;
        };

        if (!cancelled) {
          setData({
            temp: json.temperature,
            condition: json.condition,
            emoji: json.emoji,
            windSpeed: json.windSpeed,
            humidity: json.humidity,
            uvIndex: 0,
          });
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
    windSpeed: data?.windSpeed ?? 0,
    humidity: data?.humidity ?? 0,
    uvIndex: data?.uvIndex ?? 0,
    loading,
  };
}
