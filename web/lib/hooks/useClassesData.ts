"use client";

import { useState, useEffect, useRef } from "react";

// --- Types aligned with /api/classes/studios and /api/classes responses ---

export interface StudioNextClass {
  title: string;
  start_date: string;
  start_time: string | null;
}

export interface StudioSummary {
  place_id: number;
  name: string;
  slug: string;
  neighborhood: string | null;
  lat: number | null;
  lng: number | null;
  image_url: string | null;
  class_count: number;
  categories: string[];
  next_class: StudioNextClass | null;
}

export interface StudiosResponse {
  studios: StudioSummary[];
  category_counts: Record<string, number>;
  total_count: number;
}

export interface ClassEventVenue {
  id: number;
  name: string;
  slug: string;
  neighborhood: string | null;
}

export interface ClassEvent {
  id: number;
  title: string;
  description?: string | null;
  start_date: string;
  start_time: string | null;
  end_date?: string | null;
  end_time: string | null;
  is_all_day?: boolean | null;
  category_id?: string | null;
  tags?: string[] | null;
  price_min: number | null;
  price_max?: number | null;
  price_note?: string | null;
  is_free: boolean | null;
  source_url?: string | null;
  ticket_url?: string | null;
  image_url: string | null;
  is_class?: boolean | null;
  class_category: string | null;
  skill_level: string | null;
  instructor: string | null;
  capacity: number | null;
  is_recurring?: boolean | null;
  series_id: string | null;
  place_id?: number | null;
  slug?: string | null;
  venue: ClassEventVenue | null;
}

export interface ClassesResponse {
  classes: ClassEvent[];
  total: number;
  limit: number;
  offset: number;
}

export interface UseClassesDataParams {
  portalSlug: string;
  category?: string | null;
  dateWindow?: string | null;
  skillLevel?: string | null;
  search?: string | null;
  studioSlug?: string | null;
}

export interface UseClassesDataResult {
  studios: StudiosResponse | null;
  schedule: ClassesResponse | null;
  studiosLoading: boolean;
  scheduleLoading: boolean;
  error: string | null;
}

// Convert "week" / "weekend" / "2weeks" / "all" to { startDate, endDate }
// Uses ET timezone via Intl.DateTimeFormat
function computeDateRange(dateWindow: string | null | undefined): {
  startDate: string | null;
  endDate: string | null;
} {
  if (!dateWindow || dateWindow === "all") {
    return { startDate: null, endDate: null };
  }

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
  });
  const todayStr = formatter.format(new Date()); // "YYYY-MM-DD"
  const today = new Date(`${todayStr}T00:00:00`);

  if (dateWindow === "week") {
    const end = new Date(today);
    end.setDate(today.getDate() + 6);
    return { startDate: todayStr, endDate: formatter.format(end) };
  }

  if (dateWindow === "2weeks") {
    const end = new Date(today);
    end.setDate(today.getDate() + 13);
    return { startDate: todayStr, endDate: formatter.format(end) };
  }

  if (dateWindow === "weekend") {
    // Find the upcoming Saturday (day 6) and Sunday (day 0 → next day)
    const dayOfWeek = today.getDay(); // 0=Sun, 6=Sat
    let daysToSat: number;
    if (dayOfWeek === 6) {
      daysToSat = 0; // today is Saturday
    } else if (dayOfWeek === 0) {
      daysToSat = 6; // today is Sunday, next Saturday is 6 days away
    } else {
      daysToSat = 6 - dayOfWeek;
    }
    const sat = new Date(today);
    sat.setDate(today.getDate() + daysToSat);
    const sun = new Date(sat);
    sun.setDate(sat.getDate() + 1);
    return { startDate: formatter.format(sat), endDate: formatter.format(sun) };
  }

  return { startDate: null, endDate: null };
}

export function useClassesData({
  portalSlug,
  category,
  dateWindow,
  skillLevel,
  search,
  studioSlug,
}: UseClassesDataParams): UseClassesDataResult {
  const [studios, setStudios] = useState<StudiosResponse | null>(null);
  const [schedule, setSchedule] = useState<ClassesResponse | null>(null);
  const [studiosLoading, setStudiosLoading] = useState(false);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cache studios responses to avoid refetch on back navigation
  const studiosCache = useRef<Map<string, StudiosResponse>>(new Map());
  const abortRef = useRef<AbortController | null>(null);

  // --- Studios fetch (runs when no studioSlug) ---
  useEffect(() => {
    if (studioSlug) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const { startDate, endDate } = computeDateRange(dateWindow);
    const cacheKey = `${category ?? ""}|${dateWindow ?? ""}|${skillLevel ?? ""}|${search ?? ""}`;

    const cached = studiosCache.current.get(cacheKey);
    if (cached) {
      setStudios(cached);
      setStudiosLoading(false);
      setError(null);
      return;
    }

    setStudiosLoading(true);
    setError(null);

    const params = new URLSearchParams({ portal: portalSlug });
    if (category) params.set("class_category", category);
    if (startDate) params.set("start_date", startDate);
    if (endDate) params.set("end_date", endDate);
    if (skillLevel && skillLevel !== "all") params.set("skill_level", skillLevel);
    if (search) params.set("search", search);

    const timeoutId = setTimeout(() => controller.abort(), 8000);

    async function run() {
      try {
        const res = await fetch(`/api/classes/studios?${params}`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!res.ok) throw new Error(`studios: ${res.status}`);
        const data = (await res.json()) as StudiosResponse;
        studiosCache.current.set(cacheKey, data);
        setStudios(data);
      } catch (err) {
        clearTimeout(timeoutId);
        if ((err as Error).name === "AbortError") return;
        console.error("[useClassesData] studios fetch error:", err);
        setError("Failed to load studios");
        setStudios(null);
      } finally {
        setStudiosLoading(false);
      }
    }

    run();

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [portalSlug, category, dateWindow, skillLevel, search, studioSlug]);

  // --- Schedule fetch (runs when studioSlug is set) ---
  useEffect(() => {
    if (!studioSlug) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setScheduleLoading(true);
    setError(null);

    const { startDate, endDate } = computeDateRange(dateWindow);
    const params = new URLSearchParams({
      place_slug: studioSlug,
      portal: portalSlug,
      limit: "200",
    });
    if (startDate) params.set("start_date", startDate);
    if (endDate) params.set("end_date", endDate);
    if (skillLevel && skillLevel !== "all") params.set("skill_level", skillLevel);
    if (category) params.set("class_category", category);

    const timeoutId = setTimeout(() => controller.abort(), 8000);

    async function run() {
      try {
        const res = await fetch(`/api/classes?${params}`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!res.ok) throw new Error(`schedule: ${res.status}`);
        const data = (await res.json()) as ClassesResponse;
        setSchedule(data);
      } catch (err) {
        clearTimeout(timeoutId);
        if ((err as Error).name === "AbortError") return;
        console.error("[useClassesData] schedule fetch error:", err);
        setError("Failed to load studio schedule");
        setSchedule(null);
      } finally {
        setScheduleLoading(false);
      }
    }

    run();

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [portalSlug, studioSlug, dateWindow, skillLevel, category]);

  return { studios, schedule, studiosLoading, scheduleLoading, error };
}
