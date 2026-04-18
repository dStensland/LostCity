"use client";

import { LiveTonightPlaybillRow } from "./LiveTonightPlaybillRow";
import type { MusicShowPayload, MusicVenuePayload, TonightPayload } from "@/lib/music/types";

export interface LiveTonightPlaybillProps {
  payload: TonightPayload;
  portalSlug: string;
  onShowTap: (show: MusicShowPayload) => void;
}

function BandHeader({ label }: { label: string }) {
  return (
    <div className="font-mono text-xs font-bold tracking-[0.12em] uppercase text-[var(--gold)] mb-2">
      {label}
    </div>
  );
}

function renderGroups(
  groups: { venue: MusicVenuePayload; shows: MusicShowPayload[] }[],
  portalSlug: string,
  onShowTap: (show: MusicShowPayload) => void,
) {
  return groups.map(({ venue, shows }) => (
    <LiveTonightPlaybillRow
      key={venue.id}
      venueName={venue.name}
      venueSlug={venue.slug}
      portalSlug={portalSlug}
      shows={shows}
      onShowTap={onShowTap}
    />
  ));
}

export function LiveTonightPlaybill({ payload, portalSlug, onShowTap }: LiveTonightPlaybillProps) {
  const hasTonight = payload.tonight.length > 0;
  const hasLate = payload.late_night.length > 0;

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

  return (
    <div>
      {hasTonight && (
        <div>
          <BandHeader label={`Tonight · ${payload.date}`} />
          <div>{renderGroups(payload.tonight, portalSlug, onShowTap)}</div>
        </div>
      )}
      {hasLate && (
        <div className={hasTonight ? "mt-4" : ""}>
          <BandHeader label="Late Night" />
          <div>{renderGroups(payload.late_night, portalSlug, onShowTap)}</div>
        </div>
      )}
    </div>
  );
}
