"use client";

import { MusicShowtimeChip } from "@/components/music/MusicShowtimeChip";
import type { MusicShowPayload } from "@/lib/music/types";
import { buildSpotUrl } from "@/lib/entity-urls";

export interface LiveTonightPlaybillRowProps {
  venueName: string;
  venueSlug: string;
  portalSlug: string;
  shows: MusicShowPayload[];
  onShowTap: (show: MusicShowPayload) => void;
}

export function LiveTonightPlaybillRow({
  venueName,
  venueSlug,
  portalSlug,
  shows,
  onShowTap,
}: LiveTonightPlaybillRowProps) {
  const visible = shows.slice(0, 4);
  const overflow = shows.length - visible.length;
  const venueUrl = buildSpotUrl(venueSlug, portalSlug, "feed");

  return (
    <div className="flex items-start gap-3 py-2 border-b border-[var(--twilight)]/40 last:border-b-0">
      <a
        href={venueUrl}
        title={venueName}
        className="w-[110px] flex-shrink-0 pt-1.5 font-mono text-xs font-bold tracking-[2.2px] uppercase text-[var(--cream)] hover:text-[var(--vibe)] transition-colors duration-200 truncate"
      >
        {venueName}
      </a>
      <div className="flex-1 flex flex-wrap items-center gap-x-2 gap-y-1.5">
        {visible.map((show) => {
          const headliner = show.artists.find((a) => a.is_headliner);
          const name = headliner?.name ?? show.title;
          const handleRowTap = () => onShowTap(show);
          const handleKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onShowTap(show);
            }
          };
          return (
            <div
              key={show.id}
              role="button"
              tabIndex={0}
              onClick={handleRowTap}
              onKeyDown={handleKey}
              className="flex items-center gap-1.5 text-sm cursor-pointer rounded-md px-1 py-0.5 -mx-1 hover:bg-[var(--twilight)]/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--vibe)] focus-visible:outline-offset-2 transition-colors"
            >
              <span className="font-semibold text-[var(--cream)]">{name}</span>
              <MusicShowtimeChip
                doorsTime={show.doors_time}
                showTime={show.start_time}
                ticketStatus={show.ticket_status}
                isFree={show.is_free}
                agePolicy={show.age_policy}
                onTap={(e) => {
                  e?.stopPropagation();
                  onShowTap(show);
                }}
              />
            </div>
          );
        })}
        {overflow > 0 && (
          <a
            href={venueUrl}
            className="font-mono text-xs text-[var(--vibe)] hover:opacity-80"
            onClick={(e) => e.stopPropagation()}
          >
            +{overflow} more →
          </a>
        )}
      </div>
    </div>
  );
}
