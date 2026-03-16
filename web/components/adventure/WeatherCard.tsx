"use client";

import { memo } from "react";
import { ADV } from "@/lib/adventure-tokens";

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

// ---- Helpers -------------------------------------------------------------

function getAdventureAssessment(temp: number, condition: string, windSpeed: number): string {
  const lower = condition.toLowerCase();
  if (lower.includes("thunder") || lower.includes("storm")) return "Stay close to town";
  if (lower.includes("rain") || lower.includes("shower")) return "Waterfall conditions";
  if (lower.includes("snow") || lower.includes("freez")) return "Cold-weather trails";
  if (temp >= 95) return "Early starts only";
  if (temp >= 85 && windSpeed < 5) return "Hot — seek shade and water";
  if (temp >= 70 && temp <= 85 && (lower.includes("clear") || lower.includes("sunny"))) return "Great day for a hike";
  if (temp >= 50 && temp <= 70) return "Perfect trail conditions";
  if (temp < 40) return "Bundle up out there";
  if (windSpeed > 20) return "Windy — avoid exposed ridges";
  return "Decent conditions";
}

// ---- Component -----------------------------------------------------------

export const WeatherCard = memo(function WeatherCard({
  temp,
  condition,
  emoji,
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

  return (
    <div
      style={{
        border: `2px solid ${ADV.DARK}`,
        borderRadius: 0,
        backgroundColor: ADV.CARD,
      }}
    >
      {/* Main temp + condition + emoji */}
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
        <div
          className="text-5xl leading-none select-none"
          aria-label={condition}
          role="img"
        >
          {emoji}
        </div>
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
