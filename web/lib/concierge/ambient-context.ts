/**
 * Ambient Context Builder
 *
 * Computes the ambient context layer (weather, daypart, greeting, quick actions)
 * that persists across all pillar switches.
 */

import type { AmbientContext } from "./concierge-types";
import type { WeatherData } from "@/lib/weather-utils";
import { getWeatherSignal, getWeatherModifiers, formatWeatherBadge } from "@/lib/weather-utils";
import { getDayPart, getDayPartGreeting, getQuickActions, HERO_PHOTOS_BY_DAYPART } from "@/lib/forth-data";

/**
 * Build the ambient context from current time and optional weather data.
 */
export function buildAmbientContext(
  now: Date,
  weather: WeatherData | null,
  portalName?: string
): AmbientContext {
  const dayPart = getDayPart(now);
  const greeting = getDayPartGreeting(dayPart, portalName);
  const quickActions = getQuickActions(dayPart);
  const heroPhoto = HERO_PHOTOS_BY_DAYPART[dayPart];
  const weatherSignal = weather ? getWeatherSignal(weather) : "default" as const;
  const weatherMods = getWeatherModifiers(weatherSignal);
  const weatherBadge = weather ? formatWeatherBadge(weather) : null;

  return {
    dayPart,
    greeting,
    quickActions,
    heroPhoto,
    hasWeather: weather !== null,
    weatherSignal,
    weatherModifiers: weatherMods,
    weatherBadge,
  };
}
