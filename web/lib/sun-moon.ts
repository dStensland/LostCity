import * as suncalc from "suncalc";

// Atlanta, GA
const ATLANTA_LAT = 33.749;
const ATLANTA_LNG = -84.388;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MoonPhaseInfo {
  phase: number;
  label: string;
  emoji: string;
  /** True only for Full Moon and New Moon (±0.03 of 0 or 0.5). */
  isNotable: boolean;
}

export interface SunMoonData {
  sunset: string;
  sunrise: string;
  moonPhase: MoonPhaseInfo;
}

// ---------------------------------------------------------------------------
// formatTime12h
// ---------------------------------------------------------------------------

/**
 * Formats a Date into 12-hour time with no leading zero on the hour.
 * Examples: "7:41 PM", "12:00 PM", "12:30 AM"
 */
export function formatTime12h(date: Date): string {
  const h = date.getHours();
  const m = date.getMinutes();
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  if (m === 0) return `${hour12}:00 ${period}`;
  return `${hour12}:${m.toString().padStart(2, "0")} ${period}`;
}

// ---------------------------------------------------------------------------
// getMoonPhaseLabel
// ---------------------------------------------------------------------------

/**
 * Maps a suncalc phase value (0–1) to a human-readable label.
 *
 * Phase convention (suncalc):
 *   0       = New Moon
 *   0–0.25  = Waxing Crescent
 *   0.25    = First Quarter
 *   0.25–0.5= Waxing Gibbous
 *   0.5     = Full Moon
 *   0.5–0.75= Waning Gibbous
 *   0.75    = Last Quarter
 *   0.75–1  = Waning Crescent
 */
export function getMoonPhaseLabel(phase: number): string {
  if (phase <= 0.03 || phase >= 0.97) return "New Moon";
  if (phase < 0.22) return "Waxing Crescent";
  if (phase <= 0.28) return "First Quarter";
  if (phase < 0.47) return "Waxing Gibbous";
  if (phase <= 0.53) return "Full Moon";
  if (phase < 0.72) return "Waning Gibbous";
  if (phase <= 0.78) return "Last Quarter";
  return "Waning Crescent";
}

// ---------------------------------------------------------------------------
// getMoonEmoji
// ---------------------------------------------------------------------------

function getMoonEmoji(phase: number): string {
  if (phase <= 0.03 || phase >= 0.97) return "🌑";
  if (phase < 0.22) return "🌒";
  if (phase <= 0.28) return "🌓";
  if (phase < 0.47) return "🌔";
  if (phase <= 0.53) return "🌕";
  if (phase < 0.72) return "🌖";
  if (phase <= 0.78) return "🌗";
  return "🌘";
}

// ---------------------------------------------------------------------------
// getSunMoonData
// ---------------------------------------------------------------------------

/**
 * Returns sunset time, sunrise time, and moon phase data for Atlanta.
 *
 * All times are formatted as "7:41 PM" (local, no leading zero on hour).
 * Pass an explicit `date` for testing; omit for the current date.
 */
export function getSunMoonData(date?: Date): SunMoonData {
  const d = date ?? new Date();
  const times = suncalc.getTimes(d, ATLANTA_LAT, ATLANTA_LNG);
  const moon = suncalc.getMoonIllumination(d);

  const phase = moon.phase;
  const isNotable =
    (phase <= 0.03 || phase >= 0.97) ||  // New Moon
    (phase >= 0.47 && phase <= 0.53);     // Full Moon

  return {
    sunrise: formatTime12h(times.sunrise),
    sunset: formatTime12h(times.sunset),
    moonPhase: {
      phase,
      label: getMoonPhaseLabel(phase),
      emoji: getMoonEmoji(phase),
      isNotable,
    },
  };
}
