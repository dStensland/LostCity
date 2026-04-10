"use client";

/**
 * ExhibitionRowCard — compact horizontal exhibition card for non-arts portals.
 *
 * Design:
 *  - Horizontal: thumbnail (96x96) + text content + admission badge
 *  - Platform color tokens only (cream, muted, action-primary) — no arts copper
 *  - Closing countdown badge when within 14 days
 *  - Links to /{portalSlug}/exhibitions/{slug}
 *
 * NOT the arts-specific ExhibitionCard — that one uses ExhibitionCard.tsx
 * with arts-specific copper accent and full-width image layout.
 */

import Link from "next/link";
import SmartImage from "@/components/SmartImage";

export interface ExhibitionRowData {
  id: string;
  slug: string | null;
  title: string;
  image_url: string | null;
  opening_date: string | null;
  closing_date: string | null;
  exhibition_type: string | null;
  admission_type: string | null;
  venue: {
    id: number;
    name: string;
    neighborhood: string | null;
    slug: string | null;
  } | null;
}

interface ExhibitionRowCardProps {
  exhibition: ExhibitionRowData;
  portalSlug: string;
}

/** Days until closing_date. Returns null if no closing date or already closed. */
function daysUntilClose(closingDate: string | null): number | null {
  if (!closingDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(closingDate + "T00:00:00");
  const diff = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diff >= 0 ? diff : null;
}

/** Human-readable date range for an exhibition currently showing. */
function formatDateRange(opening: string | null, closing: string | null): string {
  const fmt = (d: string) => {
    const date = new Date(d + "T00:00:00");
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };
  if (opening && closing) return `${fmt(opening)} – ${fmt(closing)}`;
  if (closing) return `Through ${fmt(closing)}`;
  if (opening) return `Opens ${fmt(opening)}`;
  return "On view";
}

/** Map exhibition_type to a readable label. */
function typeLabel(type: string | null): string | null {
  if (!type) return null;
  const map: Record<string, string> = {
    solo: "Solo",
    group: "Group",
    permanent: "Permanent",
    seasonal: "Seasonal",
    "special-exhibit": "Special Exhibit",
    attraction: "Attraction",
    retrospective: "Retrospective",
    survey: "Survey",
    installation: "Installation",
    pop_up: "Pop-Up",
    pop: "Pop-Up",
  };
  return map[type] ?? type.replace(/-/g, " ");
}

export function ExhibitionRowCard({ exhibition, portalSlug }: ExhibitionRowCardProps) {
  const href = exhibition.slug
    ? `/${portalSlug}/exhibitions/${exhibition.slug}`
    : `/${portalSlug}/exhibitions`;

  const days = daysUntilClose(exhibition.closing_date);
  const isClosingSoon = days !== null && days <= 14;

  const dateText = formatDateRange(exhibition.opening_date, exhibition.closing_date);
  const isFree = exhibition.admission_type === "free";
  const type = typeLabel(exhibition.exhibition_type);

  return (
    <Link
      href={href}
      className="group flex items-center gap-3 py-2.5 hover:opacity-80 transition-opacity"
    >
      {/* Thumbnail */}
      <div className="relative w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-[var(--twilight)]">
        {exhibition.image_url ? (
          <SmartImage
            src={exhibition.image_url}
            alt=""
            fill
            className="object-cover"
            sizes="80px"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg
              className="w-6 h-6 text-[var(--muted)] opacity-40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
          </div>
        )}

        {/* Closing countdown — overlay on thumbnail */}
        {isClosingSoon && days !== null && (
          <span
            className="absolute bottom-1 left-1 px-1.5 py-0.5 font-mono text-2xs font-bold uppercase tracking-wider rounded"
            style={{
              backgroundColor: days <= 3 ? "var(--coral)" : "rgba(15,15,20,0.85)",
              color: days <= 3 ? "var(--void)" : "var(--cream)",
            }}
          >
            {days === 0 ? "Today" : days === 1 ? "1d left" : `${days}d left`}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-semibold text-[var(--cream)] leading-snug line-clamp-2 group-hover:text-[var(--action-primary)] transition-colors">
          {exhibition.title}
        </h4>

        {exhibition.venue?.name && (
          <p className="mt-0.5 text-xs text-[var(--soft)] truncate">
            {exhibition.venue.name}
            {exhibition.venue.neighborhood && (
              <span className="text-[var(--muted)]"> · {exhibition.venue.neighborhood}</span>
            )}
          </p>
        )}

        <p className="mt-1 font-mono text-xs text-[var(--muted)]">{dateText}</p>
      </div>

      {/* Right badges */}
      <div className="flex-shrink-0 flex flex-col items-end gap-1">
        {isFree && (
          <span className="px-1.5 py-0.5 font-mono text-2xs font-bold uppercase tracking-wider rounded bg-[var(--neon-green)]/15 text-[var(--neon-green)]">
            Free
          </span>
        )}
        {type && (
          <span className="px-1.5 py-0.5 font-mono text-2xs uppercase tracking-wider rounded bg-[var(--twilight)] text-[var(--muted)]">
            {type}
          </span>
        )}
      </div>
    </Link>
  );
}

export type { ExhibitionRowCardProps };
