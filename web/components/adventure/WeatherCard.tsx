"use client";

import { memo } from "react";
import {
  Sun,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CloudSun,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { ADV } from "@/lib/adventure-tokens";
import { getAdventureAssessment } from "@/lib/adventure-weather-utils";

// ---- Types ---------------------------------------------------------------

export interface WeatherCardProps {
  temp: number;
  condition: string;
  emoji: string;
  loading: boolean;
  windSpeed?: number;
  humidity?: number;
  uvIndex?: number;
}

// ---- Icon mapping --------------------------------------------------------

function getWeatherIcon(condition: string): Icon {
  const c = condition.toLowerCase();
  if (c.includes("thunder") || c.includes("lightning") || c.includes("storm")) {
    return CloudLightning;
  }
  if (c.includes("snow") || c.includes("flurr") || c.includes("blizzard") || c.includes("sleet") || c.includes("hail") || c.includes("freez")) {
    return CloudSnow;
  }
  if (c.includes("rain") || c.includes("drizzle") || c.includes("shower") || c.includes("precip")) {
    return CloudRain;
  }
  if (c.includes("partly") || c.includes("mostly cloudy") || c.includes("overcast") || c.includes("broken")) {
    return CloudSun;
  }
  if (c.includes("cloud") || c.includes("fog") || c.includes("mist") || c.includes("haze") || c.includes("smoke")) {
    return Cloud;
  }
  return Sun;
}

// ---- Component -----------------------------------------------------------

export const WeatherCard = memo(function WeatherCard({
  temp,
  condition,
  loading,
  windSpeed = 0,
  humidity = 0,
  uvIndex = 0,
}: WeatherCardProps) {
  if (loading) {
    return (
      <div
        style={{
          border: `2px solid ${ADV.DARK}`,
          borderRadius: 0,
          backgroundColor: ADV.CARD,
        }}
      >
        <div className="p-5">
          <div
            className="h-12 w-28"
            style={{ backgroundColor: `${ADV.STONE}22`, borderRadius: 0 }}
          />
          <div
            className="mt-2 h-4 w-20"
            style={{ backgroundColor: `${ADV.STONE}22`, borderRadius: 0 }}
          />
        </div>
      </div>
    );
  }

  if (!condition) return null;

  const WeatherIcon = getWeatherIcon(condition);

  return (
    <div
      style={{
        border: `2px solid ${ADV.DARK}`,
        borderRadius: 0,
        backgroundColor: ADV.CARD,
      }}
    >
      {/* Main temp + condition + icon */}
      <div className="flex items-center justify-between p-5">
        <div>
          <div
            className="font-bold leading-none"
            style={{
              fontSize: "3rem",
              color: ADV.DARK,
            }}
          >
            {temp}°F
          </div>
          <div
            className="mt-1.5 text-sm font-medium uppercase"
            style={{
              letterSpacing: "0.1em",
              color: ADV.STONE,
            }}
          >
            {condition}
          </div>
        </div>
        <WeatherIcon
          size={48}
          weight="bold"
          color={ADV.STONE}
          aria-label={condition}
        />
      </div>

      {/* Secondary stats */}
      <div
        className="flex items-center gap-4 px-5 py-2.5"
        style={{
          borderTop: `2px solid ${ADV.DARK}`,
          backgroundColor: ADV.CARD,
        }}
      >
        {windSpeed > 0 && (
          <div className="text-xs font-bold uppercase" style={{ letterSpacing: "0.08em", color: ADV.STONE }}>
            {windSpeed} MPH WIND
          </div>
        )}
        {humidity > 0 && (
          <div className="text-xs font-bold uppercase" style={{ letterSpacing: "0.08em", color: ADV.STONE }}>
            {humidity}% HUMIDITY
          </div>
        )}
        {uvIndex > 0 && (
          <div className="text-xs font-bold uppercase" style={{ letterSpacing: "0.08em", color: uvIndex >= 6 ? ADV.TERRACOTTA : ADV.STONE }}>
            UV {uvIndex}
          </div>
        )}
      </div>

      {/* Adventure assessment */}
      <div
        className="px-5 py-2.5"
        style={{
          borderTop: `2px solid ${ADV.DARK}`,
          backgroundColor: `${ADV.TERRACOTTA}08`,
        }}
      >
        <p className="text-sm font-bold" style={{ color: ADV.DARK }}>
          {getAdventureAssessment(temp, condition, windSpeed)}
        </p>
      </div>
    </div>
  );
});
