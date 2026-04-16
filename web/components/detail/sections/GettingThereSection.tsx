"use client";

import { Train, Car, Path } from "@phosphor-icons/react";
import type { SectionProps } from "@/lib/detail/types";

// ─── Transit data shape ───────────────────────────────────────────────────────

type TransitFields = {
  address?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  nearest_marta_station?: string | null;
  marta_walk_minutes?: number | null;
  beltline_adjacent?: boolean | null;
  beltline_segment?: string | null;
  parking_type?: string[] | null;
  parking_free?: boolean | null;
  parking_note?: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAddress(fields: TransitFields): string | null {
  const parts: string[] = [];
  if (fields.address) parts.push(fields.address);
  const cityLine = [fields.neighborhood ?? fields.city, fields.state]
    .filter(Boolean)
    .join(", ");
  if (cityLine) parts.push(cityLine);
  return parts.length > 0 ? parts.join("\n") : null;
}

function buildParkingLabel(fields: TransitFields): string | null {
  const types = fields.parking_type;
  if (!types || types.length === 0) return null;

  const labels: Record<string, string> = {
    lot: "lot parking",
    deck: "deck parking",
    garage: "garage parking",
    valet: "valet",
    street: "street parking",
  };

  const formatted = types.map((t) => labels[t] ?? t).join(" · ");
  return fields.parking_free ? `Free ${formatted}` : formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function buildMartaLabel(fields: TransitFields): string | null {
  if (!fields.nearest_marta_station || !fields.marta_walk_minutes) return null;
  if (fields.marta_walk_minutes > 15) return null;
  return `${fields.nearest_marta_station} · ${fields.marta_walk_minutes} min walk`;
}

function buildBeltLineLabel(fields: TransitFields): string | null {
  if (!fields.beltline_adjacent) return null;
  if (fields.beltline_segment) return `BeltLine adjacent · ${fields.beltline_segment}`;
  return "BeltLine adjacent";
}

function extractTransitFields(data: SectionProps["data"]): TransitFields | null {
  switch (data.entityType) {
    case "event": {
      const venue = data.payload.event.venue;
      if (!venue) return null;
      return venue;
    }
    case "place": {
      const spot = data.payload.spot as TransitFields;
      return spot;
    }
    case "series": {
      const showtimes = data.payload.venueShowtimes;
      if (showtimes?.length === 1 && showtimes[0].venue) {
        return showtimes[0].venue as TransitFields;
      }
      return null;
    }
    default:
      return null;
  }
}

function hasAnyContent(fields: TransitFields): boolean {
  const address = formatAddress(fields);
  const marta = buildMartaLabel(fields);
  const parking = buildParkingLabel(fields);
  const beltLine = buildBeltLineLabel(fields);
  return Boolean(address || marta || parking || beltLine);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GettingThereSection({ data }: SectionProps) {
  const fields = extractTransitFields(data);
  if (!fields) return null;
  if (!hasAnyContent(fields)) return null;

  const address = formatAddress(fields);
  const martaLabel = buildMartaLabel(fields);
  const parkingLabel = buildParkingLabel(fields);
  const beltLineLabel = buildBeltLineLabel(fields);

  const hasTransitRows = Boolean(martaLabel || parkingLabel || beltLineLabel);

  return (
    <div className="w-full rounded-xl border border-[var(--twilight)] bg-[var(--night)] p-3 motion-hover-lift flex flex-col gap-2.5">
      {address && (
        <p className="text-sm text-[var(--cream)] whitespace-pre-line leading-snug">
          {address}
        </p>
      )}

      {hasTransitRows && (
        <div className="flex flex-col gap-1.5">
          {martaLabel && (
            <div className="flex items-center gap-2">
              <Train size={14} color="var(--neon-green)" weight="regular" />
              <span className="text-xs text-[var(--soft)]">{martaLabel}</span>
            </div>
          )}

          {parkingLabel && (
            <div className="flex items-center gap-2">
              <Car size={14} color="var(--muted)" weight="regular" />
              <span className="text-xs text-[var(--soft)]">{parkingLabel}</span>
            </div>
          )}

          {beltLineLabel && (
            <div className="flex items-center gap-2">
              <Path size={14} color="var(--neon-cyan)" weight="regular" />
              <span className="text-xs text-[var(--soft)]">{beltLineLabel}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
