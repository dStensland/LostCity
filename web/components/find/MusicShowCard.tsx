"use client";

import Link from "next/link";
import { memo } from "react";
import { formatTimeSplit } from "@/lib/formats";
import Dot from "@/components/ui/Dot";

export interface MusicShow {
  event_id: number;
  title: string;
  start_time: string | null;
  is_free: boolean;
  tags: string[];
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
  };
}

export interface MusicShowCardProps {
  show: MusicShow;
  portalSlug: string;
  portalId?: string;
  selectedDate: string;
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

function toLocalIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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

function formatShowtime(time: string | null): string {
  if (!time) return "TBA";
  const parts = formatTimeSplit(time);
  if (parts.time === "TBA") return "TBA";
  return `${parts.time}${parts.period ? ` ${parts.period}` : ""}`;
}

export const MusicShowCard = memo(function MusicShowCard({
  show,
  portalSlug,
  portalId,
  selectedDate,
}: MusicShowCardProps) {
  const headliner =
    show.artists.find((a) => a.is_headliner) ||
    show.artists.sort((a, b) => (a.billing_order ?? 99) - (b.billing_order ?? 99))[0] ||
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
      className={`group block rounded-xl border ${borderClass} bg-[var(--night)]/45 p-3 sm:p-3.5 hover:border-[var(--coral)]/40 transition-colors`}
    >
      <div className="flex items-start gap-2.5 justify-between">
        {/* Left: artist + venue info */}
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
                .sort((a, b) => (a.billing_order ?? 99) - (b.billing_order ?? 99))
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

          {/* Badges row */}
          {(show.is_free || isAllAges) && (
            <div className="flex items-center gap-1.5 mt-2">
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
    </Link>
  );
});

