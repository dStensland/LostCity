"use client";

import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClass } from "@/lib/css-utils";
import { BeerBottle } from "@phosphor-icons/react";
import Badge from "@/components/ui/Badge";
import {
  isActiveNow,
  formatDays,
  formatTimeWindow,
  TYPE_LABELS,
} from "@/lib/specials-utils";
import type { SectionProps } from "@/lib/detail/types";
import type { VenueSpecial } from "@/lib/specials-utils";

export function SpecialsSection({ data }: SectionProps) {
  if (data.entityType !== "place") return null;

  const specials = data.payload.specials as VenueSpecial[];
  if (!specials || specials.length === 0) return null;

  const colorClass = createCssVarClass("--specials-accent", "var(--gold)", "specials-section");

  return (
    <div className="space-y-3">
      <ScopedStyles css={colorClass?.css} />
      {specials.map((special) => {
        const active = isActiveNow(special);
        const days = formatDays(special.days_of_week);
        const time = formatTimeWindow(special.time_start, special.time_end);
        const typeLabel = TYPE_LABELS[special.type] ?? special.type?.replace(/_/g, " ");

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
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[var(--neon-green)] animate-pulse" />
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

              {(days || time) && (
                <p className="text-sm text-[var(--soft)] mt-1.5">
                  {days}
                  {days && time && " · "}
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
  );
}
