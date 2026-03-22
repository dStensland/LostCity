"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight, CalendarBlank, HandHeart } from "@phosphor-icons/react";
import { formatTime } from "@/lib/formats";
import type { CityPulseSection, CityPulseEventItem } from "@/lib/city-pulse/types";

const VOLUNTEER_EVENT_TAGS = [
  "volunteer",
  "volunteer-opportunity",
  "drop-in",
  "service",
  "mutual aid",
];

const CIVIC_EXCLUSION_TAGS = [
  "government",
  "public-meeting",
  "public-comment",
  "civic-engagement",
  "school-board",
  "npu",
  "zoning",
  "land-use",
];

const CIVIC_EXCLUSION_TITLE_RE =
  /\b(meeting|committee|board|council|hearing|agenda|commission)\b/i;

type VolunteerEvent = CityPulseEventItem["event"];

function todayStart(): Date {
  const now = new Date();
  if (now.getHours() < 5) {
    now.setDate(now.getDate() - 1);
  }
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function addDays(base: Date, days: number): Date {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

export function isVolunteerCommunityEvent(event: VolunteerEvent): boolean {
  const category = (event.category || "").toLowerCase();
  const tags = [...(event.tags || []), ...(event.genres || [])]
    .map((value) => value.toLowerCase());

  const hasCivicExclusionTag = CIVIC_EXCLUSION_TAGS.some((needle) =>
    tags.some((value) => value.includes(needle)),
  );
  if (hasCivicExclusionTag) return false;
  if (CIVIC_EXCLUSION_TITLE_RE.test(event.title)) return false;

  if (category === "volunteer") return true;

  return VOLUNTEER_EVENT_TAGS.some((needle) =>
    tags.some((value) => value.includes(needle)),
  );
}

export function getVolunteerThisWeekItems(sections: CityPulseSection[]): VolunteerEvent[] {
  const start = todayStart();
  const end = addDays(start, 7);
  const seenIds = new Set<number>();
  const seenKeys = new Set<string>();

  return sections
    .flatMap((section) => section.items)
    .filter((item): item is CityPulseEventItem => item.item_type === "event")
    .map((item) => item.event)
    .filter((event) => {
      if (seenIds.has(event.id)) return false;
      seenIds.add(event.id);
      return true;
    })
    .filter((event) => {
      const eventDate = new Date(`${event.start_date}T00:00:00`);
      return eventDate >= start && eventDate <= end;
    })
    .filter(isVolunteerCommunityEvent)
    .filter((event) => {
      const normalizedTitle = event.title.trim().toLowerCase().replace(/\s+/g, " ");
      const dedupeKey = `${normalizedTitle}|${event.start_date}|${event.start_time || "all-day"}`;
      if (seenKeys.has(dedupeKey)) return false;
      seenKeys.add(dedupeKey);
      return true;
    })
    .sort((left, right) => {
      const leftKey = `${left.start_date}T${left.start_time || "23:59:59"}`;
      const rightKey = `${right.start_date}T${right.start_time || "23:59:59"}`;
      return leftKey.localeCompare(rightKey);
    });
}

function formatEventDateLabel(startDate: string, startTime: string | null): string {
  const eventDate = new Date(`${startDate}T00:00:00`);
  const dayLabel = eventDate.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  if (!startTime) return dayLabel;
  return `${dayLabel} · ${formatTime(startTime)}`;
}

export default function VolunteerThisWeekCard({
  portalSlug,
  lineupSections,
  isLoading = false,
}: {
  portalSlug: string;
  lineupSections: CityPulseSection[];
  isLoading?: boolean;
}) {
  const volunteerEvents = useMemo(
    () => getVolunteerThisWeekItems(lineupSections),
    [lineupSections],
  );

  if (volunteerEvents.length === 0 && !isLoading) return null;

  if (volunteerEvents.length === 0 && isLoading) {
    return (
      <section className="mt-4 rounded-2xl border border-[var(--twilight)] bg-[var(--card-bg,var(--night))] p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div
                className="flex h-6 w-6 items-center justify-center rounded-md"
                style={{
                  backgroundColor: "color-mix(in srgb, var(--action-primary) 12%, transparent)",
                }}
              >
                <HandHeart weight="duotone" className="h-3.5 w-3.5 text-[var(--action-primary)]" />
              </div>
              <span className="font-mono text-2xs font-bold uppercase tracking-[0.18em] text-[var(--action-primary)]">
                Volunteer This Week
              </span>
            </div>
            <div className="mt-2 h-4 w-72 max-w-full rounded-full skeleton-shimmer opacity-15" />
          </div>

          <div className="h-7 w-24 rounded-full skeleton-shimmer opacity-15" />
        </div>

        <div className="mt-4 grid gap-3 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div
              key={index}
              className="rounded-xl border border-[var(--twilight)]/70 bg-[var(--night)]/80 p-3"
            >
              <div className="h-3 w-28 rounded-full skeleton-shimmer opacity-15" />
              <div className="mt-3 h-4 w-11/12 rounded-full skeleton-shimmer opacity-15" />
              <div className="mt-2 h-3 w-3/5 rounded-full skeleton-shimmer opacity-10" />
              <div className="mt-3 h-3 w-full rounded-full skeleton-shimmer opacity-10" />
              <div className="mt-2 h-3 w-5/6 rounded-full skeleton-shimmer opacity-10" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="mt-4 rounded-2xl border border-[var(--twilight)] bg-[var(--card-bg,var(--night))] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div
              className="flex h-6 w-6 items-center justify-center rounded-md"
              style={{
                backgroundColor: "color-mix(in srgb, var(--action-primary) 12%, transparent)",
              }}
            >
              <HandHeart weight="duotone" className="h-3.5 w-3.5 text-[var(--action-primary)]" />
            </div>
            <span className="font-mono text-2xs font-bold uppercase tracking-[0.18em] text-[var(--action-primary)]">
              Volunteer This Week
            </span>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-[var(--soft)]">
            Drop-in shifts and community actions you can show up for soon.
          </p>
        </div>

        <span className="rounded-full border border-[var(--action-primary)]/30 bg-[var(--action-primary)]/10 px-3 py-1 font-mono text-2xs font-bold uppercase tracking-[0.14em] text-[var(--action-primary)]">
          {volunteerEvents.length} this week
        </span>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-3">
        {volunteerEvents.slice(0, 3).map((event) => {
          return (
            <Link
              key={event.id}
              href={`/${portalSlug}?event=${event.id}`}
              scroll={false}
              className="rounded-xl border border-[var(--twilight)]/70 bg-[var(--night)]/80 p-3 transition-colors hover:border-[var(--action-primary)]/35"
            >
              <div className="flex items-center gap-2 text-2xs font-mono uppercase tracking-[0.14em] text-[var(--action-primary)]">
                <CalendarBlank weight="duotone" className="h-3.5 w-3.5" />
                {formatEventDateLabel(event.start_date, event.start_time)}
              </div>
              <h3 className="mt-2 text-sm font-semibold text-[var(--cream)] line-clamp-2">
                {event.title}
              </h3>
              <p className="mt-1 text-xs text-[var(--soft)] line-clamp-2">
                {event.venue?.name || "Metro Atlanta"}
                {event.venue?.neighborhood ? ` · ${event.venue.neighborhood}` : ""}
              </p>
              {event.description && (
                <p className="mt-2 text-sm text-[var(--muted)] line-clamp-2">
                  {event.description}
                </p>
              )}
            </Link>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          href={`/${portalSlug}?view=happening&categories=community,volunteer&date=next_7_days`}
          className="inline-flex items-center gap-1 rounded-md border border-[var(--twilight)]/80 px-3 py-1.5 text-xs font-medium text-[var(--cream)] transition-colors hover:border-[var(--action-primary)]/35 hover:text-[var(--action-primary)]"
        >
          See all volunteer events
          <ArrowRight weight="bold" className="h-3.5 w-3.5" />
        </Link>
      </div>
    </section>
  );
}
