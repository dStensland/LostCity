"use client";

import { memo } from "react";
import Link from "next/link";
import { ArrowSquareOut } from "@phosphor-icons/react";
import { formatShowtime } from "@/lib/show-card-utils";

/**
 * Minimum shape required from any show type (music, stage, comedy).
 * Vertical-specific fields are surfaced via the renderMeta render prop.
 */
export interface BaseShow {
  event_id: number;
  title: string;
  start_time: string | null;
  is_free: boolean;
  ticket_url: string | null;
  price_min: number | null;
}

export interface ShowRowProps {
  show: BaseShow;
  portalSlug: string;
  /** Optional render prop for vertical-specific metadata (genres, run periods, format badges) */
  renderMeta?: (show: BaseShow) => React.ReactNode;
}

function formatPrice(priceMin: number | null): string | null {
  if (priceMin === null) return null;
  if (priceMin === 0) return null; // is_free handles this case
  return `$${priceMin}`;
}

export const ShowRow = memo(function ShowRow({
  show,
  portalSlug,
  renderMeta,
}: ShowRowProps) {
  const href = `/${portalSlug}?event=${show.event_id}`;
  const priceLabel = formatPrice(show.price_min);

  return (
    <div className="flex items-start gap-3 py-2.5 px-3">
      {/* Time */}
      <span className="font-mono text-xs text-[var(--muted)] tabular-nums flex-shrink-0 pt-0.5 min-w-[52px]">
        {formatShowtime(show.start_time)}
      </span>

      {/* Title + meta */}
      <div className="flex-1 min-w-0">
        <Link
          href={href}
          scroll={false}
          className="group/row block"
        >
          <span className="text-sm font-medium text-[var(--cream)] group-hover/row:text-[var(--coral)] transition-colors leading-snug line-clamp-1">
            {show.title}
          </span>
        </Link>
        {renderMeta && (
          <div className="mt-1">
            {renderMeta(show)}
          </div>
        )}
      </div>

      {/* Price + ticket link */}
      <div className="flex-shrink-0 flex items-center gap-2 pt-0.5">
        {show.is_free ? (
          <span className="text-xs font-medium text-[var(--neon-green)]">Free</span>
        ) : priceLabel ? (
          <span className="text-xs text-[var(--soft)]">{priceLabel}</span>
        ) : null}
        {show.ticket_url && (
          <a
            href={show.ticket_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-xs font-medium text-[var(--coral)] hover:text-[var(--coral)]/80 transition-colors"
            aria-label={`Tickets for ${show.title}`}
          >
            Tickets
            <ArrowSquareOut size={11} weight="bold" aria-hidden="true" />
          </a>
        )}
      </div>
    </div>
  );
});

export type { ShowRowProps as ShowRowComponentProps };
