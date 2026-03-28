/**
 * Shared playbook constants, types, and helpers.
 * Client-safe — no server imports.
 *
 * Used by PlaybookEditor, SharedPlaybookView, and related components.
 */

import type { ItineraryItem, LocalItineraryItem } from "@/lib/itinerary-utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DangerLevel = "safe" | "warning" | "danger";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const ZONE_COLORS = {
  safe: { dot: "#00D9A0", bg: "rgba(0, 217, 160, 0.08)", border: "rgba(0, 217, 160, 0.2)", text: "#00D9A0" },
  warning: { dot: "#FFB800", bg: "rgba(255, 184, 0, 0.08)", border: "rgba(255, 184, 0, 0.25)", text: "#FFB800" },
  danger: { dot: "#FF3366", bg: "rgba(255, 51, 102, 0.08)", border: "rgba(255, 51, 102, 0.25)", text: "#FF3366" },
} as const;

export const ROUTE_GLOW_LAYER = {
  id: "route-glow",
  type: "line" as const,
  paint: { "line-color": "#00D4E8", "line-width": 8, "line-opacity": 0.06, "line-blur": 4 },
};

export const ROUTE_LINE_LAYER = {
  id: "route-line",
  type: "line" as const,
  paint: {
    "line-color": "#00D4E8",
    "line-width": 2,
    "line-dasharray": [3, 2] as [number, number],
    "line-opacity": 0.4,
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getDangerLevel(walkMinutes: number, bufferMinutes: number): DangerLevel {
  if (bufferMinutes >= 15) return "safe";
  if (bufferMinutes >= 5) return "warning";
  return "danger";
}

export function getBufferLabel(level: DangerLevel, bufferMinutes: number): string {
  if (level === "safe") return `${bufferMinutes} min buffer`;
  if (level === "warning") return `${bufferMinutes} min buffer — Cutting it close`;
  return "You might be late";
}

export function getItemCategory(item: ItineraryItem | LocalItineraryItem): string {
  if ("event" in item && item.event?.category) return item.event.category;
  if ("venue" in item && item.venue?.place_type) return item.venue.place_type;
  return "default";
}

// ---------------------------------------------------------------------------
// SVG Icons
// ---------------------------------------------------------------------------

export function WalkingPersonIcon({ size = 12, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" className={className} style={{ color: "inherit" }}>
      <path d="M7.875 1.75C8.358 1.75 8.75 1.358 8.75 0.875C8.75 0.392 8.358 0 7.875 0C7.392 0 7 0.392 7 0.875C7 1.358 7.392 1.75 7.875 1.75Z" fill="currentColor" />
      <path d="M9.625 4.375L7.875 2.625L5.25 5.25M7 7L5.25 10.5L6.5625 10.5M7 7L8.75 10.5L7.4375 10.5M7 7L7.875 5.25" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
