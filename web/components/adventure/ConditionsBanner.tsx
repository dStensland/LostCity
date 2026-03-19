"use client";

import { ADV, ADV_FONT } from "@/lib/adventure-tokens";
import { getAdventureAssessment } from "@/lib/adventure-weather-utils";
import {
  Sun,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CloudSun,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";

export interface ConditionsBannerProps {
  temp: number;
  condition: string;
  emoji: string;
  windSpeed: number;
  humidity: number;
}

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

export function ConditionsBanner({ temp, condition, windSpeed, humidity }: ConditionsBannerProps) {
  if (!condition) return null;

  const assessment = getAdventureAssessment(temp, condition, windSpeed);
  const WeatherIcon = getWeatherIcon(condition);

  return (
    <div
      className="w-full flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-4 mb-6"
      style={{
        backgroundColor: ADV.DARK,
        borderRadius: 0,
        fontFamily: ADV_FONT,
      }}
    >
      {/* Left: icon + temp */}
      <div className="flex items-center gap-2">
        <WeatherIcon size={28} weight="bold" color={ADV.CREAM} />
        <span
          className="text-xl font-bold leading-none"
          style={{ color: ADV.CREAM }}
        >
          {temp}°F
        </span>
      </div>

      {/* Center: assessment */}
      <span
        className="text-sm font-medium"
        style={{ color: ADV.CREAM }}
      >
        {assessment}
      </span>

      {/* Right: wind + humidity stats with micro-labels */}
      <div className="flex items-center gap-4 ml-auto">
        {windSpeed > 0 && (
          <span
            className="text-xs font-bold uppercase"
            style={{ letterSpacing: "0.08em", color: "rgba(245,242,237,0.7)" }}
          >
            WIND {windSpeed} MPH
          </span>
        )}
        {humidity > 0 && (
          <span
            className="text-xs font-bold uppercase"
            style={{ letterSpacing: "0.08em", color: "rgba(245,242,237,0.7)" }}
          >
            HUM {humidity}%
          </span>
        )}
      </div>
    </div>
  );
}
