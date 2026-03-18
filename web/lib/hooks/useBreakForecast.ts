"use client";

import { useState, useEffect } from "react";
import type { ForecastDay } from "@/app/api/weather/forecast/route";

export type BreakDayForecast = ForecastDay;

export interface BreakForecast {
  days: BreakDayForecast[];
  loading: boolean;
  error: boolean;
}

/**
 * Fetches an Atlanta daily forecast for a specific date range via the server-side proxy
 * at /api/weather/forecast. The proxy requests 16 days and the hook filters the response
 * to the requested startDate–endDate window.
 *
 * The proxy caches at CDN (s-maxage=1800) and in-memory (30 min), so all users share
 * one upstream Open-Meteo request.
 *
 * startDate and endDate must be YYYY-MM-DD strings.
 * Only works for dates within the next ~16 days; returns empty array for dates beyond that.
 */
export function useBreakForecast(
  startDate: string | null,
  endDate: string | null
): BreakForecast {
  const [state, setState] = useState<BreakForecast>({
    days: [],
    loading: true,
    error: false,
  });

  useEffect(() => {
    if (!startDate || !endDate) {
      setState({ days: [], loading: false, error: false });
      return;
    }

    let cancelled = false;

    async function fetchForecast() {
      try {
        const res = await fetch("/api/weather/forecast?days=16");
        if (!res.ok) throw new Error(`Forecast proxy returned ${res.status}`);
        const json = (await res.json()) as { days: ForecastDay[] };

        // Filter to the requested date range
        const filtered = (json.days ?? []).filter(
          (d) => d.date >= startDate! && d.date <= endDate!
        );

        if (!cancelled) {
          setState({ days: filtered, loading: false, error: false });
        }
      } catch {
        if (!cancelled) {
          setState({ days: [], loading: false, error: true });
        }
      }
    }

    void fetchForecast();
    return () => {
      cancelled = true;
    };
  }, [startDate, endDate]);

  return state;
}
