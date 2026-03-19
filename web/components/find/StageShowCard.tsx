"use client";

import Link from "next/link";
import { memo } from "react";
import SmartImage from "@/components/SmartImage";
import CategoryIcon from "@/components/CategoryIcon";
import { MaskHappy, Microphone } from "@phosphor-icons/react";
import { formatTimeSplit } from "@/lib/formats";
import { MAPBOX_TOKEN } from "@/lib/map-config";
import Dot from "@/components/ui/Dot";

export interface StageShow {
  event_id: number;
  title: string;
  start_time: string | null;
  start_date: string;
  end_date: string | null;
  is_free: boolean;
  tags: string[];
  genres: string[];
  category_id: string;
  age_policy: string | null;
  series_id: string | null;
  series_slug: string | null;
  venue: {
    id: number;
    name: string;
    slug: string;
    neighborhood: string | null;
    image_url: string | null;
    lat: number | null;
    lng: number | null;
  };
}

function venueMapUrl(lat: number, lng: number): string {
  return `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/pin-s+ff6b7a(${lng},${lat})/${lng},${lat},15,0/160x240@2x?access_token=${MAPBOX_TOKEN}`;
}

export interface StageShowCardProps {
  show: StageShow;
  portalSlug: string;
  portalId?: string;
}

// Prefetch event detail on pointer-down so data loads before navigation completes
const prefetchedUrls = new Set<string>();
function prefetchEventDetail(eventId: number, portalId?: string) {
  const url = portalId
    ? `/api/events/${eventId}?portal_id=${portalId}`
    : `/api/events/${eventId}`;
  if (prefetchedUrls.has(url)) return;
  prefetchedUrls.add(url);
  fetch(url, { priority: "low" } as RequestInit).catch(() => {
    prefetchedUrls.delete(url);
  });
}

const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatThruDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `thru ${MONTH_ABBR[d.getMonth()]} ${d.getDate()}`;
}

function isRunBadgeVisible(show: StageShow): boolean {
  if (!show.series_id) return false;
  if (!show.end_date) return false;
  const start = new Date(show.start_date + "T00:00:00");
  const end = new Date(show.end_date + "T00:00:00");
  return end > start;
}

function formatShowtime(time: string | null): string {
  if (!time) return "TBA";
  const parts = formatTimeSplit(time);
  if (parts.time === "TBA") return "TBA";
  return `${parts.time}${parts.period ? ` ${parts.period}` : ""}`;
}

const isComedy = (show: StageShow) =>
  show.category_id === "comedy" ||
  show.genres.some((g) => g.toLowerCase().includes("comedy")) ||
  show.tags.some((t) => t.toLowerCase().includes("comedy"));

export const StageShowCard = memo(function StageShowCard({
  show,
  portalSlug,
  portalId,
}: StageShowCardProps) {
  const comedy = isComedy(show);

  const borderClass = comedy
    ? "border-[var(--gold)]/25"
    : "border-[var(--vibe)]/30";

  const href = `/${portalSlug}?event=${show.event_id}`;

  const isAllAges =
    show.tags.includes("all-ages") || show.age_policy === "All ages";

  // Filter genres for display — skip tags already shown as special badges
  const displayGenres = show.genres.filter(
    (g) => g.toLowerCase() !== "comedy" && g.toLowerCase() !== "performing arts"
  );

  const showTagsRow =
    displayGenres.length > 0 ||
    show.is_free ||
    isAllAges;

  const showRunBadge = isRunBadgeVisible(show);

  return (
    <Link
      href={href}
      scroll={false}
      onPointerDown={() => prefetchEventDetail(show.event_id, portalId)}
      className={`group block rounded-[10px] border ${borderClass} bg-[var(--night)]/45 overflow-hidden hover:border-[var(--coral)]/40 transition-colors`}
    >
      <div className="flex items-stretch">
        {/* Venue image rail */}
        <div className="flex-shrink-0 w-[72px] sm:w-[80px] relative bg-[var(--dusk)]">
          {show.venue.image_url ? (
            <SmartImage
              src={show.venue.image_url}
              alt={show.venue.name}
              fill
              className="object-cover"
              sizes="80px"
            />
          ) : show.venue.lat && show.venue.lng ? (
            <SmartImage
              src={venueMapUrl(show.venue.lat, show.venue.lng)}
              alt={show.venue.name}
              fill
              className="object-cover"
              sizes="80px"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[var(--twilight)]/30 to-[var(--void)]/80">
              <CategoryIcon type="performing_arts" size={22} glow="subtle" />
            </div>
          )}
        </div>
        {/* Content */}
        <div className="flex-1 min-w-0 p-3 flex items-start gap-2 justify-between">
        <div className="flex-1 min-w-0">
          {/* Category badge */}
          <div className="flex items-center gap-1 mb-1">
            {comedy ? (
              <>
                <Microphone
                  weight="bold"
                  size={12}
                  className="text-[var(--gold)] flex-shrink-0"
                />
                <span className="font-mono text-2xs font-semibold uppercase tracking-[0.12em] text-[var(--gold)]">
                  COMEDY
                </span>
              </>
            ) : (
              <>
                <MaskHappy
                  weight="bold"
                  size={12}
                  className="text-[var(--vibe)] flex-shrink-0"
                />
                <span className="font-mono text-2xs font-semibold uppercase tracking-[0.12em] text-[var(--vibe)]">
                  THEATER
                </span>
              </>
            )}
          </div>

          {/* Title */}
          <h3 className="font-semibold text-base text-[var(--cream)] leading-snug truncate group-hover:text-[var(--coral)] transition-colors">
            {show.title}
          </h3>

          {/* Venue + neighborhood */}
          <div className="flex items-center gap-1.5 mt-1">
            <span className="font-mono text-xs text-[var(--soft)] truncate">
              {show.venue.name}
            </span>
            {show.venue.neighborhood && (
              <>
                <Dot className="text-[var(--muted)]/40 flex-shrink-0" />
                <span className="font-mono text-2xs text-[var(--muted)] uppercase tracking-[0.06em] flex-shrink-0">
                  {show.venue.neighborhood}
                </span>
              </>
            )}
          </div>

          {/* Tags row */}
          {showTagsRow && (
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {displayGenres.map((genre) => (
                <span
                  key={genre}
                  className="px-2 py-0.5 rounded-full bg-[var(--twilight)]/80 font-mono text-2xs font-medium text-[var(--muted)]"
                >
                  {genre}
                </span>
              ))}
              {show.is_free && (
                <span className="px-2 py-0.5 rounded-full bg-[var(--neon-green)]/15 font-mono text-2xs font-medium text-[var(--neon-green)]">
                  free
                </span>
              )}
              {isAllAges && (
                <span className="px-2 py-0.5 rounded-full bg-[var(--neon-green)]/15 font-mono text-2xs font-medium text-[var(--neon-green)]">
                  all-ages
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right: time chip + run badge */}
        <div className="flex-shrink-0 flex flex-col items-end gap-1 mt-0.5">
          <span className="px-2.5 py-1 rounded-md bg-[var(--gold)]/15 border border-[var(--gold)]/40 font-mono text-xs font-semibold text-[var(--gold)]">
            {formatShowtime(show.start_time)}
          </span>
          {showRunBadge && show.end_date && (
            <span className="px-1.5 py-0.5 rounded-full bg-[var(--vibe)]/10 border border-[var(--vibe)]/30 font-mono text-2xs font-medium text-[var(--vibe)]">
              {formatThruDate(show.end_date)}
            </span>
          )}
        </div>
        </div>
      </div>
    </Link>
  );
});
