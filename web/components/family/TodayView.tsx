"use client";

import { memo, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWeather } from "@/lib/hooks/useWeather";
import { matchesEnvironmentFilter, isRainyWeather, isSunnyWeather } from "@/lib/family-constants";
import type { GenericFilter } from "./KidFilterChips";
import {
  type SchoolCalendarEvent,
  type ProgramWithVenue,
} from "@/lib/types/programs";
import type { EventWithLocation } from "@/lib/event-search";
import type { FamilyDestination } from "./FamilyDestinationCard";

// ---- Sections ---------------------------------------------------------------
import { GreetingHeadline, WeatherPill } from "./sections/GreetingBanner";
import { FeaturedHero } from "./sections/FeaturedHero";
import { HeadsUpSection } from "./sections/HeadsUpSection";
import { RegistrationRadarSection } from "./sections/RegistrationRadarSection";
import { PlacesToGoSection } from "./sections/PlacesToGoSection";
import { ExploreByTypeSection } from "./sections/ExploreByTypeSection";
import { RainyDayBanner, GetOutsideBanner } from "./sections/WeatherBanners";
import { AfterSchoolPicksSection } from "./sections/AfterSchoolPicksSection";
import { WeekendSection } from "./sections/WeekendSection";

// ---- Types ---------------------------------------------------------------

interface TodayViewProps {
  portalId: string;
  portalSlug: string;
  activeKidIds?: string[];
  kids?: import("@/lib/types/kid-profiles").KidProfile[];
  activeGenericFilters?: GenericFilter[];
  desktopLayout?: boolean;
}

// ---- Weekend helpers -------------------------------------------------------

/** Returns true when weekend content should be shown more prominently (Thu–Sun). */
function isWeekendProminent(): boolean {
  const day = new Date().getDay(); // 0=Sun, 1=Mon, ..., 4=Thu, 5=Fri, 6=Sat
  return day === 0 || day >= 4; // Thu, Fri, Sat, Sun
}

// ---- Data fetchers -------------------------------------------------------

async function fetchSchoolCalendar(): Promise<SchoolCalendarEvent[]> {
  const res = await fetch("/api/school-calendar?upcoming=true&limit=5");
  if (!res.ok) return [];
  const json = await res.json();
  return (json.events ?? []) as SchoolCalendarEvent[];
}

async function fetchRegistrationRadar(portalSlug: string): Promise<{
  opening_soon: ProgramWithVenue[];
  closing_soon: ProgramWithVenue[];
  filling_fast: ProgramWithVenue[];
}> {
  const res = await fetch(
    `/api/programs/registration-radar?portal=${encodeURIComponent(portalSlug)}`
  );
  if (!res.ok) return { opening_soon: [], closing_soon: [], filling_fast: [] };
  return res.json();
}

async function fetchTodayEvents(portalSlug: string): Promise<EventWithLocation[]> {
  // No tags filter — the portal's federated sources are family-relevant by definition.
  // Adding tags:"family-friendly" double-filters and empties the feed on low-data days.
  const params = new URLSearchParams({
    date: "today",
    portal: portalSlug,
    limit: "20",
    useCursor: "true",
  });
  const res = await fetch(`/api/events?${params.toString()}`);
  if (!res.ok) return [];
  const json = await res.json();
  return (json.events ?? []) as EventWithLocation[];
}

async function fetchFamilyDestinations(
  portalSlug: string,
  environment?: "indoor" | "outdoor"
): Promise<FamilyDestination[]> {
  const params = new URLSearchParams({ portal: portalSlug, limit: "8", sort: "popular" });
  if (environment) params.set("environment", environment);
  const res = await fetch(`/api/family/destinations?${params.toString()}`);
  if (!res.ok) return [];
  const json = await res.json();
  return (json.destinations ?? []) as FamilyDestination[];
}

// ---- Main component -------------------------------------------------------

