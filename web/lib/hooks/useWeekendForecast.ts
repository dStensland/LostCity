"use client";

import { useState, useEffect } from "react";
import { isRainyCondition } from "@/lib/wmo-weather-utils";
import type { ForecastDay } from "@/app/api/weather/forecast/route";

export interface WeekendForecast {
  saturday: ForecastDay | null;
  sunday: ForecastDay | null;
  loading: boolean;
  hasRain: boolean;
}

/** Returns the next Saturday and Sunday as YYYY-MM-DD strings. */
function getWeekendDateStrings(): { saturdayStr: string; sundayStr: string } {
  const today = new Date();
  const day = today.getDay(); // 0=Sun, 6=Sat
  let daysUntilSat: number;
  if (day === 6) {
    daysUntilSat = 0;
  } else if (day === 0) {
    daysUntilSat = -1;
  } else {
    daysUntilSat = 6 - day;
  }
  const saturday = new Date(today);
  saturday.setDate(today.getDate() + daysUntilSat);
  const sunday = new Date(saturday);
  sunday.setDate(saturday.getDate() + 1);

  const fmt = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  };

  return { saturdayStr: fmt(saturday), sundayStr: fmt(sunday) };
}

/**
 * Fetches the Atlanta weekend (Sat + Sun) weather forecast via the server-side proxy
 * at /api/weather/forecast. The proxy caches at the CDN (s-maxage=1800) and in-memory
 * (30 min), so all users share one upstream request.
 */
export function useWeekendForecast(): WeekendForecast {
  const [days, setDays] = useState<ForecastDay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchForecast() {
      try {
        const res = await fetch("/api/weather/forecast?days=7");
        if (!res.ok) throw new Error(`Forecast proxy returned ${res.status}`);
        const json = (await res.json()) as { days: ForecastDay[] };

        if (!cancelled) {
          setDays(json.days ?? []);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void fetchForecast();
    return () => {
      cancelled = true;
    };
  }, []);

  const { saturdayStr, sundayStr } = getWeekendDateStrings();

  const saturday = days.find((d) => d.date === saturdayStr) ?? null;
  const sunday = days.find((d) => d.date === sundayStr) ?? null;

  const hasRain =
    (saturday !== null && isRainyCondition(saturday.condition)) ||
    (sunday !== null && isRainyCondition(sunday.condition));

  return { saturday, sunday, loading, hasRain };
}
