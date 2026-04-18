"use client";

/**
 * DoorsImminentTicker — Conditional banner above the Tonight zone sub-header.
 *
 * Per spec (`docs/design-specs/live-tonight-widget-{desktop,mobile}.md`):
 * - Renders ONLY when at least one show in the tonight payload has an
 *   effective start (doors_time || start_time) within the next 90 minutes
 *   AND current local time is < 21:00 (the ticker disappears at 9 PM —
 *   "doors imminent" stops being interesting once everything has opened).
 * - Gold pulsing dot + "Doors at {venue} in {minutes} min" text + "LIVE NOW"
 *   right-aligned in mono.
 * - Picks the SOONEST imminent show for messaging (single-line, single venue).
 *
 * Time recomputed every 60s via setInterval so the minute count stays fresh
 * without re-fetching data.
 */

import { useEffect, useMemo, useState } from "react";
import { buildSpotUrl } from "@/lib/entity-urls";
import type { TonightPayload } from "@/lib/music/types";

export interface DoorsImminentTickerProps {
  payload: TonightPayload;
  portalSlug: string;
  /** Test-only injection for deterministic time. Defaults to Date.now(). */
  nowProvider?: () => Date;
}

const WINDOW_MIN = 90;
const CUTOFF_HOUR = 21; // ticker disappears at 9 PM local

interface ImminentShow {
  venueName: string;
  venueSlug: string;
  minutesAway: number;
}

/** Parse "HH:mm" into a Date today; returns null if malformed. */
function timeToToday(t: string | null, base: Date): Date | null {
  if (!t) return null;
  const [hStr, mStr] = t.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const d = new Date(base);
  d.setHours(h, m, 0, 0);
  return d;
}

export function pickImminent(
  payload: TonightPayload,
  now: Date,
): ImminentShow | null {
  if (now.getHours() >= CUTOFF_HOUR) return null;

  const candidates: ImminentShow[] = [];
  for (const group of payload.tonight) {
    for (const show of group.shows) {
      const startStr = show.doors_time || show.start_time;
      const start = timeToToday(startStr, now);
      if (!start) continue;
      const diffMs = start.getTime() - now.getTime();
      const diffMin = Math.round(diffMs / 60_000);
      if (diffMin >= 0 && diffMin <= WINDOW_MIN) {
        candidates.push({
          venueName: group.venue.name,
          venueSlug: group.venue.slug,
          minutesAway: diffMin,
        });
      }
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.minutesAway - b.minutesAway);
  return candidates[0];
}

export function DoorsImminentTicker({
  payload,
  portalSlug,
  nowProvider,
}: DoorsImminentTickerProps) {
  const provider = useMemo(() => nowProvider ?? (() => new Date()), [nowProvider]);
  const [now, setNow] = useState<Date>(() => provider());

  useEffect(() => {
    if (nowProvider) return; // tests pass a fixed time; don't tick
    const id = setInterval(() => setNow(provider()), 60_000);
    return () => clearInterval(id);
  }, [nowProvider, provider]);

  const imminent = pickImminent(payload, now);
  if (!imminent) return null;

  const venueHref = buildSpotUrl(imminent.venueSlug, portalSlug, "feed");

  return (
    <div className="flex items-center justify-between gap-3 mt-4 mb-1">
      <div className="flex items-center gap-2 min-w-0">
        <span
          aria-hidden="true"
          className="inline-block w-2 h-2 sm:w-2 sm:h-2 rounded-full bg-[var(--gold)] motion-safe:animate-pulse shrink-0"
        />
        <span className="font-mono text-sm text-[var(--cream)] truncate">
          Doors at{" "}
          <a
            href={venueHref}
            className="text-[var(--cream)] hover:text-[var(--gold)] underline underline-offset-2 decoration-[var(--twilight)] hover:decoration-[var(--gold)] transition-colors"
          >
            {imminent.venueName}
          </a>{" "}
          in {imminent.minutesAway} min
        </span>
      </div>
      <span className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-[var(--gold)] shrink-0">
        LIVE NOW
      </span>
    </div>
  );
}

export default DoorsImminentTicker;
