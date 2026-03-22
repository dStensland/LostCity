"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Clock } from "@phosphor-icons/react";
import type { EventWithLocation } from "@/lib/search";
import { FAMILY_TOKENS } from "@/lib/family-design-tokens";
import { SectionLabel, SeeAllLink, SkeletonBlock } from "./_shared";

const AMBER = FAMILY_TOKENS.amber;
const SAGE = FAMILY_TOKENS.sage;
const MOSS = FAMILY_TOKENS.moss;
const TEXT = FAMILY_TOKENS.text;
const MUTED = FAMILY_TOKENS.textSecondary;
const CARD = FAMILY_TOKENS.card;
const BORDER = FAMILY_TOKENS.border;

// ---- Helper ----------------------------------------------------------------

function formatTime(timeStr: string | null | undefined): string {
  if (!timeStr) return "";
  const [hourStr, minStr] = timeStr.split(":");
  const hour = parseInt(hourStr, 10);
  const min = minStr ?? "00";
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${min} ${period}`;
}

// ---- TagPill ---------------------------------------------------------------

// Tag pills with kid-colored backgrounds
function TagPill({ tag }: { tag: string }) {
  return (
    <span
      style={{
        backgroundColor: `${MOSS}26`, // 15% opacity
        color: MOSS,
        borderRadius: 8,
        padding: "2px 8px",
        fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
        fontSize: 11,
        fontWeight: 500,
      }}
    >
      {tag}
    </span>
  );
}

// ---- Tag suppression -------------------------------------------------------

// Geographic and redundant tags that add no discovery value on a family portal
const SUPPRESSED_TAGS = new Set([
  "family-friendly",
  "gwinnett",
  "dekalb",
  "fulton",
  "cobb",
  "atlanta",
  "georgia",
  "atl",
  "metro-atlanta",
]);

// ---- AfterSchoolPickCard ---------------------------------------------------

function AfterSchoolPickCard({
  event,
  portalSlug,
}: {
  event: EventWithLocation;
  portalSlug: string;
}) {
  const displayTags = (event.tags ?? [])
    .filter((t) => !SUPPRESSED_TAGS.has(t.toLowerCase()))
    .slice(0, 3);

  return (
    <Link
      href={`/${portalSlug}?event=${event.id}`}
      className="block hover:opacity-80 transition-opacity"
    >
      <div
        className="rounded-xl"
        style={{
          backgroundColor: CARD,
          border: `1px solid ${BORDER}`,
          padding: "10px 14px",
        }}
      >
        <p
          className="leading-snug"
          style={{
            fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
            fontSize: 14,
            fontWeight: 600,
            color: TEXT,
            marginBottom: 3,
          }}
        >
          {event.title}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          {event.venue?.name && (
            <span style={{ fontFamily: "var(--font-dm-sans, system-ui, sans-serif)", fontSize: 12, color: MUTED }}>
              {event.venue.name}
            </span>
          )}
          {event.start_time ? (
            <span
              className="flex items-center gap-1"
              style={{ fontFamily: "var(--font-dm-sans, system-ui, sans-serif)", fontSize: 12, color: MUTED }}
            >
              <Clock size={11} />
              {formatTime(event.start_time)}
            </span>
          ) : event.is_all_day ? (
            <span
              className="flex items-center gap-1"
              style={{ fontFamily: "var(--font-dm-sans, system-ui, sans-serif)", fontSize: 12, color: MUTED }}
            >
              <Clock size={11} />
              All day
            </span>
          ) : null}
          {event.is_free && (
            <span style={{ fontFamily: "var(--font-dm-sans, system-ui, sans-serif)", fontSize: 12, fontWeight: 600, color: SAGE }}>
              Free
            </span>
          )}
        </div>
        {displayTags.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap mt-2">
            {displayTags.map((tag) => (
              <TagPill key={tag} tag={tag} />
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}

// ---- AfterSchoolPicksSection -----------------------------------------------

export function AfterSchoolPicksSection({
  events,
  isLoading,
  portalSlug,
}: {
  events: EventWithLocation[] | undefined;
  isLoading: boolean;
  portalSlug: string;
}) {
  // Title exclusions (applied in all modes):
  //   - /\badult/i  — explicit "Adult" programs (e.g. "Adult Beginner Swim")
  //   - /\bUSTA\b/  — USTA league matches (adult/competitive tennis)
  //   - /\blines\b/i — Tennis league terminology (e.g. "3 Lines", "5 Lines match")
  //
  // Time filter: prefer after-school hours (start_time >= 14:00) to surface the most
  // relevant events. If fewer than 3 pass that filter, fall back to all today's events
  // so the section is never empty on low-data days.
  //
  // Results are sorted chronologically (all-day events first, then by start_time)
  // and source-diversified so no single source dominates the first 4 slots.
  const { afterSchoolEvents, sectionTitle } = useMemo(() => {
    if (!events) return { afterSchoolEvents: [], sectionTitle: "After School Picks" };

    const titleOk = (e: EventWithLocation) =>
      !/\badult/i.test(e.title) &&
      !/\bUSTA\b/.test(e.title) &&
      !/\blines\b/i.test(e.title);

    const afterSchool = events.filter((e) => {
      if (!titleOk(e)) return false;
      if (e.is_all_day) return true;
      if (!e.start_time) return false;
      const hour = parseInt(e.start_time.split(":")[0] ?? "0", 10);
      return hour >= 14;
    });

    // Fall back to all today's events when fewer than 3 pass the after-school filter.
    const useAllDay = afterSchool.length < 3;
    const filtered = useAllDay
      ? events.filter(titleOk)
      : afterSchool;
    const label = useAllDay ? "Happening Today" : "After School Picks";

    // Sort chronologically: all-day events first, then by start_time ascending.
    filtered.sort((a, b) => {
      if (a.is_all_day && !b.is_all_day) return -1;
      if (!a.is_all_day && b.is_all_day) return 1;
      if (!a.start_time && !b.start_time) return 0;
      if (!a.start_time) return 1;
      if (!b.start_time) return -1;
      return a.start_time.localeCompare(b.start_time);
    });

    // Source diversity: interleave so no more than 2 consecutive events share
    // the same source_id. Uses a round-robin pass over remaining items.
    // source_id is selected by the API but not typed in EventWithLocation — cast via unknown.
    type EventWithSourceId = EventWithLocation & { source_id?: number | null };
    const result: typeof filtered = [];
    const remaining = [...filtered] as EventWithSourceId[];
    let consecutiveSameSource = 0;
    let lastSourceId: number | null | undefined = undefined;

    while (remaining.length > 0) {
      // Find the next event that breaks the source run (or allow if no better option)
      const maxConsecutive = 2;
      let chosenIdx = 0;
      if (consecutiveSameSource >= maxConsecutive) {
        const diverseIdx = remaining.findIndex((e) => e.source_id !== lastSourceId);
        if (diverseIdx !== -1) chosenIdx = diverseIdx;
      }
      const [chosen] = remaining.splice(chosenIdx, 1) as [EventWithSourceId];
      if (chosen.source_id === lastSourceId) {
        consecutiveSameSource++;
      } else {
        consecutiveSameSource = 1;
        lastSourceId = chosen.source_id;
      }
      result.push(chosen as EventWithLocation);
    }

    return { afterSchoolEvents: result, sectionTitle: label };
  }, [events]);

  const has = afterSchoolEvents.length > 0;

  // Hide the section entirely when data has loaded and there are 0 events.
  // No fallback card — the Places to Go section and ExploreByType already give
  // users somewhere to go when there's nothing after school today.
  if (!isLoading && !has) return null;

  return (
    <section>
      <SectionLabel
        text={sectionTitle}
        color={AMBER}
        rightSlot={
          has ? (
            <SeeAllLink href={`/${portalSlug}?view=happening&date=today`} />
          ) : undefined
        }
      />
      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => (
            <SkeletonBlock key={i} height={72} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {afterSchoolEvents.slice(0, 4).map((event) => (
            <AfterSchoolPickCard key={event.id} event={event} portalSlug={portalSlug} />
          ))}
        </div>
      )}
    </section>
  );
}
