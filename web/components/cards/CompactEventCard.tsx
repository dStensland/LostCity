"use client";

import { memo } from "react";
import Link from "next/link";
import {
  Ticket,
  MusicNote,
  FilmSlate,
  MicrophoneStage,
  MaskHappy,
  GraduationCap,
} from "@phosphor-icons/react";
import Dot from "@/components/ui/Dot";
import type { DiscoveryEventEntity } from "@/lib/types/discovery";

const MUSIC_ACCENT = "#A78BFA";
const DEFAULT_ACCENT = "#FF6B7A";

type PhosphorIcon = React.ComponentType<{
  size?: number;
  color?: string;
  weight?: "duotone" | "regular" | "bold" | "fill" | "thin" | "light";
}>;

function getCategoryIcon(categoryId: string | null): PhosphorIcon {
  switch (categoryId) {
    case "film":
      return FilmSlate;
    case "music":
      return MicrophoneStage;
    case "comedy":
      return MaskHappy;
    case "theater":
      return MaskHappy;
    case "education":
      return GraduationCap;
    default:
      return Ticket;
  }
}

function getAccentColor(entity: DiscoveryEventEntity): string {
  const cat = entity.category_id ?? "";
  const placeType = entity.place_type ?? "";
  if (
    cat === "music" ||
    placeType === "music_venue" ||
    placeType === "amphitheater" ||
    placeType === "arena" ||
    placeType === "stadium"
  ) {
    return MUSIC_ACCENT;
  }
  return DEFAULT_ACCENT;
}

function formatTimeSplit(time: string | null): {
  hour: string;
  period: string;
} | null {
  if (!time) return null;
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hr = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const min = m > 0 ? `:${m.toString().padStart(2, "0")}` : "";
  return { hour: `${hr}${min}`, period };
}

function formatSmartDate(dateStr: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const eventDate = new Date(dateStr + "T00:00:00");
  const diffDays = Math.round(
    (eventDate.getTime() - today.getTime()) / 86400000
  );
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays < 7)
    return eventDate.toLocaleDateString("en-US", { weekday: "short" });
  return eventDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

interface CompactEventCardProps {
  entity: DiscoveryEventEntity;
  portalSlug: string;
}

export const CompactEventCard = memo(function CompactEventCard({
  entity,
  portalSlug,
}: CompactEventCardProps) {
  const href = `/${portalSlug}?event=${entity.id}`;
  const accent = getAccentColor(entity);
  const timeSplit = formatTimeSplit(entity.start_time);
  const dateLabel = formatSmartDate(entity.start_date);
  const CategoryIcon = getCategoryIcon(entity.category_id ?? null);
  const primaryGenre =
    entity.genres && entity.genres.length > 0 ? entity.genres[0] : null;

  return (
    <Link
      href={href}
      className="flex items-stretch rounded-card border border-[var(--twilight)] bg-[var(--night)] overflow-hidden hover:bg-[var(--dusk)] transition-colors"
      style={{ borderLeftColor: accent, borderLeftWidth: "3px" }}
    >
      {/* Time block: 56px fixed width */}
      <div className="flex w-14 flex-shrink-0 flex-col items-center justify-center bg-[var(--dusk)] px-1 py-2">
        {timeSplit ? (
          <>
            <span className="font-mono text-base font-bold leading-none text-[var(--cream)] tabular-nums">
              {timeSplit.hour}
            </span>
            <span className="font-mono text-2xs font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
              {timeSplit.period}
            </span>
          </>
        ) : (
          <span className="font-mono text-xs text-[var(--muted)]">
            {dateLabel}
          </span>
        )}
        {timeSplit && (
          <span className="font-mono text-2xs text-[var(--muted)] mt-0.5">
            {dateLabel}
          </span>
        )}
      </div>

      {/* Content column */}
      <div className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2.5">
        {/* Icon box */}
        <div
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${accent}1A` }}
        >
          <CategoryIcon size={15} color={accent} weight="duotone" />
        </div>

        {/* Text content */}
        <div className="min-w-0 flex-1">
          {/* Title */}
          <div className="truncate text-sm font-semibold text-[var(--cream)] leading-tight">
            {entity.name}
          </div>

          {/* Venue · neighborhood */}
          <div className="flex items-center gap-1 text-2xs text-[var(--muted)]">
            {entity.venue_name && (
              <span className="truncate">{entity.venue_name}</span>
            )}
            {entity.venue_name && entity.neighborhood && <Dot />}
            {entity.neighborhood && (
              <span className="truncate">{entity.neighborhood}</span>
            )}
          </div>

          {/* Price / genre badges */}
          <div className="flex items-center gap-1 mt-0.5">
            {entity.is_free ? (
              <span
                className="inline-flex items-center rounded px-1.5 py-0.5 font-mono text-2xs"
                style={{
                  backgroundColor: "rgba(0, 217, 160, 0.15)",
                  color: "#00D9A0",
                }}
              >
                Free
              </span>
            ) : entity.price_min !== null && entity.price_min > 0 ? (
              <span className="font-mono text-2xs text-[var(--muted)]">
                ${entity.price_min}+
              </span>
            ) : null}
            {primaryGenre && (
              <span
                className="inline-flex items-center rounded px-1.5 py-0.5 font-mono text-2xs capitalize"
                style={{
                  backgroundColor: `${accent}15`,
                  color: accent,
                }}
              >
                {primaryGenre.replace(/_/g, " ")}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
});

export type { CompactEventCardProps };
