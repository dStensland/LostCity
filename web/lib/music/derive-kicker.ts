/**
 * derive-kicker — Editorial kicker derivation for Live Tonight venue blocks.
 *
 * Per spec (`docs/design-specs/live-tonight-widget-desktop.md` §Implementation hints):
 * Editorial kickers are EARNED — most venue blocks have NONE. One kicker per
 * block max. v1 ships with data-derivable kickers only:
 *
 *   - SOLD OUT TONIGHT  (coral) — every show at this venue tonight is sold-out
 *   - FREE TONIGHT       (gold)  — every show at this venue is free
 *   - LATE · AFTER 9 PM  (muted) — earliest effective start ≥ 21:00
 *   - RESIDENCY NIGHT    (vibe)  — any show at this venue carries a residency tag
 *
 * v2 may add editorial-text-derived kickers (FAREWELL TOUR, FIRST US DATE)
 * once those are materialized as discrete fields rather than blurb text.
 *
 * Pure function — no side effects, no DB calls. Consumed by LiveTonightPlaybill.
 */

import type { MusicShowPayload, MusicVenuePayload } from "./types";

export type KickerTone = "vibe" | "gold" | "coral" | "muted";

export interface KickerDescriptor {
  label: string;
  tone: KickerTone;
}

/** Lexicographic compare on "HH:mm" — same convention as tonight-loader.effectiveStart. */
function effectiveStart(show: MusicShowPayload): string {
  return show.doors_time || show.start_time || "00:00";
}

function isResidencyShow(show: MusicShowPayload): boolean {
  // tags is the closest data signal we have — residency series typically
  // surface a "residency" tag on each occurrence row. No new field needed.
  return show.tags.some((t) => t.toLowerCase().includes("residency"));
}

export interface DeriveKickerInput {
  venue: MusicVenuePayload;
  shows: MusicShowPayload[];
}

/**
 * Returns the single highest-priority kicker this venue block has earned.
 * Returns null when no kicker is earned — caller MUST suppress the kicker
 * DOM element entirely (don't render an empty span).
 *
 * Priority order (only one wins):
 *   1. SOLD OUT — strongest urgency signal
 *   2. RESIDENCY — strongest editorial signal
 *   3. FREE — affordability hook
 *   4. LATE — informational; lowest priority
 */
export function deriveKicker({
  venue: _venue,
  shows,
}: DeriveKickerInput): KickerDescriptor | null {
  if (shows.length === 0) return null;

  const allSoldOut = shows.every((s) => s.ticket_status === "sold-out");
  if (allSoldOut) return { label: "SOLD OUT TONIGHT", tone: "coral" };

  if (shows.some(isResidencyShow)) {
    return { label: "RESIDENCY NIGHT", tone: "vibe" };
  }

  const allFree = shows.every((s) => s.is_free);
  if (allFree) return { label: "FREE TONIGHT", tone: "gold" };

  const earliest = shows
    .map(effectiveStart)
    .reduce((min, t) => (t < min ? t : min), "23:59");
  if (earliest >= "21:00") {
    return { label: "LATE · AFTER 9 PM", tone: "muted" };
  }

  return null;
}
