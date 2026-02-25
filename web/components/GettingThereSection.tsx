"use client";

export type TransitData = {
  nearest_marta_station?: string | null;
  marta_walk_minutes?: number | null;
  marta_lines?: string[] | null;
  beltline_adjacent?: boolean | null;
  beltline_segment?: string | null;
  beltline_walk_minutes?: number | null;
  parking_type?: string[] | null;
  parking_free?: boolean | null;
  parking_note?: string | null;
  transit_score?: number | null;
};

export type WalkableNeighbor = {
  id: number;
  name: string;
  slug: string;
  walk_minutes: number;
};

interface GettingThereSectionProps {
  transit: TransitData;
  variant?: "expanded" | "compact";
  walkableNeighbors?: WalkableNeighbor[];
  onSpotClick?: (slug: string) => void;
}

function hasAnyTransitData(transit: TransitData): boolean {
  return Boolean(
    (transit.nearest_marta_station && transit.marta_walk_minutes && transit.marta_walk_minutes <= 15) ||
    transit.beltline_adjacent ||
    (transit.parking_type && transit.parking_type.length > 0) ||
    transit.transit_score
  );
}

// ─── Icons ───────────────────────────────────────────────────────────────

function TrainIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 18l-2 3m10-3l2 3M12 2C8 2 5 3 5 6v9a3 3 0 003 3h8a3 3 0 003-3V6c0-3-3-4-7-4z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 15h.01M15 15h.01M5 10h14" />
    </svg>
  );
}

function PathIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  );
}

function ParkingIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect x="3" y="3" width="18" height="18" rx="3" strokeWidth={1.5} />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7h4a3 3 0 010 6H9" />
    </svg>
  );
}

function WalkIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 4a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM7 21l3-7m0 0l2-2m-2 2l-2-4 4-3 2 1 3-2m-5 13l3-3.5" />
    </svg>
  );
}

// ─── Shared helpers ──────────────────────────────────────────────────────

function TransitScoreBadge({ score }: { score: number }) {
  let color: string;
  let label: string;
  if (score >= 8) {
    color = "var(--neon-green, #22c55e)";
    label = "Excellent";
  } else if (score >= 5) {
    color = "var(--gold, #eab308)";
    label = "Good";
  } else {
    color = "var(--coral, #f87171)";
    label = "Limited";
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[0.6rem] font-mono font-medium uppercase tracking-wider"
      style={{
        background: `color-mix(in srgb, ${color} 15%, transparent)`,
        color,
        border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: color }}
      />
      {score}/10 {label}
    </span>
  );
}

function formatMartaLines(lines: string[]): string {
  return lines
    .map((l) => l.charAt(0).toUpperCase() + l.slice(1))
    .join("/");
}

function formatParkingTypes(types: string[], isFree?: boolean | null): string {
  const labels: Record<string, string> = {
    lot: "Parking lot",
    deck: "Parking deck",
    garage: "Parking garage",
    valet: "Valet",
    street: "Street parking",
  };
  const formatted = types.map((t) => labels[t] || t).join(" · ");
  if (isFree === true) return `Free ${formatted.toLowerCase()}`;
  return formatted;
}

// ─── Compact variant ─────────────────────────────────────────────────────