export const TodayView = memo(function TodayView({
  portalId,
  portalSlug,
  activeKidIds = [],
  kids = [],
  activeGenericFilters = [],
  desktopLayout = false,
}: TodayViewProps) {
  // Derive active kids for future age-based filtering
  const _selectedKids = activeKidIds.length > 0
    ? kids.filter((k) => activeKidIds.includes(k.id))
    : [];
  void _selectedKids;

  // Resolve active environment filter (at most one of indoor/outdoor active at a time)
  const indoorActive = activeGenericFilters.includes("indoor");
  const outdoorActive = activeGenericFilters.includes("outdoor");

  const weather = useWeather();

  const { data: calendarData, isLoading: loadingCalendar } = useQuery({
    queryKey: ["family-school-calendar"],
    queryFn: fetchSchoolCalendar,
    staleTime: 5 * 60 * 1000,
  });

  const { data: radarData, isLoading: loadingRadar } = useQuery({
    queryKey: ["family-registration-radar", portalSlug],
    queryFn: () => fetchRegistrationRadar(portalSlug),
    staleTime: 2 * 60 * 1000,
  });

  const { data: todayEvents, isLoading: loadingToday } = useQuery({
    queryKey: ["family-today-events", portalId],
    queryFn: () => fetchTodayEvents(portalSlug),
    staleTime: 60 * 1000,
  });

  // Derive environment preference from weather — undefined while loading means "no filter yet"
  const destinationEnvironment: "indoor" | "outdoor" | undefined = (() => {
    if (weather.loading || !weather.condition) return undefined;
    if (isRainyWeather(weather.condition)) return "indoor";
    if (isSunnyWeather(weather.condition, weather.temp)) return "outdoor";
    return undefined;
  })();

  // Fetch destinations immediately with no filter (queryKey starts as [..., undefined]).
  // Once weather resolves and destinationEnvironment changes, React Query refetches with
  // the environment filter applied — no blocking waterfall.
  const { data: familyDestinations, isLoading: loadingDestinations } = useQuery({
    queryKey: ["family-destinations", portalSlug, destinationEnvironment],
    queryFn: () => fetchFamilyDestinations(portalSlug, destinationEnvironment),
    staleTime: 5 * 60 * 1000,
  });

  // Apply indoor/outdoor filter to today's events based on active generic filter chips.
  // We derive the environment from venue_type (already in EventWithLocation).
  const filteredTodayEvents = useMemo(() => {
    if (!todayEvents) return [];
    if (indoorActive) {
      return todayEvents.filter((e) => matchesEnvironmentFilter(e.venue?.place_type, "indoor"));
    }
    if (outdoorActive) {
      return todayEvents.filter((e) => matchesEnvironmentFilter(e.venue?.place_type, "outdoor"));
    }
    return todayEvents;
  }, [todayEvents, indoorActive, outdoorActive]);

  // Derive featured event from the first today event — no separate API call needed.
  const safeFeaturedEvent = useMemo(() => {
    const first = filteredTodayEvents[0] ?? null;
    if (!first) return null;
    if (/\badult/i.test(first.title)) return null;
    return first;
  }, [filteredTodayEvents]);

  const todayEventCount = loadingToday ? null : filteredTodayEvents.length;

  // Determine whether weekend content should be prominently placed (Thu–Sun).
  const weekendProminent = isWeekendProminent();

  // Gate school calendar section — only show if we have >= 5 future events
  const showSchoolCalendar = calendarData && calendarData.length >= 5;

  // Determine whether to show the weather-aware banner.
  // Show only when weather is loaded, no explicit indoor/outdoor chip is active (the chip
  // already does the filtering), and conditions warrant a suggestion.
  const showRainyBanner =
    !weather.loading &&
    !!weather.condition &&
    !indoorActive &&
    !outdoorActive &&
    isRainyWeather(weather.condition);

  const showSunnyBanner =
    !weather.loading &&
    !!weather.condition &&
    !indoorActive &&
    !outdoorActive &&
    !showRainyBanner &&
    isSunnyWeather(weather.condition, weather.temp);

  const weatherContext = showRainyBanner ? "rainy" : showSunnyBanner ? "sunny" : null;

  // ---- Desktop layout ------------------------------------------------------
  if (desktopLayout) {
    return (
      <div className="flex flex-col gap-6 px-5">
        {/* Top row: greeting + weather pill */}
        <div className="flex items-start justify-between pt-2">
          <GreetingHeadline todayEventCount={todayEventCount} />
          {!weather.loading && weather.condition && (
            <WeatherPill temp={weather.temp} condition={weather.condition} emoji={weather.emoji} />
          )}
        </div>

        {/* Featured hero */}
        <FeaturedHero
          event={safeFeaturedEvent}
          isLoading={loadingToday}
          portalSlug={portalSlug}
        />

        {/* Two-column grid */}
        <div className="grid gap-6" style={{ gridTemplateColumns: "1fr 340px" }}>
          {/* Left column: Events */}
          <div className="flex flex-col gap-6">
            {/* Weather-aware banner */}
            {showRainyBanner && (
              <RainyDayBanner portalSlug={portalSlug} condition={weather.condition} />
            )}
            {showSunnyBanner && (
              <GetOutsideBanner portalSlug={portalSlug} condition={weather.condition} temp={weather.temp} />
            )}
            <AfterSchoolPicksSection
              events={filteredTodayEvents}
              isLoading={loadingToday}
              portalSlug={portalSlug}
            />
          </div>
          {/* Right column: Heads Up + Registration */}
          <div className="flex flex-col gap-6">
            {showSchoolCalendar && (
              <HeadsUpSection calendarData={calendarData} isLoading={loadingCalendar} />
            )}
            <RegistrationRadarSection radarData={radarData} isLoading={loadingRadar} />
          </div>
        </div>

        {/* Full-width bottom: Places to Go + Explore by Type + Weekend */}
        <div className="pb-6 flex flex-col gap-6">
          <PlacesToGoSection
            destinations={familyDestinations}
            isLoading={loadingDestinations}
            portalSlug={portalSlug}
            weatherContext={weatherContext}
          />
          <ExploreByTypeSection portalSlug={portalSlug} />
          <WeekendSection portalSlug={portalSlug} prominent={weekendProminent} />
        </div>
      </div>
    );
  }

  // ---- Mobile layout -------------------------------------------------------
  return (
    <div className="flex flex-col gap-5 pb-8 max-w-2xl mx-auto" style={{ overflowX: "hidden" }}>
      {/* Greeting + Weather */}
      <div className="px-4 pt-2">
        {!weather.loading && weather.condition && (
          <div className="flex items-center justify-between mb-2">
            <WeatherPill temp={weather.temp} condition={weather.condition} emoji={weather.emoji} />
          </div>
        )}
        <GreetingHeadline todayEventCount={todayEventCount} />
      </div>

      <div className="flex flex-col gap-6 px-4">
        {/* Featured hero */}
        <FeaturedHero
          event={safeFeaturedEvent}
          isLoading={loadingToday}
          portalSlug={portalSlug}
        />

        {/* Heads Up */}
        {showSchoolCalendar && (
          <HeadsUpSection calendarData={calendarData} isLoading={loadingCalendar} />
        )}

        {/* Places to Go — destination carousel (weather-aware, mobile edge bleed) */}
        <PlacesToGoSection
          destinations={familyDestinations}
          isLoading={loadingDestinations}
          portalSlug={portalSlug}
          weatherContext={weatherContext}
          mobileEdgeBleed
        />

        {/* Explore by Type — category grid */}
        <ExploreByTypeSection portalSlug={portalSlug} />

        {/* Weather-aware banner */}
        {showRainyBanner && (
          <RainyDayBanner portalSlug={portalSlug} condition={weather.condition} />
        )}
        {showSunnyBanner && (
          <GetOutsideBanner portalSlug={portalSlug} condition={weather.condition} temp={weather.temp} />
        )}

        {/* Weekend section (prominent = before today picks, e.g. Thu-Sun) */}
        {weekendProminent && (
          <WeekendSection portalSlug={portalSlug} prominent={true} />
        )}

        {/* After School Picks */}
        <AfterSchoolPicksSection
          events={filteredTodayEvents}
          isLoading={loadingToday}
          portalSlug={portalSlug}
        />

        {/* Registration Radar */}
        <RegistrationRadarSection radarData={radarData} isLoading={loadingRadar} />

        {/* Weekend section (non-prominent = plan-ahead, below today content, Mon-Wed) */}
        {!weekendProminent && (
          <WeekendSection portalSlug={portalSlug} prominent={false} />
        )}
      </div>
    </div>
  );
});

export type { TodayViewProps };
