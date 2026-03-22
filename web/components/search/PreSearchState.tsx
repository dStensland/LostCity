"use client";

import { memo } from "react";
import { TrendUp, Lightning, Ticket } from "@phosphor-icons/react";
import SmartImage from "@/components/SmartImage";
import { formatTime } from "@/lib/formats";
import type { PreSearchPayload, PreSearchPopularEvent } from "@/lib/search-presearch";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatPreSearchDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  if (dateStr === todayStr) return "Today";
  if (dateStr === tomorrowStr) return "Tomorrow";

  // e.g. "Mar 22"
  const [, month, day] = dateStr.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(month, 10) - 1]} ${parseInt(day, 10)}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface TrendingPillsProps {
  terms: string[];
  onTrendingClick: (term: string) => void;
  horizontal?: boolean;
  loading?: boolean;
}

function TrendingPills({ terms, onTrendingClick, horizontal, loading }: TrendingPillsProps) {
  if (loading) {
    const count = horizontal ? 5 : 6;
    return (
      <div className={`flex gap-2 ${horizontal ? "overflow-x-auto flex-nowrap scrollbar-hide pb-1" : "flex-wrap"}`}>
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="h-7 w-20 rounded-full bg-[var(--twilight)]/30 animate-pulse flex-shrink-0"
            style={{ width: `${60 + (i % 3) * 20}px` }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className={`flex gap-2 ${horizontal ? "overflow-x-auto flex-nowrap scrollbar-hide pb-1" : "flex-wrap"}`}>
      {terms.map((term) => (
        <button
          key={term}
          type="button"
          onMouseDown={() => onTrendingClick(term)}
          onClick={() => onTrendingClick(term)}
          className="flex-shrink-0 px-3 py-1.5 rounded-full bg-[var(--twilight)]/60 border border-[var(--twilight)] text-[var(--soft)] hover:text-[var(--cream)] hover:bg-[var(--twilight)] transition-colors text-xs font-mono whitespace-nowrap"
        >
          {term}
        </button>
      ))}
    </div>
  );
}

interface PopularCardProps {
  event: PreSearchPopularEvent;
}

function PopularCard({ event }: PopularCardProps) {
  const dateLabel = formatPreSearchDate(event.startDate);
  const timeLabel = formatTime(event.startTime);
  const when = [dateLabel, timeLabel !== "TBA" ? timeLabel : null].filter(Boolean).join(" · ");

  return (
    <a
      href={event.href}
      className="flex items-center gap-3 px-1 py-2 rounded-lg hover:bg-[var(--twilight)]/40 transition-colors group"
    >
      {/* 40px thumbnail */}
      <div className="flex-shrink-0 w-10 h-10 rounded-lg overflow-hidden bg-[var(--twilight)]/50 relative">
        {event.imageUrl ? (
          <SmartImage
            src={event.imageUrl}
            alt={event.title}
            fill
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Ticket size={16} className="text-[var(--muted)]" weight="duotone" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--cream)] leading-tight truncate group-hover:text-[var(--cream)]">
          {event.title}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          {event.venueName && (
            <span className="text-xs text-[var(--muted)] truncate max-w-[120px]">{event.venueName}</span>
          )}
          {when && (
            <>
              {event.venueName && <span className="text-xs text-[var(--twilight)]">·</span>}
              <span className="text-xs text-[var(--muted)]">{when}</span>
            </>
          )}
        </div>
      </div>

      {/* Badge */}
      {event.isFree && (
        <span className="flex-shrink-0 px-2 py-0.5 rounded-full bg-[var(--neon-green)]/10 border border-[var(--neon-green)]/20 text-2xs font-mono font-bold uppercase tracking-wider text-[var(--neon-green)]">
          Free
        </span>
      )}
    </a>
  );
}

function PopularCardShimmer() {
  return (
    <div className="flex items-center gap-3 px-1 py-2">
      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[var(--twilight)]/30 animate-pulse" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3.5 w-3/4 rounded bg-[var(--twilight)]/30 animate-pulse" />
        <div className="h-3 w-1/2 rounded bg-[var(--twilight)]/20 animate-pulse" />
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export interface PreSearchStateProps {
  /** Trending search terms to show as pills */
  trending: string[];
  /** Popular events to show as cards */
  popularNow: PreSearchPopularEvent[];
  /** Called when user clicks a trending pill */
  onTrendingClick: (term: string) => void;
  /** Portal slug for links */
  portalSlug: string;
  /**
   * wrap — desktop Find: pills flex-wrap, popular cards stacked vertically
   * horizontal — mobile overlay: pills single-row scrollable
   */
  layout: "wrap" | "horizontal";
  /** Whether pre-search data is still loading */
  loading?: boolean;
}

export const PreSearchState = memo(function PreSearchState({
  trending,
  popularNow,
  onTrendingClick,
  layout,
  loading = false,
}: PreSearchStateProps) {
  const isHorizontal = layout === "horizontal";

  return (
    <div className={`space-y-4 ${isHorizontal ? "px-4 pt-3" : "pt-3"}`}>
      {/* Trending pills */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <TrendUp size={13} className="text-[var(--coral)]" weight="bold" />
          <p className="text-xs text-[var(--muted)] font-mono uppercase tracking-wider">Trending</p>
        </div>
        <TrendingPills
          terms={trending}
          onTrendingClick={onTrendingClick}
          horizontal={isHorizontal}
          loading={loading && trending.length === 0}
        />
      </div>

      {/* Popular now cards */}
      {(loading || popularNow.length > 0) && (
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <Lightning size={13} className="text-[var(--gold)]" weight="fill" />
            <p className="text-xs text-[var(--muted)] font-mono uppercase tracking-wider">Popular Now</p>
          </div>
          {loading && popularNow.length === 0 ? (
            <div>
              <PopularCardShimmer />
              <PopularCardShimmer />
            </div>
          ) : (
            <div>
              {popularNow.slice(0, isHorizontal ? 2 : 2).map((event) => (
                <PopularCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export type { PreSearchPayload };
