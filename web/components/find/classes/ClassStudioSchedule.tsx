"use client";

import { memo } from "react";
import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react";
import SmartImage from "@/components/SmartImage";
import FilterChip from "@/components/filters/FilterChip";
import { ClassCard, groupClassesBySeries } from "./ClassCard";
import type { ClassEvent } from "./ClassCard";
import type { StudioSummary } from "@/lib/hooks/useClassesData";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ClassStudioScheduleProps {
  schedule: ClassEvent[] | null;
  studioMeta: StudioSummary | null;
  studioSlug: string;
  portalSlug: string;
  loading: boolean;
  error: string | null;
  dateWindow: string | null;
  skillLevel: string | null;
  onFilterChange: (params: Record<string, string | null>) => void;
}

// ---------------------------------------------------------------------------
// Date window labels
// ---------------------------------------------------------------------------

const DATE_WINDOW_OPTIONS: { value: string; label: string }[] = [
  { value: "week", label: "This week" },
  { value: "weekend", label: "This weekend" },
  { value: "2weeks", label: "Next 2 weeks" },
  { value: "all", label: "All upcoming" },
];

const SKILL_LEVEL_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All levels" },
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert a slug like "atlanta-clay-works" → "Atlanta Clay Works" */
function slugToTitle(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function ClassCardSkeleton() {
  return (
    <div
      className="rounded-card bg-[var(--night)] border border-[var(--twilight)]/40 px-3.5 py-3 sm:px-4 sm:py-3.5 animate-pulse"
      aria-hidden
    >
      {/* Title bar */}
      <div className="h-4 w-3/5 rounded bg-[var(--twilight)]" />
      {/* Metadata bar */}
      <div className="mt-2.5 h-3 w-2/5 rounded bg-[var(--twilight)]/70" />
      {/* Pattern bar */}
      <div className="mt-2 h-3 w-4/5 rounded bg-[var(--twilight)]/50" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// ClassStudioSchedule
// ---------------------------------------------------------------------------

export const ClassStudioSchedule = memo(function ClassStudioSchedule({
  schedule,
  studioMeta,
  studioSlug,
  portalSlug,
  loading,
  error,
  dateWindow,
  skillLevel,
  onFilterChange,
}: ClassStudioScheduleProps) {
  // Derive studio metadata from schedule events when studioMeta is unavailable
  // (deep-link scenario where studios cache is empty)
  const derivedVenue = !studioMeta && schedule && schedule.length > 0
    ? schedule.find((e) => e.venue)?.venue ?? null
    : null;
  const derivedImageUrl = !studioMeta && schedule && schedule.length > 0
    ? schedule.find((e) => e.image_url)?.image_url ?? null
    : null;

  const displayName = studioMeta?.name ?? derivedVenue?.name ?? slugToTitle(studioSlug);
  const neighborhood = studioMeta?.neighborhood ?? derivedVenue?.neighborhood ?? null;
  const imageUrl = studioMeta?.image_url ?? derivedImageUrl;
  const hasFullMeta = studioMeta !== null || derivedVenue !== null;

  const activeDate = dateWindow ?? "week";
  const activeSkill = skillLevel ?? "all";

  const grouped = schedule ? groupClassesBySeries(schedule, portalSlug) : [];

  return (
    <div>
      {/* Back navigation */}
      <button
        type="button"
        onClick={() => onFilterChange({ studio: null })}
        className="flex items-center gap-2 text-sm text-[var(--soft)] hover:text-[var(--cream)] transition-colors mb-4"
      >
        <ArrowLeft size={14} />
        Studios
      </button>

      {/* Studio header */}
      <div className="rounded-card overflow-hidden border border-[var(--twilight)]/40 mb-4">
        {/* Hero image */}
        <div className="relative w-full h-[120px] bg-[var(--dusk)]">
          {imageUrl ? (
            <SmartImage
              src={imageUrl}
              alt={displayName}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 600px"
            />
          ) : (
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(135deg, color-mix(in srgb, var(--coral) 18%, var(--night)), color-mix(in srgb, var(--vibe) 18%, var(--night)))",
              }}
            />
          )}
        </div>

        {/* Studio info */}
        <div className="px-4 py-3 bg-[var(--night)]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-xl font-semibold text-[var(--cream)] leading-snug">
                {displayName}
              </h2>
              {neighborhood && (
                <p className="mt-0.5 font-mono text-xs text-[var(--muted)] uppercase tracking-[0.06em]">
                  {neighborhood}
                </p>
              )}
            </div>
            {hasFullMeta && (
              <Link
                href={`/${portalSlug}/spots/${studioSlug}`}
                className="flex-shrink-0 text-xs font-medium text-[var(--coral)] hover:text-[var(--coral)]/80 transition-colors mt-0.5 whitespace-nowrap"
              >
                See venue →
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        {DATE_WINDOW_OPTIONS.map((opt) => (
          <FilterChip
            key={opt.value}
            label={opt.label}
            variant="date"
            active={activeDate === opt.value}
            onClick={() =>
              onFilterChange({ dateWindow: opt.value === "week" ? null : opt.value })
            }
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        {SKILL_LEVEL_OPTIONS.map((opt) => (
          <FilterChip
            key={opt.value}
            label={opt.label}
            variant="default"
            active={activeSkill === opt.value}
            onClick={() =>
              onFilterChange({ skillLevel: opt.value === "all" ? null : opt.value })
            }
          />
        ))}
      </div>

      {/* Class list */}
      {loading ? (
        <div className="space-y-2.5" aria-busy aria-label="Loading classes">
          <ClassCardSkeleton />
          <ClassCardSkeleton />
          <ClassCardSkeleton />
        </div>
      ) : error ? (
        <div className="py-12 text-center">
          <p className="font-mono text-sm text-[var(--muted)]">
            Couldn&apos;t load the schedule — try again.
          </p>
        </div>
      ) : grouped.length === 0 ? (
        <div className="py-12 text-center space-y-2">
          <p className="font-mono text-sm text-[var(--soft)]">
            No upcoming classes at this studio.
          </p>
          <p className="text-xs text-[var(--muted)]">
            Try expanding the date range or removing filters.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {grouped.map((group) => (
            <ClassCard key={group.key} group={group} />
          ))}
        </div>
      )}
    </div>
  );
});

export type { ClassStudioScheduleProps as ClassStudioSchedulePropsType };
