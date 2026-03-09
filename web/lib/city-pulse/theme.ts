/**
 * CityPulse feed theme — CSS custom properties driven by context.
 *
 * Instead of per-component `if (timeSlot === 'evening')` branches,
 * components reference CSS vars like `var(--pulse-accent)`.
 * This module builds those vars from the feed context.
 */

import type { FeedContext, TimeSlot } from "./types";

// ---------------------------------------------------------------------------
// Time-slot base palettes
// ---------------------------------------------------------------------------

const SLOT_PALETTES: Record<TimeSlot, { accent: string; glow: string; bg: string }> = {
  morning:    { accent: "var(--gold)",         glow: "rgba(255, 217, 61, 0.12)",  bg: "rgba(255, 217, 61, 0.04)" },
  midday:     { accent: "var(--coral)",        glow: "rgba(255, 107, 122, 0.12)", bg: "rgba(255, 107, 122, 0.04)" },
  happy_hour: { accent: "var(--neon-amber)",   glow: "rgba(245, 166, 35, 0.12)",  bg: "rgba(245, 166, 35, 0.04)" },
  evening:    { accent: "var(--neon-magenta)", glow: "rgba(232, 85, 160, 0.12)",  bg: "rgba(232, 85, 160, 0.04)" },
  late_night: { accent: "var(--neon-cyan, #00d4ff)", glow: "rgba(0, 212, 255, 0.12)",  bg: "rgba(0, 212, 255, 0.04)" },
};

// ---------------------------------------------------------------------------
// Weather modifiers
// ---------------------------------------------------------------------------

function adjustForWeather(
  palette: { accent: string; glow: string; bg: string },
  weatherSignal?: string,
): { accent: string; glow: string; bg: string } {
  if (weatherSignal === "rain") {
    // Shift cooler — use a muted blue-teal
    return {
      accent: "var(--neon-cyan, #00d4ff)",
      glow: "rgba(0, 212, 255, 0.10)",
      bg: "rgba(0, 212, 255, 0.03)",
    };
  }
  return palette;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getFeedThemeVars(
  context: FeedContext,
  portalSlug?: string,
  options?: { isLightTheme?: boolean },
): Record<string, string> {
  // Light-mode portals: static accent from action-primary
  // (time-of-day neon shifts don't apply to light themes)
  if (options?.isLightTheme) {
    return {
      "--pulse-accent": "var(--action-primary)",
      "--pulse-glow": "rgba(15, 118, 110, 0.10)",
      "--pulse-bg": "rgba(15, 118, 110, 0.04)",
    };
  }

  let palette = SLOT_PALETTES[context.time_slot] ?? SLOT_PALETTES.evening;
  palette = adjustForWeather(palette, context.weather_signal);

  // Holiday overrides accent color
  if (context.active_holidays.length > 0) {
    const holidayAccent = context.active_holidays[0].accent_color;
    palette = { ...palette, accent: holidayAccent };
  }

  return {
    "--pulse-accent": palette.accent,
    "--pulse-glow": palette.glow,
    "--pulse-bg": palette.bg,
  };
}
