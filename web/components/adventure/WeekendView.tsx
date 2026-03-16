"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Lightning } from "@phosphor-icons/react";
import { DestinationCard } from "./DestinationCard";
import {
  AdventureEventCard,
  AdventureEventCardSkeleton,
} from "./AdventureEventCard";
import { useAdventureProgress } from "@/lib/hooks/useAdventureProgress";
import { useWeather } from "@/lib/hooks/useWeather";
import type { YonderDestinationIntelligence } from "@/config/yonder-destination-intelligence";
import type { TimeSlot } from "@/lib/city-pulse/types";
import { ADV, ADV_FONT } from "@/lib/adventure-tokens";

// ---- Types ---------------------------------------------------------------

export interface WeekendViewProps {
  portalSlug: string;
}

type YonderDestinationCard = YonderDestinationIntelligence & {
  id: number;
  city: string | null;
  state: string | null;
  imageUrl: string | null;
  shortDescription: string | null;
  venueType: string | null;
};

// ---- Weather signal derivation -------------------------------------------

function getWeatherSignal(condition: string): string | null {
  if (!condition) return null;
  const lower = condition.toLowerCase();
  if (lower.includes("clear") || lower.includes("sunny")) return "nice";
  if (lower.includes("rain") || lower.includes("drizzle") || lower.includes("shower")) return "rain";
  if (lower.includes("thunder") || lower.includes("storm")) return "rain";
  if (lower.includes("snow") || lower.includes("freezing")) return "cold";
  return null;
}

// ---- Scoring logic (extracted from YonderRegionalEscapesSection) ----------

function getTierBaseScore(
  tier: string,
  isWeekendWindow: boolean,
  timeSlot: TimeSlot | null | undefined,
): number {
  switch (tier) {
    case "weekend":
      return isWeekendWindow ? 28 : 8;
    case "fullday":
      return isWeekendWindow || timeSlot === "morning" || timeSlot === "midday" ? 24 : 14;
    case "halfday":
      return timeSlot === "happy_hour" || timeSlot === "evening" ? 20 : 16;
    case "hour":
      return timeSlot === "late_night" ? 18 : 10;
    default:
      return 10;
  }
}

function scoreDestinationForConditions(
  destination: YonderDestinationCard,
  weatherSignal: string | null,
  isWeekendWindow: boolean,
  timeSlot: TimeSlot | null | undefined,
): number {
  let score = getTierBaseScore(destination.commitmentTier, isWeekendWindow, timeSlot);
  const tags = new Set(destination.weatherFitTags);

  if (weatherSignal === "nice") {
    if (tags.has("clear-day")) score += 8;
    if (tags.has("sunrise-friendly")) score += 4;
    if (destination.commitmentTier === "weekend") score += 5;
    if (destination.commitmentTier === "fullday") score += 3;
  } else if (weatherSignal === "rain") {
    if (tags.has("after-rain")) score += 10;
    if (tags.has("clear-day")) score -= 4;
    if (destination.commitmentTier === "weekend") score -= 3;
  } else if (weatherSignal === "hot") {
    if (tags.has("summer-friendly")) score += 8;
    if (tags.has("heat-exposed")) score -= 8;
    if (destination.commitmentTier === "halfday") score += 4;
    if (destination.commitmentTier === "weekend") score -= 2;
  } else if (weatherSignal === "cold") {
    if (tags.has("cool-weather")) score += 8;
    if (tags.has("clear-day")) score += 3;
  }

  if (destination.driveTimeMinutes <= 95) score += 2;
  if (destination.difficultyLevel === "easy") score += 1;
  if (destination.primaryActivity === "camping_base" && isWeekendWindow) score += 2;

  return score;
}

// ---- Weekend subtitle logic ----------------------------------------------

