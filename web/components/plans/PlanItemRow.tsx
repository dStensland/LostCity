"use client";

import Link from "next/link";
import type { PlanItem } from "@/lib/hooks/usePlans";
import { format, parseISO } from "date-fns";

interface PlanItemRowProps {
  item: PlanItem;
  isCreator: boolean;
  onRemove?: () => void;
}

export function PlanItemRow({ item, isCreator, onRemove }: PlanItemRowProps) {
  const timeStr = item.start_time
    ? format(parseISO(`2000-01-01T${item.start_time}`), "h:mm a")
    : null;

  const href = item.event_id
    ? `/events/${item.event_id}`
    : item.venue?.slug
      ? `/spots/${item.venue.slug}`
      : null;

  const content = (
    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-[var(--twilight)]/20 transition-colors group">
      {/* Time / order */}
      <div className="flex-shrink-0 w-12 text-center">
        {timeStr ? (
          <span className="font-mono text-xs text-[var(--soft)]">{timeStr}</span>
        ) : (
          <span className="font-mono text-xs text-[var(--twilight)]">#{item.sort_order + 1}</span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[var(--cream)] group-hover:text-[var(--coral)] transition-colors truncate">
          {item.title}
        </p>
        {item.venue && (
          <p className="font-mono text-[0.6rem] text-[var(--muted)] truncate">
            {item.venue.name}
          </p>
        )}
        {item.note && (
          <p className="font-mono text-[0.6rem] text-[var(--muted)] mt-0.5 line-clamp-1">
            {item.note}
          </p>
        )}
      </div>

      {/* Remove button (creator only) */}
      {isCreator && onRemove && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
          }}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--muted)] hover:text-[var(--coral)] p-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}
