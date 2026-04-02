"use client";

import Link from "next/link";
import { memo } from "react";
import SmartImage from "@/components/SmartImage";
import CategoryIcon from "@/components/CategoryIcon";
import Dot from "@/components/ui/Dot";
import { prefetchEventDetail, venueMapUrl, formatShowtime, toLocalIsoDate } from "@/lib/show-card-utils";

export interface MusicShow {
  event_id: number;
  title: string;
  start_time: string | null;
  is_free: boolean;
  ticket_url: string | null;
  price_min: number | null;
  tags: string[];
  genres: string[];
  age_policy: string | null;
  artists: {
    name: string;
    is_headliner: boolean;
    billing_order: number | null;
  }[];
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

export interface MusicShowCardProps {
  show: MusicShow;
  portalSlug: string;
  portalId?: string;
  selectedDate: string;
}


function isShowLive(startTime: string | null, selectedDate: string): boolean {
  if (!startTime) return false;
  // Only show NOW badge when viewing today's date
  const now = new Date();
  if (selectedDate !== toLocalIsoDate(now)) return false;

  const parts = startTime.split(":");
  if (parts.length < 2) return false;
  const hour = parseInt(parts[0], 10);
  const minute = parseInt(parts[1], 10);
  if (isNaN(hour) || isNaN(minute)) return false;

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = hour * 60 + minute;
  const diffMinutes = nowMinutes - startMinutes;

  // Show is "live" if it started 0-120 minutes ago
  return diffMinutes >= 0 && diffMinutes <= 120;
}

export const MusicShowCard = memo(function MusicShowCard({
  show,
  portalSlug,
  portalId,
  selectedDate,
}: MusicShowCardProps) {
  const headliner =
    show.artists.find((a) => a.is_headliner) ||
    show.artists.toSorted((a, b) => (a.billing_order ?? 99) - (b.billing_order ?? 99))[0] ||
    null;

  const heroText = headliner?.name ?? show.title;

  const supportingActs = show.artists.filter((a) => a !== headliner);

  const isLive = isShowLive(show.start_time, selectedDate);
  const isAllAges =
    show.tags.includes("all-ages") || show.age_policy === "All ages";

  const borderClass = isLive
    ? "border-[var(--neon-red)]/30"
    : "border-[var(--twilight)]";

  const timeChipClass = isLive
    ? "px-2.5 py-1 rounded-lg bg-[var(--neon-red)]/15 border border-[var(--neon-red)]/30 font-mono text-xs font-semibold text-[var(--neon-red)]"
    : "px-2.5 py-1 rounded-lg bg-[var(--gold)]/15 border border-[var(--gold)]/30 font-mono text-xs font-semibold text-[var(--gold)]";

  const href = `/${portalSlug}?event=${show.event_id}`;

  return (
    <Link
      href={href}
      scroll={false}
      onPointerDown={() => prefetchEventDetail(show.event_id, portalId)}
      className={`group block rounded-xl border ${borderClass} bg-[var(--night)]/45 overflow-hidden hover:border-[var(--coral)]/40 transition-colors`}
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
              <CategoryIcon type="music" size={22} glow="subtle" />
            </div>
          )}
        </div>
        {/* Content */}
        <div className="flex-1 min-w-0 p-3 sm:p-3.5 flex items-start gap-2.5 justify-between">
        <div className="flex-1 min-w-0">
          {/* Hero: headliner or title */}
          <div className="flex items-center gap-2 flex-wrap">
            {isLive && (
              <span className="inline-flex items-center gap-1 flex-shrink-0">
                <span className="w-[5px] h-[5px] rounded-full bg-[var(--neon-red)]" aria-hidden="true" />
                <span className="font-mono text-2xs font-bold uppercase tracking-[0.1em] text-[var(--neon-red)]">
                  NOW
                </span>
              </span>
            )}
            <h3 className="font-semibold text-base text-[var(--cream)] leading-snug truncate group-hover:text-[var(--coral)] transition-colors">
              {heroText}
            </h3>
          </div>

          {/* Supporting acts */}
          {supportingActs.length > 0 && (
            <p className="text-xs text-[var(--soft)] mt-0.5 truncate">
              w/{" "}
              {supportingActs
                .toSorted((a, b) => (a.billing_order ?? 99) - (b.billing_order ?? 99))
                .map((a) => a.name)
                .join(", ")}
            </p>
          )}

          {/* Venue + neighborhood */}
          <div className="flex items-center gap-1.5 mt-1.5">
            <span className="font-mono text-xs text-[var(--soft)] truncate">
              {show.venue.name}
            </span>
            {show.venue.neighborhood && (
              <>
                <Dot className="text-[var(--muted)]/40 flex-shrink-0" />
                <span className="font-mono text-xs text-[var(--muted)] uppercase tracking-[0.06em] flex-shrink-0">
                  {show.venue.neighborhood}
                </span>
              </>
            )}
          </div>

          {/* Badges + genre row */}
          {(show.is_free || isAllAges || show.genres.length > 0) && (
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {show.is_free && (
                <span className="inline-flex px-2 py-0.5 rounded-full bg-[var(--neon-green)]/15 border border-[var(--neon-green)]/30 font-mono text-2xs font-semibold uppercase tracking-[0.08em] text-[var(--neon-green)]">
                  free
                </span>
              )}
              {isAllAges && (
                <span className="inline-flex px-2 py-0.5 rounded-full bg-[var(--neon-green)]/15 border border-[var(--neon-green)]/30 font-mono text-2xs font-semibold uppercase tracking-[0.08em] text-[var(--neon-green)]">
                  all-ages
                </span>
              )}
              {show.genres.slice(0, 3).map((genre) => (
                <span
                  key={genre}
                  className="px-2 py-0.5 rounded-full bg-[var(--twilight)]/80 border border-[var(--twilight)] font-mono text-xs font-medium text-[var(--muted)]"
                >
                  {genre}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Right: time chip */}
        <div className="flex-shrink-0 mt-0.5">
          <span className={timeChipClass} tabIndex={-1}>
            {formatShowtime(show.start_time)}
          </span>
        </div>
        </div>
      </div>
    </Link>
  );
});