function getSubtitle(weatherSignal: string | null, isWeekendWindow: boolean): string {
  if (weatherSignal === "rain") return "Rain-adjusted picks — best once conditions clear";
  if (weatherSignal === "nice" && isWeekendWindow) return "Good-weather weekend window — ranked by conditions fit";
  if (isWeekendWindow) return "Weekend-ready escapes worth the drive";
  return "Full-day and weekend destinations for when you have the time";
}

// ---- Adventure event type (matches API response) -------------------------

type AdventureEventData = {
  id: number;
  title: string;
  startDate: string;
  startTime: string | null;
  endTime: string | null;
  isAllDay: boolean;
  imageUrl: string | null;
  description: string | null;
  sourceUrl: string | null;
  ticketUrl: string | null;
  venueName: string | null;
  venueSlug: string | null;
  venueImageUrl: string | null;
  neighborhood: string | null;
  sourceName: string | null;
  tags: string[] | null;
};

// ---- Main component ------------------------------------------------------

export function WeekendView({ portalSlug }: WeekendViewProps) {
  const { isVisited, markVisited } = useAdventureProgress();
  const weather = useWeather();

  const { data, isLoading } = useQuery<{ destinations: YonderDestinationCard[] }>({
    queryKey: ["adventure-destinations", portalSlug],
    queryFn: async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10_000);
      try {
        const res = await fetch(`/api/portals/${portalSlug}/yonder/destinations`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Destinations fetch failed: ${res.status}`);
        return res.json();
      } finally {
        clearTimeout(timeoutId);
      }
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Fetch weekend events from federated sources
  const { data: eventsData, isLoading: eventsLoading } = useQuery<{
    events: AdventureEventData[];
  }>({
    queryKey: ["adventure-events", portalSlug, "weekend"],
    queryFn: async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10_000);
      try {
        const res = await fetch(
          `/api/portals/${portalSlug}/yonder/events?window=weekend`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error(`Events fetch failed: ${res.status}`);
        return res.json();
      } finally {
        clearTimeout(timeoutId);
      }
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Fall back to next week if no weekend events
  const { data: weekEventsData } = useQuery<{
    events: AdventureEventData[];
  }>({
    queryKey: ["adventure-events", portalSlug, "week"],
    queryFn: async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10_000);
      try {
        const res = await fetch(
          `/api/portals/${portalSlug}/yonder/events?window=week`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error(`Events fetch failed: ${res.status}`);
        return res.json();
      } finally {
        clearTimeout(timeoutId);
      }
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled: !eventsLoading && (eventsData?.events?.length ?? 0) === 0,
  });

  const weekendEvents = eventsData?.events ?? [];
  const fallbackEvents = weekEventsData?.events ?? [];
  const displayEvents = weekendEvents.length > 0 ? weekendEvents : fallbackEvents;
  const eventsLabel =
    weekendEvents.length > 0 ? "This Weekend" : "Coming Up";

  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun, 6=Sat
  const isWeekendWindow = dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0; // Fri/Sat/Sun
  const weatherSignal = getWeatherSignal(weather.condition);

  // Filter to weekend + fullday tiers only
  const weekendDestinations = useMemo(() => {
    const all = data?.destinations ?? [];
    return all.filter(
      (d) => d.commitmentTier === "weekend" || d.commitmentTier === "fullday",
    );
  }, [data]);

  // Sort by conditions score
  const ranked = useMemo(
    () =>
      [...weekendDestinations].sort(
        (a, b) =>
          scoreDestinationForConditions(b, weatherSignal, isWeekendWindow, null) -
          scoreDestinationForConditions(a, weatherSignal, isWeekendWindow, null),
      ),
    [weekendDestinations, weatherSignal, isWeekendWindow],
  );

  const subtitle = getSubtitle(weatherSignal, isWeekendWindow);

  const sectionHeader = (
    <div className="flex items-start justify-between mb-4">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Calendar size={14} weight="bold" color={ADV.TERRACOTTA} />
          <span
            className="text-xs font-bold uppercase"
            style={{
              letterSpacing: "0.12em",
              color: ADV.TERRACOTTA,
            }}
          >
            Weekend Escapes
          </span>
        </div>
        <p
          className="text-sm"
          style={{ color: ADV.STONE }}
        >
          {subtitle}
        </p>
      </div>
    </div>
  );

  if (isLoading || weather.loading) {
    return (
      <div className="px-4 pb-10 pt-4 sm:px-0">
        {sectionHeader}
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div
              key={idx}
              className="h-64"
              style={{
                border: `2px solid ${ADV.DARK}`,
                borderRadius: 0,
                backgroundColor: `${ADV.STONE}12`,
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (ranked.length === 0) {
    return (
      <div className="px-4 pb-10 pt-4 sm:px-0">
        {sectionHeader}
        <div
          className="p-8 text-center"
          style={{ border: `2px solid ${ADV.DARK}`, borderRadius: 0, backgroundColor: ADV.CARD }}
        >
          <p
            className="text-sm font-bold uppercase"
            style={{
              letterSpacing: "0.1em",
              color: ADV.STONE,
            }}
          >
            No weekend destinations found
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pb-10 pt-4 sm:px-0">
      {/* ---- Events section ------------------------------------------------ */}
      {(eventsLoading || displayEvents.length > 0) && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <Lightning size={14} weight="bold" color={ADV.TERRACOTTA} />
            <span
              className="text-xs font-bold uppercase"
              style={{
                fontFamily: ADV_FONT,
                letterSpacing: "0.12em",
                color: ADV.TERRACOTTA,
              }}
            >
              {eventsLabel}
            </span>
            {!eventsLoading && (
              <span
                className="text-xs"
                style={{ color: ADV.STONE }}
              >
                — {displayEvents.length} outdoor events
              </span>
            )}
          </div>
          <p
            className="text-sm mb-4"
            style={{ color: ADV.STONE }}
          >
            Group hikes, nature programs, trail cleanups, and more
          </p>

          {eventsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <AdventureEventCardSkeleton key={i} />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {displayEvents.slice(0, 8).map((event) => (
                <AdventureEventCard
                  key={event.id}
                  id={event.id}
                  title={event.title}
                  startDate={event.startDate}
                  startTime={event.startTime}
                  isAllDay={event.isAllDay}
                  venueName={event.venueName}
                  venueSlug={event.venueSlug}
                  neighborhood={event.neighborhood}
                  sourceName={event.sourceName}
                  imageUrl={event.imageUrl}
                  venueImageUrl={event.venueImageUrl}
                  tags={event.tags}
                  sourceUrl={event.sourceUrl}
                  ticketUrl={event.ticketUrl}
                  portalSlug={portalSlug}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ---- Destinations section ------------------------------------------ */}
      {sectionHeader}

      {/* Weather signal badge */}
      {weatherSignal && !weather.loading && (
        <div className="mb-4 flex items-center gap-2">
          <span
            className="px-2.5 py-1 text-xs font-bold uppercase"
            style={{
              fontFamily: ADV_FONT,
              letterSpacing: "0.1em",
              border: `2px solid ${ADV.DARK}`,
              borderRadius: 0,
              backgroundColor: ADV.CARD,
              color: ADV.DARK,
            }}
          >
            {weather.emoji} {weather.temp}°F — {weather.condition}
          </span>
          <span
            className="text-xs"
            style={{ color: ADV.STONE }}
          >
            Ranking adjusted for conditions
          </span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {ranked.map((destination) => (
          <DestinationCard
            key={destination.slug}
            name={destination.name}
            slug={destination.slug}
            imageUrl={destination.imageUrl}
            commitmentTier={destination.commitmentTier}
            difficultyLevel={destination.difficultyLevel}
            driveTimeMinutes={destination.driveTimeMinutes}
            summary={destination.summary}
            weatherFitTags={destination.weatherFitTags}
            portalSlug={portalSlug}
            visited={isVisited(destination.slug)}
            onMarkVisited={markVisited}
          />
        ))}
      </div>
    </div>
  );
}
