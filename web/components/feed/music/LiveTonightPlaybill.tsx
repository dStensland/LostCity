"use client";

/**
 * LiveTonightPlaybill — Letterboard playbill of venues with shows tonight.
 *
 * Per spec (`docs/design-specs/live-tonight-widget-{desktop,mobile}.md`):
 * - Sub-header: "TONIGHT · FRI APR 17 · N SHOWS" left + "X OF Y VENUES" right
 * - Up to 6 venue blocks (hard cap). Footer link reveals the rest.
 * - Late-Night band rule:
 *     · 0 late shows  → no band rendered
 *     · 1 late venue  → merged as a "LATE · AFTER 9 PM" muted kicker on
 *                       that venue's block, no separate sub-band
 *     · 2+ late venues → separate sub-band with its own sub-header
 * - Each block uses VenueBlock, which is the link target (no caret arrows).
 */

import { VenueBlock } from "./VenueBlock";
import { deriveKicker, type KickerDescriptor } from "@/lib/music/derive-kicker";
import type { MusicShowPayload, MusicVenuePayload, TonightPayload } from "@/lib/music/types";

type VenueGroup = { venue: MusicVenuePayload; shows: MusicShowPayload[] };

const HARD_VENUE_CAP = 6;

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
    <div className="flex items-center justify-between gap-3 mt-4 pb-3 border-b border-[var(--twilight)]/40">
      <span className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-[var(--soft)]">
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

/**
 * Render N venue blocks. Each kicker is derived per-venue from its shows
 * (or overridden via the `kickerOverride` map — used to inject the LATE
 * kicker when we merge a single late venue into the tonight band).
 */
function renderBlocks(
  groups: VenueGroup[],
  portalSlug: string,
  kickerOverride: Map<number, KickerDescriptor> = new Map(),
) {
  return groups.map(({ venue, shows }) => {
    const override = kickerOverride.get(venue.id);
    const kicker = override ?? deriveKicker({ venue, shows });
    return (
      <VenueBlock
        key={venue.id}
        venue={venue}
        shows={shows}
        portalSlug={portalSlug}
        kicker={kicker}
      />
    );
  });
}

export function LiveTonightPlaybill({ payload, portalSlug }: LiveTonightPlaybillProps) {
  const tonightGroups = payload.tonight;
  const lateGroups = payload.late_night;
  const hasTonight = tonightGroups.length > 0;
  const hasLate = lateGroups.length > 0;

  if (!hasTonight && !hasLate) {
    return (
      <a
        href={`/${portalSlug}/explore/music`}
        className="text-sm italic text-[var(--muted)] hover:text-[var(--cream)] py-3 inline-block transition-colors"
      >
        Quiet night — see residencies and what&apos;s coming up →
      </a>
    );
  }

  // Late Night band rule. Per spec:
  //   - 1 late venue → merge into tonight as a kicker on that venue's block
  //   - 2+ late venues → separate band with its own sub-header
  const mergeLateAsKicker = lateGroups.length === 1 && hasTonight;
  let mergedTonight = tonightGroups;
  const kickerOverride = new Map<number, KickerDescriptor>();
  if (mergeLateAsKicker) {
    const lateGroup = lateGroups[0];
    // If the late venue also has tonight shows, merge into its existing block.
    // Otherwise append the late venue as its own block in the tonight zone.
    const existing = tonightGroups.find((g) => g.venue.id === lateGroup.venue.id);
    if (existing) {
      mergedTonight = tonightGroups.map((g) =>
        g.venue.id === lateGroup.venue.id
          ? { ...g, shows: [...g.shows, ...lateGroup.shows] }
          : g,
      );
    } else {
      mergedTonight = [...tonightGroups, lateGroup];
    }
    kickerOverride.set(lateGroup.venue.id, { label: "LATE · AFTER 9 PM", tone: "muted" });
  }

  // Cap at 6 venue blocks. Footer link reveals the rest.
  const tonightVisible = mergedTonight.slice(0, HARD_VENUE_CAP);
  const tonightHidden = mergedTonight.length - tonightVisible.length;

  // Total counts for the sub-header right-side text
  const tonightShowCount = totalShows(mergedTonight);
  const tonightVenueCount = mergedTonight.length;

  // Show separate Late band ONLY if we did NOT merge (i.e. 2+ late venues).
  const showSeparateLateBand = !mergeLateAsKicker && hasLate;
  const lateVisible = showSeparateLateBand ? lateGroups.slice(0, HARD_VENUE_CAP) : [];
  const lateHidden = showSeparateLateBand ? lateGroups.length - lateVisible.length : 0;

  // Aggregate footer counts: total venues across both zones (post-merge)
  const totalVenues = tonightVenueCount + (showSeparateLateBand ? lateGroups.length : 0);
  const visibleVenues = tonightVisible.length + lateVisible.length;
  const totalHidden = tonightHidden + lateHidden;

  return (
    <div>
      {hasTonight && (
        <>
          <ZoneSubHeader
            left={`Tonight · ${formatTonightDate(payload.date)} · ${tonightShowCount} ${tonightShowCount === 1 ? "show" : "shows"}`}
            right={`${tonightVisible.length} of ${tonightVenueCount} venues`}
          />
          <div>{renderBlocks(tonightVisible, portalSlug, kickerOverride)}</div>
        </>
      )}

      {showSeparateLateBand && (
        <>
          <ZoneSubHeader
            left="Late · After 9 PM"
            right={`${lateVisible.length} of ${lateGroups.length} venues`}
          />
          <div>{renderBlocks(lateVisible, portalSlug)}</div>
        </>
      )}

      {totalHidden > 0 && (
        <a
          href={`/${portalSlug}/explore/music`}
          className="block mt-4 font-mono text-xs uppercase tracking-[0.12em] text-[var(--soft)] hover:text-[var(--cream)] transition-colors"
        >
          See all {totalVenues} venues tonight →
        </a>
      )}

      {totalHidden === 0 && visibleVenues >= HARD_VENUE_CAP && (
        // Edge case: exactly at cap, nothing hidden — still surface the
        // explore link so users have a path forward.
        <a
          href={`/${portalSlug}/explore/music`}
          className="block mt-4 font-mono text-xs uppercase tracking-[0.12em] text-[var(--soft)] hover:text-[var(--cream)] transition-colors"
        >
          Browse all music tonight →
        </a>
      )}
    </div>
  );
}
