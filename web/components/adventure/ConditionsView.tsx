"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { CloudSun } from "@phosphor-icons/react";
import { WeatherCard } from "./WeatherCard";
import { DestinationCard } from "./DestinationCard";
import { SectionHeader } from "./SectionHeader";
import { useAdventureProgress } from "@/lib/hooks/useAdventureProgress";
import { useWeather } from "@/lib/hooks/useWeather";
import type { YonderDestinationIntelligence, YonderSeason } from "@/config/yonder-destination-intelligence";
import { ADV } from "@/lib/adventure-tokens";

// ---- Types ---------------------------------------------------------------

export interface ConditionsViewProps {
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

// ---- Helpers -------------------------------------------------------------

function getCurrentSeason(): YonderSeason {
  const month = new Date().getMonth(); // 0-11
  if (month >= 2 && month <= 4) return "spring";
  if (month >= 5 && month <= 7) return "summer";
  if (month >= 8 && month <= 10) return "fall";
  return "winter";
}

function getWeatherFitTagsForCondition(condition: string): string[] {
  const lower = condition.toLowerCase();
  if (lower.includes("clear") || lower.includes("sunny")) return ["clear-day", "sunrise-friendly"];
  if (lower.includes("rain") || lower.includes("shower") || lower.includes("drizzle")) return ["after-rain"];
  if (lower.includes("thunder") || lower.includes("storm")) return ["after-rain"];
  if (lower.includes("snow") || lower.includes("freez")) return ["cool-weather"];
  if (lower.includes("cloudy")) return ["all-season"];
  return ["all-season"];
}

function conditionDescription(condition: string, temp: number): string {
  const lower = condition.toLowerCase();
  if (lower.includes("thunder") || lower.includes("storm")) {
    return "Storms in the forecast — stick to covered destinations or plan for after conditions clear.";
  }
  if (lower.includes("rain") || lower.includes("drizzle") || lower.includes("shower")) {
    return "Wet conditions favor waterfall hikes and destinations with natural water context.";
  }
  if (lower.includes("snow") || lower.includes("freez")) {
    return "Cold-weather window — great for cool-weather trails with low foot traffic.";
  }
  if (temp >= 90) {
    return "Heat advisory conditions — prioritize water-adjacent destinations and early starts.";
  }
  if (lower.includes("clear") || lower.includes("sunny")) {
    return "Clear conditions — full visibility for summit views and exposed destinations.";
  }
  return "Mixed conditions — check trail-specific forecasts before heading out.";
}

// ---- Section header subcomponent -----------------------------------------

function SubsectionLabel({ label }: { label: string }) {
  return (
    <div
      className="py-2 px-0 mb-3 text-xs font-bold uppercase border-b"
      style={{
        letterSpacing: "0.12em",
        color: ADV.STONE,
        borderBottomColor: `${ADV.DARK}20`,
      }}
    >
      {label}
    </div>
  );
}

// ---- Main component ------------------------------------------------------

export function ConditionsView({ portalSlug }: ConditionsViewProps) {
  const weather = useWeather();
  const { isVisited, markVisited } = useAdventureProgress();

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

  const currentSeason = getCurrentSeason();
  const destinations = useMemo(() => data?.destinations ?? [], [data?.destinations]);

  // Weather-matched destinations
  const weatherMatchedTags = useMemo(
    () => (weather.condition ? getWeatherFitTagsForCondition(weather.condition) : []),
    [weather.condition],
  );

  const weatherFitDestinations = useMemo(() => {
    if (!weatherMatchedTags.length || !destinations.length) return [];
    return destinations
      .filter((d) =>
        d.weatherFitTags.some((tag) => weatherMatchedTags.includes(tag)) ||
        d.weatherFitTags.includes("all-season"),
      )
      .slice(0, 6);
  }, [destinations, weatherMatchedTags]);

  // Season-matched destinations
  const seasonDestinations = useMemo(() => {
    if (!destinations.length) return [];
    return destinations
      .filter((d) => d.bestSeasons.includes(currentSeason))
      .slice(0, 4);
  }, [destinations, currentSeason]);

  const SEASON_LABELS: Record<YonderSeason, string> = {
    spring: "Spring",
    summer: "Summer",
    fall: "Fall",
    winter: "Winter",
  };

  const sectionHeader = <SectionHeader label="Conditions" icon={CloudSun} />;

  return (
    <div className="px-4 pb-10 pt-4 sm:px-0 space-y-6">
      {sectionHeader}

      {/* Current weather */}
      <div>
        <SubsectionLabel label="Current Conditions" />
        <WeatherCard
          temp={weather.temp}
          condition={weather.condition}
          emoji={weather.emoji}
          loading={weather.loading}
          windSpeed={weather.windSpeed}
          humidity={weather.humidity}
          uvIndex={weather.uvIndex}
        />

        {/* Condition description */}
        {!weather.loading && weather.condition && (
          <div
            className="mt-0 px-4 py-3"
            style={{
              border: `2px solid ${ADV.DARK}`,
              borderTop: "none",
              borderRadius: 0,
              backgroundColor: `${ADV.DARK}04`,
            }}
          >
            <p
              className="text-sm leading-relaxed"
              style={{ color: ADV.STONE }}
            >
              {conditionDescription(weather.condition, weather.temp)}
            </p>
          </div>
        )}
      </div>

      {/* Seasonal intelligence */}
      <div>
        <SubsectionLabel label={`${SEASON_LABELS[currentSeason]} Picks`} />
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div
                key={idx}
                className="h-52"
                style={{
                  border: `2px solid ${ADV.DARK}`,
                  borderRadius: 0,
                  backgroundColor: `${ADV.STONE}12`,
                }}
              />
            ))}
          </div>
        ) : seasonDestinations.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {seasonDestinations.map((destination) => (
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
        ) : (
          <div
            className="p-5 text-center"
            style={{ border: `2px solid ${ADV.DARK}`, borderRadius: 0, backgroundColor: ADV.CARD }}
          >
            <p className="text-sm" style={{ color: ADV.STONE }}>
              No destinations tagged for {SEASON_LABELS[currentSeason].toLowerCase()} yet.
            </p>
          </div>
        )}
      </div>

      {/* Weather-fit recommendations */}
      {!weather.loading && weather.condition && (
        <div>
          <SubsectionLabel label={`Good For: ${weather.condition}`} />
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 2 }).map((_, idx) => (
                <div
                  key={idx}
                  className="h-52"
                  style={{
                    border: `2px solid ${ADV.DARK}`,
                    borderRadius: 0,
                    backgroundColor: `${ADV.STONE}12`,
                  }}
                />
              ))}
            </div>
          ) : weatherFitDestinations.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {weatherFitDestinations.slice(0, 4).map((destination) => (
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
          ) : null}
        </div>
      )}

</div>
  );
}
