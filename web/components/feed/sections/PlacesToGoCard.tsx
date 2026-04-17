"use client";

import Link from "next/link";
import SmartImage from "@/components/SmartImage";
import Dot from "@/components/ui/Dot";
import type { PlacesToGoCard as PlacesToGoCardType } from "@/lib/places-to-go/types";

interface PlacesToGoCardProps {
  card: PlacesToGoCardType;
  accentColor: string;
}

export function PlacesToGoCard({ card, accentColor }: PlacesToGoCardProps) {
  const hasEventCount = card.event_count > 0;
  const showOpenStatus = card.is_open !== null;

  return (
    <Link
      href={card.href}
      // Motion personality: curated, slow.
      // Hover tint shift + subtle image push-in. Neighborhood tag picks up
      // accent on hover. See Wave D / D1 Places to Go motion.
      className="group/placecard flex items-start gap-3 p-2.5 rounded-lg bg-[var(--night)] border border-[var(--twilight)]/40 border-l-2 hover:bg-[var(--dusk)] transition-colors no-underline"
      style={{ borderLeftColor: accentColor }}
    >
      {/* Image — subtle 1.05× zoom on card hover, 600ms ease. */}
      <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-[var(--twilight)] relative">
        {card.image_url ? (
          <SmartImage
            src={card.image_url}
            alt=""
            fill
            className="object-cover transition-transform duration-[600ms] ease-out group-hover/placecard:scale-[1.05]"
            loading="lazy"
          />
        ) : (
          <div
            className="w-full h-full transition-transform duration-[600ms] ease-out group-hover/placecard:scale-[1.05]"
            style={{
              background: `linear-gradient(135deg, color-mix(in srgb, ${accentColor} 30%, transparent), color-mix(in srgb, ${accentColor} 10%, transparent))`,
            }}
          />
        )}
      </div>

      {/* Text content */}
      <div className="flex-1 min-w-0 pt-0.5">
        <p className="text-sm font-semibold text-[var(--cream)] leading-tight truncate">
          {card.name}
        </p>

        {/* Subtitle: neighborhood · open status */}
        <p className="text-xs text-[var(--soft)] mt-0.5 flex items-center gap-1">
          {card.neighborhood && (
            <span
              className="truncate transition-colors group-hover/placecard:text-[color:var(--place-accent)]"
              style={{ ["--place-accent" as string]: accentColor }}
            >
              {card.neighborhood}
            </span>
          )}
          {card.neighborhood && showOpenStatus && <Dot />}
          {showOpenStatus && (
            <span
              className={
                card.is_open
                  ? "text-[var(--neon-green)] flex-shrink-0"
                  : "text-[var(--muted)] flex-shrink-0"
              }
            >
              {card.is_open ? "Open now" : "Closed"}
            </span>
          )}
        </p>

        {/* Callouts + event count badge */}
        <div className="flex items-center gap-2 mt-1">
          {card.callouts.length > 0 && (
            <p className="text-xs text-[var(--muted)] truncate flex-1">
              {card.callouts.join(" · ")}
            </p>
          )}
          {hasEventCount && (
            <span
              className="flex-shrink-0 px-1.5 py-0.5 rounded-full text-2xs font-mono font-bold tabular-nums"
              style={{
                background: `color-mix(in srgb, ${accentColor} 20%, transparent)`,
                color: accentColor,
              }}
            >
              {card.event_count}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export type { PlacesToGoCardProps };
