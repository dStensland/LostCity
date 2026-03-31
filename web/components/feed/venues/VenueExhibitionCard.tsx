"use client";

import { memo } from "react";
import Link from "next/link";
import SmartImage from "@/components/SmartImage";
import CategoryIcon from "@/components/CategoryIcon";

interface Exhibition {
  id: number;
  title: string;
  opening_date: string | null;
  closing_date: string | null;
}

export interface VenueExhibitionCardProps {
  venue: {
    id: number;
    name: string;
    slug: string;
    neighborhood: string | null;
    image_url: string | null;
  };
  exhibitions: Exhibition[];
  portalSlug: string;
  accentColor: string;
  venueType?: string;
}

/**
 * Returns a short date label for a single exhibition.
 *
 * Logic (evaluated today at midnight local time):
 *   - closing_date in the future  → "Through [Mon Day]"
 *   - opening_date in the future  → "Opens [Mon Day]"
 *   - otherwise                   → "Now showing"
 */
function getExhibitionDateLabel(
  opening_date: string | null,
  closing_date: string | null
): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const fmt = (d: string) =>
    new Date(d + "T12:00:00").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

  if (closing_date) {
    const closing = new Date(closing_date + "T12:00:00");
    if (closing > today) {
      return `Through ${fmt(closing_date)}`;
    }
  }

  if (opening_date) {
    const opening = new Date(opening_date + "T12:00:00");
    if (opening > today) {
      return `Opens ${fmt(opening_date)}`;
    }
  }

  return "Now showing";
}

export const VenueExhibitionCard = memo(function VenueExhibitionCard({
  venue,
  exhibitions,
  portalSlug,
  accentColor,
  venueType = "gallery",
}: VenueExhibitionCardProps) {
  const visibleExhibitions = exhibitions.slice(0, 3);

  return (
    <Link
      href={`/${portalSlug}/spots/${venue.slug}`}
      className={
        "group block rounded-lg bg-[var(--night)] border border-[var(--twilight)]/30 " +
        "hover:bg-[var(--dusk)]/50 hover:border-[var(--twilight)]/50 " +
        "transition-colors overflow-hidden"
      }
    >
      {/* Venue header */}
      <div className="flex items-center gap-3 p-3 pb-2.5">
        {/* 48px icon / image */}
        <div className="relative w-12 h-12 flex-shrink-0 rounded-md overflow-hidden bg-[var(--twilight)]">
          {venue.image_url ? (
            <SmartImage
              src={venue.image_url}
              alt=""
              fill
              className="object-cover"
              sizes="48px"
              fallback={
                <div className="w-full h-full flex items-center justify-center">
                  <CategoryIcon
                    type={venueType}
                    size={20}
                    weight="light"
                    glow="none"
                    className="text-[var(--muted)]"
                  />
                </div>
              }
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <CategoryIcon
                type={venueType}
                size={20}
                weight="light"
                glow="none"
                className="text-[var(--muted)]"
              />
            </div>
          )}
        </div>

        {/* Venue name + neighborhood */}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--cream)] truncate leading-snug">
            {venue.name}
          </p>
          {venue.neighborhood && (
            <p className="text-xs text-[var(--muted)] truncate mt-0.5">
              {venue.neighborhood}
            </p>
          )}
        </div>
      </div>

      {/* Divider */}
      {visibleExhibitions.length > 0 && (
        <div className="mx-3 border-t border-[var(--twilight)]/30" />
      )}

      {/* Exhibition list */}
      {visibleExhibitions.length > 0 && (
        <ul className="px-3 pt-2 pb-3 space-y-2">
          {visibleExhibitions.map((exhibition) => {
            const dateLabel = getExhibitionDateLabel(
              exhibition.opening_date,
              exhibition.closing_date
            );
            return (
              <li key={exhibition.id}>
                <p className="text-xs text-[var(--soft)] leading-snug line-clamp-1">
                  {exhibition.title}
                </p>
                <p className="text-2xs text-[var(--muted)] mt-0.5">{dateLabel}</p>
              </li>
            );
          })}
        </ul>
      )}
    </Link>
  );
});

export type { Exhibition };
