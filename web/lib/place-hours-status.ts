/**
 * Place hours status — derives open/closed state and next-open time.
 * Extends lib/hours.ts; does not duplicate its logic.
 */

import { isOpenAt } from "@/lib/hours";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PlaceHoursStatus =
  | { kind: "open"; closesAt: string }
  | { kind: "closing_soon"; closesAt: string }   // < 30 min until close
  | { kind: "closed"; opensAt: string | null; opensDayLabel: string | null }
  | { kind: "unknown" };                           // no hours data — render nothing

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DAY_NAMES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

type HoursRecord = Record<string, { open: string; close: string } | null>;

function isHoursRecord(value: unknown): value is HoursRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return -1;
  if (h < 0 || h > 23 || m < 0 || m > 59) return -1;
  return h * 60 + m;
}

/** Format "HH:MM" → "10:00 PM" / "11:30 AM" */
function formatTime12(hhmm: string): string {
  const mins = timeToMinutes(hhmm);
  if (mins < 0) return hhmm;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const period = h >= 12 ? "PM" : "AM";
  const displayH = h % 12 === 0 ? 12 : h % 12;
  return m === 0
    ? `${displayH}:00 ${period}`
    : `${displayH}:${m.toString().padStart(2, "0")} ${period}`;
}

/** Walk forward up to 7 days from `from` to find the next day with hours. */
function findNextOpenDay(
  hours: HoursRecord,
  from: Date,
): { opensAt: string; dayLabel: string } | null {
  for (let offset = 1; offset <= 7; offset++) {
    const candidate = new Date(from);
    candidate.setDate(candidate.getDate() + offset);
    const dayName = DAY_NAMES[candidate.getDay()];
    const dayHours = hours[dayName];
    if (dayHours?.open) {
      let dayLabel: string;
      if (offset === 1) {
        dayLabel = "tomorrow";
      } else {
        // Full weekday name, capitalised
        dayLabel = candidate.toLocaleDateString("en-US", { weekday: "long" });
      }
      return { opensAt: formatTime12(dayHours.open), dayLabel };
    }
  }
  return null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Derive open/closed status for a place given its hours record.
 *
 * `hours` is the raw value from `spot.hours` — a JSON object keyed by 3-letter
 * day abbreviation with `{ open: "HH:MM", close: "HH:MM" }` values, or null
 * entries for closed days.
 *
 * `now` defaults to the current time (injectable for testing).
 */
export function getPlaceHoursStatus(
  hours: Record<string, unknown> | null,
  now: Date = new Date(),
): PlaceHoursStatus {
  if (!hours || !isHoursRecord(hours)) {
    return { kind: "unknown" };
  }

  // Check if any day actually has hours data
  const hasAnyHours = Object.values(hours).some(
    (v) => v && typeof v === "object" && (v as Record<string, unknown>).open,
  );
  if (!hasAnyHours) {
    return { kind: "unknown" };
  }

  const { isOpen, closesAt } = isOpenAt(hours as Parameters<typeof isOpenAt>[0], now);

  if (isOpen && closesAt) {
    const currentMins =
      now.getHours() * 60 + now.getMinutes();
    const closeMins = timeToMinutes(closesAt);

    // "closing soon" = closes within 30 minutes
    if (closeMins >= 0 && closeMins - currentMins <= 30 && closeMins > currentMins) {
      return { kind: "closing_soon", closesAt: formatTime12(closesAt) };
    }

    // Handle overnight — close is past midnight
    if (closeMins >= 0 && closeMins < currentMins && closeMins < 6 * 60) {
      // overnight close — always open, not "closing soon" unless truly close
      const remainingMins = closeMins + 24 * 60 - currentMins;
      if (remainingMins <= 30) {
        return { kind: "closing_soon", closesAt: formatTime12(closesAt) };
      }
    }

    return { kind: "open", closesAt: formatTime12(closesAt) };
  }

  // Closed — find next open time
  const next = findNextOpenDay(hours as HoursRecord, now);
  if (next) {
    return {
      kind: "closed",
      opensAt: next.opensAt,
      opensDayLabel: next.dayLabel,
    };
  }

  // Closed but no upcoming open time found in the next 7 days
  return { kind: "closed", opensAt: null, opensDayLabel: null };
}
