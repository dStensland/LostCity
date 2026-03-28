"use client";

import { SectionHeader } from "./SectionHeader";
import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClass } from "@/lib/css-utils";
import { BeerBottle } from "@phosphor-icons/react";
import Badge from "@/components/ui/Badge";
import {
  type VenueSpecial,
  isActiveNow,
  formatDays,
  formatTimeWindow,
  TYPE_LABELS,
} from "@/lib/specials-utils";

export type { VenueSpecial };

interface PlaceSpecialsSectionProps {
  specials: VenueSpecial[];
}

export default function PlaceSpecialsSection({
  specials,
}: PlaceSpecialsSectionProps) {
  if (!specials || specials.length === 0) return null;

  const colorClass = createCssVarClass(
    "--specials-accent",
    "var(--gold)",
    "specials-section"
  );

  return (
    <div className="mt-6">
      <ScopedStyles css={colorClass?.css} />
      <SectionHeader title="Deals & Specials" count={specials.length} />
      <div className="space-y-3">
        {specials.map((special) => {
          const active = isActiveNow(special);
          const days = formatDays(special.days_of_week);
          const time = formatTimeWindow(special.time_start, special.time_end);
          const typeLabel =
            TYPE_LABELS[special.type] ?? special.type?.replace(/_/g, " ");

          return (
            <div
              key={special.id}
              className={`flex items-start gap-3 p-4 rounded-xl border border-[var(--twilight)]/60 bg-[var(--night)] border-l-2 transition-all ${colorClass?.className ?? ""} ${active ? "bg-[var(--gold)]/[0.03]" : ""}`}
              style={{ borderLeftColor: "var(--gold)" }}
            >
              <BeerBottle
                size={20}
                weight="light"
                className="flex-shrink-0 mt-0.5 text-[var(--specials-accent)]"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-[var(--cream)] leading-tight">
                    {special.title}
                  </h3>
                  {active && (
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--neon-green)] opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[var(--neon-green)]" />
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 flex-wrap mt-1">
                  {typeLabel && (
                    <span className="text-2xs font-mono uppercase tracking-wider text-[var(--soft)]">
                      {typeLabel}
                    </span>
                  )}
                  {active && (
                    <Badge variant="success" size="sm">
                      Active Now
                    </Badge>
                  )}
                </div>

                {/* Days + time */}
                {(days || time) && (
                  <p className="text-sm text-[var(--soft)] mt-1.5">
                    {days}
                    {days && time && " \u00B7 "}
                    {time}
                  </p>
                )}

                {special.description && (
                  <p className="text-sm text-[var(--soft)] mt-1.5 leading-relaxed line-clamp-2">
                    {special.description}
                  </p>
                )}

                {special.price_note && (
                  <p className="text-xs text-[var(--gold)] mt-1 font-mono font-bold uppercase tracking-wider">
                    {special.price_note}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
