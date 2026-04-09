"use client";

import type { RefObject, CSSProperties } from "react";
import Image from "@/components/SmartImage";
import CategoryIcon, { getCategoryColor } from "@/components/CategoryIcon";

interface DateInfo {
  label: string;
  isHighlight: boolean;
}

interface EventCardImageProps {
  eventId?: number | string;
  railImageUrl: string | undefined;
  railBlurhash: string | null;
  hasRailImage: boolean;
  parallaxContainerRef: RefObject<HTMLDivElement | null>;
  parallaxImageRef: RefObject<HTMLDivElement | null>;
  time: string;
  period: string | null;
  dateInfo: DateInfo;
  category: string | null | undefined;
  eventTitle: string;
  isAllDay: boolean;
}

export function EventCardImage({
  eventId,
  railImageUrl,
  railBlurhash,
  hasRailImage,
  parallaxContainerRef,
  parallaxImageRef,
  time,
  period,
  dateInfo,
  category,
  eventTitle,
  isAllDay,
}: EventCardImageProps) {
  return (
    <div
      ref={parallaxContainerRef}
      className={`hidden sm:flex flex-shrink-0 self-stretch relative w-[100px] -ml-3 sm:-ml-3.5 -my-3 sm:-my-3.5 overflow-hidden border-r border-[var(--twilight)]/60 ${
        hasRailImage ? "list-rail-media" : "bg-[var(--night)]/44"
      }`}
      style={{
        borderTopLeftRadius: "inherit",
        borderBottomLeftRadius: "inherit",
        viewTransitionName: eventId ? `event-hero-${eventId}` : undefined,
      } as CSSProperties}
    >
      {railImageUrl && (
        <div
          ref={parallaxImageRef}
          className="absolute inset-0 transform-gpu will-change-transform"
        >
          <Image
            src={railImageUrl}
            alt={eventTitle}
            fill
            blurhash={railBlurhash}
            sizes="100px"
            className="object-cover"
            fallback={
              <div
                className="absolute inset-0 flex items-center justify-center bg-[var(--night)]"
                style={{ color: getCategoryColor(category) }}
              >
                <CategoryIcon
                  type={category || "other"}
                  size={28}
                  glow="subtle"
                  weight="light"
                />
              </div>
            }
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/56 to-black/20 pointer-events-none" />
        </div>
      )}
      <div className="relative z-10 flex h-full flex-col items-start justify-center gap-1.5 pl-2.5 pr-1.5 py-2.5 sm:py-3 list-rail-caption">
        <span
          className={`font-mono text-2xs font-semibold leading-none uppercase tracking-[0.12em] ${
            dateInfo.isHighlight
              ? "text-[var(--accent-color)]"
              : hasRailImage
                ? "text-[var(--cream)]/85"
                : "text-[var(--muted)]"
          }`}
        >
          {dateInfo.label}
        </span>
        {isAllDay ? (
          <span
            className={`font-mono text-2xs font-semibold leading-none uppercase tracking-[0.12em] ${hasRailImage ? "text-white/82" : "text-[var(--soft)]"}`}
          >
            All Day
          </span>
        ) : (
          <>
            <span
              className={`font-mono text-xl font-bold leading-none tabular-nums ${hasRailImage ? "text-white" : "text-[var(--cream)]"}`}
            >
              {time}
            </span>
            {period && (
              <span
                className={`font-mono text-2xs font-bold uppercase tracking-[0.12em] ${hasRailImage ? "text-white/78" : "text-[var(--soft)]"}`}
              >
                {period}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
