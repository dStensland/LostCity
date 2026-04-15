"use client";

import Link from "next/link";
import { FilmSlate } from "@phosphor-icons/react";
import { formatTime } from "@/lib/formats";

// ── Types ────────────────────────────────────────────────────────────────

type Showtime = {
  time: string;
  event_id: number;
};

type Theater = {
  venue_name: string;
  venue_slug: string;
  neighborhood: string | null;
  showtimes: Showtime[];
  // Optional transit data — rendered if present, omitted if not
  nearest_marta_station?: string | null;
  marta_walk_minutes?: number | null;
  parking_type?: string[] | null;
  parking_free?: boolean | null;
};

export interface ShowtimesTheaterCardProps {
  theater: Theater;
  portalSlug: string;
  laneColor?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────

function formatParkingLabel(types: string[], isFree?: boolean | null): string {
  const labels: Record<string, string> = {
    lot: "Lot",
    deck: "Deck",
    garage: "Garage",
    valet: "Valet",
    street: "Street",
  };
  const primary = labels[types[0]] || types[0];
  if (isFree) return `Free ${primary.toLowerCase()}`;
  return primary;
}

// ── Component ────────────────────────────────────────────────────────────

export function ShowtimesTheaterCard({
  theater,
  portalSlug,
  laneColor,
}: ShowtimesTheaterCardProps) {
  const hasMarta =
    theater.nearest_marta_station &&
    theater.marta_walk_minutes != null &&
    theater.marta_walk_minutes <= 15;
  const hasParking =
    theater.parking_type && theater.parking_type.length > 0;
  const showTransit = hasMarta || hasParking;

  const borderStyle = laneColor
    ? { borderTopColor: laneColor }
    : { borderTopColor: "#A78BFA" };

  return (
    <div
      className="rounded-xl border border-[var(--twilight)] border-t-2 bg-[var(--card-bg,var(--night))] overflow-hidden"
      style={borderStyle}
    >
      {/* Header row */}
      <div className="flex items-center gap-2.5 px-4 pt-3 pb-2">
        <FilmSlate
          size={16}
          weight="duotone"
          className="flex-shrink-0"
          style={{ color: laneColor ?? "#A78BFA" }}
          aria-hidden="true"
        />
        <Link
          href={`/${portalSlug}?spot=${theater.venue_slug}`}
          className="font-semibold text-[var(--cream)] text-sm hover:text-[var(--coral)] transition-colors focus-ring truncate"
          scroll={false}
        >
          {theater.venue_name}
        </Link>
        <span className="flex-1" />
        {theater.neighborhood && (
          <span className="text-xs text-[var(--muted)] flex-shrink-0">
            {theater.neighborhood}
          </span>
        )}
      </div>

      {/* Showtime chips */}
      {theater.showtimes.length > 0 && (
        <div className="flex flex-wrap gap-2 px-4 pb-3">
          {theater.showtimes.map((st) => {
            const formatted = formatTime(st.time);
            if (!formatted || formatted === "TBA") return null;
            return (
              <Link
                key={st.event_id}
                href={`/${portalSlug}?event=${st.event_id}`}
                scroll={false}
                className="border border-[var(--coral)] rounded-[6px] px-3 py-1.5 font-mono text-xs font-medium text-[var(--coral)] hover:bg-[var(--coral)]/10 transition-colors focus-ring"
              >
                {formatted}
              </Link>
            );
          })}
        </div>
      )}

      {/* Optional transit meta */}
      {showTransit && (
        <div className="flex items-center gap-3 px-4 py-2 border-t border-[var(--twilight)]/50">
          {hasMarta && (
            <span className="inline-flex items-center gap-1.5 text-xs text-[var(--muted)] font-mono">
              <span className="font-bold text-[var(--neon-cyan,#00D4E8)]">MARTA</span>
              {theater.marta_walk_minutes}m walk
            </span>
          )}
          {hasParking && (
            <span className="inline-flex items-center gap-1.5 text-xs text-[var(--muted)] font-mono">
              <span className="font-bold text-[var(--gold)]">P</span>
              {formatParkingLabel(theater.parking_type!, theater.parking_free)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export type { Theater as ShowtimesTheater, Showtime };
