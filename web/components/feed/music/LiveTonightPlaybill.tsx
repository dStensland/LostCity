"use client";

/**
 * LiveTonightPlaybill — Single-band cinema-style playbill of venues with
 * shows tonight (feed view).
 *
 * Density-fix posture: this is the FEED widget. It mirrors the cinema
 * widget's density rules — sub-header + N single-row venue entries +
 * footer link. No second sub-band. No editorial kickers. No ticker.
 *
 * - Sub-header: "TONIGHT · FRI APR 17 · N SHOWS" left + "X OF Y VENUES" right
 * - Up to 4 venue rows (hard cap; cinema-density). Footer link reveals the rest.
 * - Late-night data still flows in via payload.late_night, but the feed view
 *   does NOT render it. Late shows belong on /explore/music.
 * - No kickers in feed view (derive-kicker remains for explore-page use).
 */

import { VenueBlock } from "./VenueBlock";
import type { MusicShowPayload, MusicVenuePayload, TonightPayload } from "@/lib/music/types";

type VenueGroup = { venue: MusicVenuePayload; shows: MusicShowPayload[] };

const HARD_VENUE_CAP = 4;

function formatTonightDate(iso: string): string {
  // payload.date is YYYY-MM-DD; parse as local to avoid TZ shifts.
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date
    .toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
    .toUpperCase();
}

function totalShows(groups: VenueGroup[]): number {
  return groups.reduce((acc, g) => acc + g.shows.length, 0);
}

interface SubHeaderProps {
  left: string;
  right?: string;
}

function ZoneSubHeader({ left, right }: SubHeaderProps) {
  return (
    <div className="flex items-baseline justify-between pb-1.5 mb-1 border-b border-[var(--twilight)]">
      <span className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
        {left}
      </span>
      {right && (
        <span className="font-mono text-xs uppercase tracking-[0.12em] text-[var(--muted)] shrink-0">
          {right}
        </span>
      )}
    </div>
  );
}

export interface LiveTonightPlaybillProps {
  payload: TonightPayload;
  portalSlug: string;
}

export function LiveTonightPlaybill({ payload, portalSlug }: LiveTonightPlaybillProps) {
  // Feed view: tonight zone ONLY. Late-night data is preserved on the
  // payload but not surfaced here — it belongs on /explore/music.
  const tonightGroups = payload.tonight;
  const hasTonight = tonightGroups.length > 0;

  if (!hasTonight) {
    return (
      <a
        href={`/${portalSlug}/explore/music`}
        className="text-sm italic text-[var(--muted)] hover:text-[var(--cream)] py-3 inline-block transition-colors"
      >
        Quiet night — see residencies and what&apos;s coming up →
      </a>
    );
  }

  // Cap at 4 venue rows (cinema-density). Footer link reveals the rest.
  const visible = tonightGroups.slice(0, HARD_VENUE_CAP);
  const hidden = tonightGroups.length - visible.length;

  const tonightShowCount = totalShows(tonightGroups);
  const tonightVenueCount = tonightGroups.length;

  return (
    <div>
      <ZoneSubHeader
        left={`Tonight · ${formatTonightDate(payload.date)} · ${tonightShowCount} ${tonightShowCount === 1 ? "show" : "shows"}`}
        right={`${visible.length} of ${tonightVenueCount} venues`}
      />
      <div className="space-y-0.5">
        {visible.map(({ venue, shows }) => (
          <VenueBlock
            key={venue.id}
            venue={venue}
            shows={shows}
            portalSlug={portalSlug}
          />
        ))}
      </div>

      {hidden > 0 && (
        <a
          href={`/${portalSlug}/explore/music`}
          className="block mt-3 font-mono text-xs uppercase tracking-[0.12em] text-[var(--soft)] hover:text-[var(--cream)] transition-colors"
        >
          See all {tonightVenueCount} venues tonight →
        </a>
      )}

      {hidden === 0 && visible.length >= HARD_VENUE_CAP && (
        // Edge case: exactly at cap, nothing hidden — still surface the
        // explore link so users have a path forward.
        <a
          href={`/${portalSlug}/explore/music`}
          className="block mt-3 font-mono text-xs uppercase tracking-[0.12em] text-[var(--soft)] hover:text-[var(--cream)] transition-colors"
        >
          Browse all music tonight →
        </a>
      )}
    </div>
  );
}