function CompactTransit({ transit }: { transit: TransitData }) {
  const chips: { icon: React.ReactNode; text: string }[] = [];

  if (transit.nearest_marta_station && transit.marta_walk_minutes && transit.marta_walk_minutes <= 15) {
    chips.push({
      icon: <TrainIcon className="w-3 h-3" />,
      text: `${transit.marta_walk_minutes} min`,
    });
  }
  if (transit.beltline_adjacent) {
    chips.push({
      icon: <PathIcon className="w-3 h-3" />,
      text: "BeltLine",
    });
  }
  if (transit.parking_type && transit.parking_type.length > 0) {
    const labels: Record<string, string> = {
      lot: "Lot", deck: "Deck", garage: "Garage", valet: "Valet", street: "Street",
    };
    const label = transit.parking_free
      ? "Free"
      : (labels[transit.parking_type[0]] || transit.parking_type[0]);
    chips.push({
      icon: <ParkingIcon className="w-3 h-3" />,
      text: label,
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex items-center gap-2 mt-2">
      {chips.map((chip, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[0.65rem] font-mono text-[var(--soft)] border border-[var(--twilight)] bg-[var(--night)]/40"
        >
          <span className="text-[var(--muted)]">{chip.icon}</span>
          {chip.text}
        </span>
      ))}
    </div>
  );
}

// ─── Expanded variant ────────────────────────────────────────────────────

function ExpandedTransit({
  transit,
  walkableNeighbors,
  onSpotClick,
}: {
  transit: TransitData;
  walkableNeighbors?: WalkableNeighbor[];
  onSpotClick?: (slug: string) => void;
}) {
  const showMarta = transit.nearest_marta_station && transit.marta_walk_minutes && transit.marta_walk_minutes <= 15;
  const showBeltLine = transit.beltline_adjacent;
  const showParking = transit.parking_type && transit.parking_type.length > 0;
  const showWalkable = walkableNeighbors && walkableNeighbors.length > 0;

  return (
    <div className="space-y-3">
      {showMarta && (
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--twilight)]/50 border border-[var(--twilight)]/60 flex items-center justify-center flex-shrink-0 mt-0.5">
            <TrainIcon className="w-4 h-4 text-[var(--neon-cyan, #65E8FF)]" />
          </div>
          <div>
            <p className="text-[var(--soft)] text-sm">
              <span className="text-[var(--cream)] font-medium">{transit.nearest_marta_station}</span>
              {transit.marta_lines && transit.marta_lines.length > 0 && (
                <span className="text-[var(--muted)]"> ({formatMartaLines(transit.marta_lines)})</span>
              )}
            </p>
            <p className="text-[0.7rem] text-[var(--muted)] font-mono">
              {transit.marta_walk_minutes} min walk
            </p>
          </div>
        </div>
      )}

      {showBeltLine && (
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--twilight)]/50 border border-[var(--twilight)]/60 flex items-center justify-center flex-shrink-0 mt-0.5">
            <PathIcon className="w-4 h-4 text-[var(--neon-green, #22c55e)]" />
          </div>
          <div>
            <p className="text-[var(--soft)] text-sm">
              <span className="text-[var(--cream)] font-medium">BeltLine</span>
              {transit.beltline_segment && (
                <span className="text-[var(--muted)]"> · {transit.beltline_segment}</span>
              )}
            </p>
            {transit.beltline_walk_minutes != null && transit.beltline_walk_minutes > 0 && (
              <p className="text-[0.7rem] text-[var(--muted)] font-mono">
                {transit.beltline_walk_minutes} min walk
              </p>
            )}
          </div>
        </div>
      )}

      {showParking && (
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--twilight)]/50 border border-[var(--twilight)]/60 flex items-center justify-center flex-shrink-0 mt-0.5">
            <ParkingIcon className="w-4 h-4 text-[var(--gold, #eab308)]" />
          </div>
          <div>
            <p className="text-[var(--soft)] text-sm">
              {formatParkingTypes(transit.parking_type!, transit.parking_free)}
            </p>
            {transit.parking_note && (
              <p className="text-[0.7rem] text-[var(--muted)] font-mono">
                {transit.parking_note}
              </p>
            )}
          </div>
        </div>
      )}

      {showWalkable && (
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--twilight)]/50 border border-[var(--twilight)]/60 flex items-center justify-center flex-shrink-0 mt-0.5">
            <WalkIcon className="w-4 h-4 text-[var(--coral)]" />
          </div>
          <div>
            <p className="text-[0.7rem] text-[var(--muted)] font-mono uppercase tracking-wider mb-1.5">
              Walkable to
            </p>
            <div className="flex flex-wrap gap-1.5">
              {walkableNeighbors!.slice(0, 5).map((neighbor) => (
                <button
                  key={neighbor.id}
                  onClick={() => onSpotClick?.(neighbor.slug)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-[var(--twilight)]/50 text-[var(--soft)] hover:text-[var(--coral)] hover:bg-[var(--twilight)] transition-colors border border-[var(--twilight)]/60"
                >
                  <span className="truncate max-w-[140px]">{neighbor.name}</span>
                  <span className="text-[var(--muted)] font-mono text-[0.6rem]">{neighbor.walk_minutes}m</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────

export default function GettingThereSection({
  transit,
  variant = "expanded",
  walkableNeighbors,
  onSpotClick,
}: GettingThereSectionProps) {
  if (!hasAnyTransitData(transit)) return null;

  if (variant === "compact") {
    return <CompactTransit transit={transit} />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-mono text-[0.65rem] font-medium text-[var(--muted)] uppercase tracking-widest">
          Getting There
        </h2>
        {transit.transit_score != null && (
          <TransitScoreBadge score={transit.transit_score} />
        )}
      </div>
      <ExpandedTransit
        transit={transit}
        walkableNeighbors={walkableNeighbors}
        onSpotClick={onSpotClick}
      />
    </div>
  );
}
