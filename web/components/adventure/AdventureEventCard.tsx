"use client";

import { memo } from "react";
import Link from "next/link";
import { ADV, ADV_FONT } from "@/lib/adventure-tokens";

// ---- Types ---------------------------------------------------------------

export interface AdventureEventCardProps {
  id: number;
  title: string;
  startDate: string;
  startTime: string | null;
  isAllDay: boolean;
  venueName: string | null;
  venueSlug: string | null;
  neighborhood: string | null;
  sourceName: string | null;
  imageUrl: string | null;
  venueImageUrl: string | null;
  tags: string[] | null;
  sourceUrl: string | null;
  ticketUrl: string | null;
  portalSlug: string;
}

// ---- Helpers -------------------------------------------------------------

function formatDateParts(startDate: string): {
  month: string;
  day: number;
  weekday: string;
} {
  // Append noon time to avoid timezone-related date shifts
  const date = new Date(startDate + "T12:00:00");
  return {
    month: date.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
    day: date.getDate(),
    weekday: date
      .toLocaleDateString("en-US", { weekday: "short" })
      .toUpperCase(),
  };
}

function formatTime(startTime: string | null, isAllDay: boolean): string | null {
  if (isAllDay) return "ALL DAY";
  if (!startTime) return null;

  // startTime is expected as "HH:MM:SS" or "HH:MM"
  const [rawHour, rawMinute] = startTime.split(":");
  const hour24 = parseInt(rawHour, 10);
  if (isNaN(hour24)) return null;

  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const minute = rawMinute ?? "00";
  return `${hour12}:${minute}${period}`;
}

// ---- Component -----------------------------------------------------------

export const AdventureEventCard = memo(function AdventureEventCard({
  id,
  title,
  startDate,
  startTime,
  isAllDay,
  venueName,
  venueSlug,
  neighborhood,
  sourceName,
  imageUrl,
  venueImageUrl,
  tags,
  sourceUrl,
  ticketUrl,
  portalSlug,
}: AdventureEventCardProps) {
  const { month, day, weekday } = formatDateParts(startDate);
  const timeLabel = formatTime(startTime, isAllDay);
  const thumbnail = imageUrl ?? venueImageUrl ?? null;
  const visibleTags = (tags ?? []).slice(0, 4);

  // Primary link: ticket URL > source URL > event detail page
  const primaryHref =
    ticketUrl ?? sourceUrl ?? `/${portalSlug}/events/${id}`;
  const isExternal = !!(ticketUrl ?? sourceUrl);

  const venueHref =
    venueSlug ? `/${portalSlug}/spots/${venueSlug}` : null;

  return (
    <div
      className="flex overflow-hidden"
      style={{
        border: `2px solid ${ADV.DARK}`,
        borderRadius: 0,
        backgroundColor: ADV.CARD,
      }}
    >
      {/* ---- Date rail -------------------------------------------------- */}
      <div
        className="flex-shrink-0 flex flex-col items-center justify-center gap-0 py-4"
        style={{
          width: 80,
          backgroundColor: ADV.TERRACOTTA,
          fontFamily: ADV_FONT,
        }}
      >
        <span
          className="font-bold text-white leading-none"
          style={{ fontSize: "0.6875rem", letterSpacing: "0.1em" }}
        >
          {month}
        </span>
        <span
          className="font-bold text-white leading-none mt-0.5"
          style={{ fontSize: "1.5rem", letterSpacing: "-0.01em" }}
        >
          {String(day).padStart(2, "0")}
        </span>
        <span
          className="font-bold text-white leading-none mt-0.5"
          style={{ fontSize: "0.6875rem", letterSpacing: "0.1em" }}
        >
          {weekday}
        </span>
        {timeLabel && (
          <span
            className="font-bold text-white leading-none mt-1.5"
            style={{
              fontSize: "0.625rem",
              letterSpacing: "0.06em",
              opacity: 0.85,
            }}
          >
            {timeLabel}
          </span>
        )}
      </div>

      {/* ---- Content ---------------------------------------------------- */}
      <div className="flex-1 min-w-0 flex gap-3 p-3">
        <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
          {/* Title */}
          <Link
            href={primaryHref}
            target={isExternal ? "_blank" : undefined}
            rel={isExternal ? "noopener noreferrer" : undefined}
            className="font-bold leading-tight hover:underline line-clamp-2"
            style={{
              fontFamily: ADV_FONT,
              fontSize: "1.0625rem",
              color: ADV.DARK,
            }}
          >
            {title}
          </Link>

          {/* Venue + neighborhood */}
          {(venueName ?? neighborhood) && (
            <p
              className="text-sm leading-snug"
              style={{ fontFamily: ADV_FONT, color: ADV.STONE }}
            >
              {venueHref && venueName ? (
                <Link
                  href={venueHref}
                  className="hover:underline"
                  style={{ color: ADV.STONE }}
                >
                  {venueName}
                </Link>
              ) : (
                venueName
              )}
              {venueName && neighborhood && (
                <span style={{ opacity: 0.5 }}> · </span>
              )}
              {neighborhood}
            </p>
          )}

          {/* Source attribution */}
          {sourceName && (
            <p
              className="text-xs leading-snug italic"
              style={{ fontFamily: ADV_FONT, color: ADV.STONE, opacity: 0.75 }}
            >
              {sourceName}
            </p>
          )}

          {/* Tags */}
          {visibleTags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {visibleTags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 text-xs font-bold uppercase"
                  style={{
                    fontFamily: ADV_FONT,
                    letterSpacing: "0.08em",
                    backgroundColor: `${ADV.OLIVE}18`,
                    color: ADV.OLIVE,
                    border: `1px solid ${ADV.OLIVE}40`,
                    borderRadius: 0,
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ---- Thumbnail ------------------------------------------------ */}
        {thumbnail && (
          <div
            className="flex-shrink-0 self-center overflow-hidden"
            style={{
              width: 64,
              height: 64,
              border: `1px solid ${ADV.DARK}`,
              borderRadius: 0,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={thumbnail}
              alt=""
              width={64}
              height={64}
              className="w-full h-full object-cover"
            />
          </div>
        )}
      </div>
    </div>
  );
});

export type { AdventureEventCardProps as AdventureEventCardType };

// ---- Skeleton ------------------------------------------------------------

export function AdventureEventCardSkeleton() {
  return (
    <div
      className="flex overflow-hidden animate-pulse"
      style={{
        border: `2px solid ${ADV.DARK}`,
        borderRadius: 0,
      }}
    >
      {/* Date rail skeleton */}
      <div
        className="flex-shrink-0"
        style={{
          width: 80,
          height: 96,
          backgroundColor: `${ADV.STONE}12`,
        }}
      />
      {/* Content skeleton */}
      <div className="flex-1 p-3 flex flex-col gap-2 justify-center">
        <div
          className="h-4 w-3/4 rounded-none"
          style={{ backgroundColor: `${ADV.STONE}12` }}
        />
        <div
          className="h-3 w-1/2 rounded-none"
          style={{ backgroundColor: `${ADV.STONE}12` }}
        />
        <div
          className="h-3 w-1/3 rounded-none"
          style={{ backgroundColor: `${ADV.STONE}12` }}
        />
      </div>
    </div>
  );
}
