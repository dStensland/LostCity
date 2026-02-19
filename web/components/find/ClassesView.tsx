"use client";

import { useState, useEffect, useCallback, useRef, useMemo, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { Event } from "@/lib/supabase";
import { format, parseISO, isToday, isTomorrow, isThisWeek } from "date-fns";
import { formatTimeSplit } from "@/lib/formats";
import CategoryIcon, { getCategoryColor, getCategoryLabel } from "@/components/CategoryIcon";
import SeriesCard, { type SeriesInfo, type SeriesVenueGroup } from "@/components/SeriesCard";
import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClass } from "@/lib/css-utils";
import { getReflectionClass } from "@/lib/card-utils";
import {
  createFindFilterSnapshot,
  trackFindZeroResults,
} from "@/lib/analytics/find-tracking";

interface ClassesViewProps {
  portalId: string;
  portalSlug: string;
}

type ClassEvent = Event & {
  going_count?: number;
  interested_count?: number;
  recommendation_count?: number;
};

const CLASS_CATEGORIES = [
  { key: "all", label: "All Classes", icon: "other" },
  { key: "painting", label: "Painting", icon: "art" },
  { key: "cooking", label: "Cooking", icon: "cooking" },
  { key: "pottery", label: "Pottery", icon: "art" },
  { key: "dance", label: "Dance", icon: "dance" },
  { key: "fitness", label: "Fitness", icon: "fitness" },
  { key: "woodworking", label: "Woodworking", icon: "learning" },
  { key: "floral", label: "Floral", icon: "garden" },
  { key: "photography", label: "Photography", icon: "film" },
  { key: "candle-making", label: "Candles", icon: "markets" },
  { key: "outdoor-skills", label: "Outdoor", icon: "outdoors" },
  { key: "crafts", label: "Crafts", icon: "art" },
  { key: "mixed", label: "Mixed", icon: "community" },
] as const;

type ClassCategoryKey = (typeof CLASS_CATEGORIES)[number]["key"];
const CLASS_CATEGORY_KEYS = new Set<ClassCategoryKey>(
  CLASS_CATEGORIES.map((category) => category.key),
);

function isClassCategoryKey(value: string): value is ClassCategoryKey {
  return CLASS_CATEGORY_KEYS.has(value as ClassCategoryKey);
}

const CLASS_DATE_WINDOWS = [
  { key: "upcoming", label: "Upcoming" },
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "weekend", label: "Weekend" },
] as const;

type ClassDateWindowKey = (typeof CLASS_DATE_WINDOWS)[number]["key"];
const CLASS_DATE_WINDOW_KEYS = new Set<ClassDateWindowKey>(
  CLASS_DATE_WINDOWS.map((option) => option.key),
);

function isClassDateWindowKey(value: string): value is ClassDateWindowKey {
  return CLASS_DATE_WINDOW_KEYS.has(value as ClassDateWindowKey);
}

const CLASS_SKILL_OPTIONS = [
  { key: "all", label: "All Levels" },
  { key: "beginner", label: "Beginner" },
  { key: "all-levels", label: "All-levels classes" },
  { key: "intermediate", label: "Intermediate" },
  { key: "advanced", label: "Advanced" },
] as const;

type ClassSkillKey = (typeof CLASS_SKILL_OPTIONS)[number]["key"];
const CLASS_SKILL_KEYS = new Set<ClassSkillKey>(
  CLASS_SKILL_OPTIONS.map((option) => option.key),
);

function isClassSkillKey(value: string): value is ClassSkillKey {
  return CLASS_SKILL_KEYS.has(value as ClassSkillKey);
}

const PAGE_SIZE = 50; // Keep in sync with /api/classes max limit

const PAINT_TWIST_PATTERN = /painting with a twist/i;

function isPaintTwistVenue(name?: string | null): boolean {
  if (!name) return false;
  return PAINT_TWIST_PATTERN.test(name);
}

function getPaintTwistLocation(name: string): string {
  let cleaned = name.replace(PAINT_TWIST_PATTERN, "").trim();
  cleaned = cleaned.replace(/^[\s\-–—|:]+/, "").trim();
  cleaned = cleaned.replace(/^\((.*)\)$/, "$1").trim();
  return cleaned || "Main Studio";
}

function formatLocationList(locations: string[]): string {
  const unique = Array.from(new Set(locations.map((loc) => loc.trim()).filter(Boolean)));
  if (unique.length <= 3) return unique.join(" · ");
  return `${unique.slice(0, 3).join(" · ")} +${unique.length - 3} more`;
}

function toIsoDate(value: Date): string {
  return format(value, "yyyy-MM-dd");
}

function addDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

function resolveClassDateWindow(window: string): { startDate?: string; endDate?: string } {
  if (window === "upcoming") return {};

  const today = new Date();
  today.setHours(12, 0, 0, 0);

  if (window === "today") {
    const date = toIsoDate(today);
    return { startDate: date, endDate: date };
  }

  if (window === "week") {
    return {
      startDate: toIsoDate(today),
      endDate: toIsoDate(addDays(today, 7)),
    };
  }

  if (window === "weekend") {
    const day = today.getDay(); // 0 = Sun, 5 = Fri, 6 = Sat
    let start = today;
    let end = today;

    if (day >= 1 && day <= 4) {
      const daysUntilFriday = 5 - day;
      start = addDays(today, daysUntilFriday);
      end = addDays(start, 2);
    } else if (day === 5) {
      start = today;
      end = addDays(today, 2);
    } else if (day === 6) {
      start = today;
      end = addDays(today, 1);
    }

    return {
      startDate: toIsoDate(start),
      endDate: toIsoDate(end),
    };
  }

  return {};
}

// Types for grouping
interface VenueGroup {
  venueId: number | null;
  venueName: string;
  venueSlug: string | null;
  classes: ClassEvent[];
  locations?: string[];
  locationGroups?: { location: string; classes: ClassEvent[] }[];
}

interface SeriesGroup {
  series: SeriesInfo;
  venueGroups: SeriesVenueGroup[];
}

interface DayGroup {
  date: string;
  label: string;
  venues: VenueGroup[];
  seriesGroups: SeriesGroup[];
  totalClasses: number;
}

function buildSeriesVenueGroups(classes: ClassEvent[]): SeriesVenueGroup[] {
  const venueMap = new Map<number, { venue: SeriesVenueGroup["venue"]; events: ClassEvent[] }>();

  for (const cls of classes) {
    if (!cls.venue) continue;
    const existing = venueMap.get(cls.venue.id);
    if (existing) {
      existing.events.push(cls);
    } else {
      venueMap.set(cls.venue.id, {
        venue: {
          id: cls.venue.id,
          name: cls.venue.name,
          slug: cls.venue.slug,
          neighborhood: cls.venue.neighborhood,
        },
        events: [cls],
      });
    }
  }

  const venueGroups: SeriesVenueGroup[] = [];
  for (const { venue, events } of venueMap.values()) {
    events.sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));
    venueGroups.push({
      venue,
      showtimes: events.map((e) => ({
        id: e.id,
        time: e.start_time,
        ticket_url: e.ticket_url,
        source_url: e.source_url,
      })),
    });
  }

  venueGroups.sort((a, b) =>
    (a.showtimes[0]?.time || "").localeCompare(b.showtimes[0]?.time || "")
  );

  return venueGroups;
}

// Group classes by day, then consolidate series and venues within each day
function groupClassesByDayAndVenue(classes: ClassEvent[]): DayGroup[] {
  // First pass: group by date
    const byDate: Record<string, ClassEvent[]> = {};
  for (const cls of classes) {
    const date = cls.start_date;
    if (!byDate[date]) {
      byDate[date] = [];
    }
    byDate[date].push(cls);
  }

  // Second pass: for each date, group by venue
  return Object.keys(byDate)
    .sort()
    .map((date) => {
      const classesOnDate = byDate[date];
      const parsed = parseISO(date);

      // Label for the day
      let label: string;
      if (isToday(parsed)) {
        label = "Today";
      } else if (isTomorrow(parsed)) {
        label = "Tomorrow";
      } else if (isThisWeek(parsed, { weekStartsOn: 1 })) {
        label = format(parsed, "EEEE");
      } else {
        label = format(parsed, "EEEE, MMMM d");
      }

      // Group by series first, then venue for standalone classes
      const seriesMap = new Map<string, { series: SeriesInfo; events: ClassEvent[] }>();
      const standalone: ClassEvent[] = [];
      const paintTwistClasses: ClassEvent[] = [];

      for (const cls of classesOnDate) {
        // PWAT events always go to venue grouping (not series cards)
        if (isPaintTwistVenue(cls.venue?.name)) {
          paintTwistClasses.push(cls);
        } else if (cls.series_id && cls.series) {
          const seriesInfo = cls.series as unknown as SeriesInfo;
          const existing = seriesMap.get(cls.series_id);
          if (existing) {
            existing.events.push(cls);
          } else {
            seriesMap.set(cls.series_id, { series: seriesInfo, events: [cls] });
          }
        } else {
          standalone.push(cls);
        }
      }

      const seriesGroups = Array.from(seriesMap.values())
        .map(({ series, events }) => {
          const goingCount = events.reduce(
            (sum, event) => sum + (event.going_count ?? 0),
            0
          );
          const interestedCount = events.reduce(
            (sum, event) => sum + (event.interested_count ?? 0),
            0
          );
          const recommendationCount = events.reduce(
            (sum, event) => sum + (event.recommendation_count ?? 0),
            0
          );
          return {
            series: {
              ...series,
              rsvp_count: goingCount > 0 ? goingCount : undefined,
              interested_count: interestedCount > 0 ? interestedCount : undefined,
              recommendation_count: recommendationCount > 0 ? recommendationCount : undefined,
            },
            venueGroups: buildSeriesVenueGroups(events),
          };
        })
        .sort((a, b) => a.series.title.localeCompare(b.series.title));

      // Group standalone classes by venue
      const venueMap: Record<string, VenueGroup> = {};
      for (const cls of standalone) {
        const venueKey = cls.venue?.id?.toString() || "unknown";
        if (!venueMap[venueKey]) {
          venueMap[venueKey] = {
            venueId: cls.venue?.id || null,
            venueName: cls.venue?.name || "Unknown Venue",
            venueSlug: cls.venue?.slug || null,
            classes: [],
          };
        }
        venueMap[venueKey].classes.push(cls);
      }

      // Sort venues by number of classes (most first), then alphabetically
      let venues = Object.values(venueMap);

      if (paintTwistClasses.length > 0) {
        const locationMap = new Map<string, ClassEvent[]>();
        for (const cls of paintTwistClasses) {
          const location = getPaintTwistLocation(cls.venue?.name || "");
          const list = locationMap.get(location) || [];
          list.push(cls);
          locationMap.set(location, list);
        }

        const locationGroups = Array.from(locationMap.entries())
          .map(([location, groupClasses]) => {
            const sorted = [...groupClasses].sort((a, b) => {
              const timeA = a.start_time || "00:00";
              const timeB = b.start_time || "00:00";
              return timeA.localeCompare(timeB);
            });
            return { location, classes: sorted };
          })
          .sort((a, b) => a.location.localeCompare(b.location));

        const locations = locationGroups.map((group) => group.location);

        venues.push({
          venueId: null,
          venueName: "Painting with a Twist",
          venueSlug: null,
          classes: paintTwistClasses,
          locations,
          locationGroups,
        });
      }

      venues = venues.sort((a, b) => {
        if (b.classes.length !== a.classes.length) {
          return b.classes.length - a.classes.length;
        }
        return a.venueName.localeCompare(b.venueName);
      });

      // Sort classes within each venue by time
      for (const venue of venues) {
        venue.classes.sort((a, b) => {
          const timeA = a.start_time || "00:00";
          const timeB = b.start_time || "00:00";
          return timeA.localeCompare(timeB);
        });
      }

      return {
        date,
        label,
        venues,
        seriesGroups,
        totalClasses: classesOnDate.length,
      };
    });
}

// Custom dropdown with category icons
function CategoryDropdown({
  category,
  onSelect,
}: {
  category: string;
  onSelect: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selected = CLASS_CATEGORIES.find((c) => c.key === category) || CLASS_CATEGORIES[0];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="h-9 inline-flex items-center gap-2 bg-[var(--night)]/78 border border-[var(--twilight)]/80 rounded-full px-3.5 font-mono text-xs cursor-pointer hover:border-[var(--coral)]/50 hover:bg-[var(--dusk)]/70 transition-colors"
      >
        <span data-category={selected.icon} className="category-icon">
          <CategoryIcon type={selected.icon} size={14} glow="subtle" />
        </span>
        <span className="text-[var(--cream)]">{selected.label}</span>
        <svg
          className={`w-3 h-3 text-[var(--muted)] transition-transform duration-200 ml-1 ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-56 bg-[var(--night)] border border-[var(--twilight)] rounded-lg shadow-xl shadow-black/40 overflow-hidden">
          {CLASS_CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => {
                onSelect(cat.key);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-left font-mono text-xs transition-colors ${
                category === cat.key
                  ? "bg-[var(--coral)]/15 text-[var(--coral)]"
                  : "text-[var(--soft)] hover:bg-[var(--twilight)]/30 hover:text-[var(--cream)]"
              }`}
            >
              <span data-category={cat.icon} className="category-icon flex-shrink-0">
                <CategoryIcon type={cat.icon} size={14} glow={category === cat.key ? "default" : "none"} />
              </span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Compact class row for venue rollups
function ClassRow({
  cls,
  portalSlug,
}: {
  cls: ClassEvent;
  portalSlug: string;
}) {
  const { time, period } = formatTimeSplit(cls.start_time);
  const timeLabel = cls.is_all_day ? "All Day" : `${time}${period ? ` ${period}` : ""}`;
  const categoryLabel = getCategoryLabel(cls.class_category || cls.category || "learning");
  const rowAccentColor = getCategoryColor(cls.class_category || cls.category || "learning");

  return (
    <Link
      href={`/${portalSlug}?event=${cls.id}`}
      scroll={false}
      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 py-2.5 rounded-lg border border-[var(--twilight)]/55 bg-[var(--void)]/35 hover:bg-[var(--twilight)]/22 hover:border-[var(--accent-color)]/45 transition-all group"
      style={{ "--accent-color": rowAccentColor } as CSSProperties}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="flex-shrink-0 font-mono text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-[var(--accent-color)] min-w-[72px]">
          {timeLabel}
        </span>
        <span className="flex-1 min-w-0 truncate text-sm text-[var(--cream)] group-hover:text-[var(--accent-color,var(--coral))] transition-colors">
          {cls.title}
        </span>
        <span className="max-w-[86px] sm:max-w-[120px] truncate flex-shrink-0 font-mono text-[0.62rem] font-medium uppercase tracking-[0.08em] text-[var(--muted)]">
          {categoryLabel}
        </span>
      </div>

      <span className="inline-flex w-8 h-8 items-center justify-center rounded-lg border border-[var(--twilight)]/70 bg-[var(--dusk)]/72 text-[var(--muted)] group-hover:text-[var(--cream)] group-hover:border-[var(--accent-color)]/55 transition-all">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 3h7v7m0-7L10 14" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10v8a1 1 0 001 1h8" />
        </svg>
      </span>
    </Link>
  );
}

// Venue section within a day — matches EventGroup card styling
// Single-class venues render flat (no accordion), multi-class venues get expand/collapse
function VenueSection({
  venue,
  portalSlug,
  defaultOpen,
}: {
  venue: VenueGroup;
  portalSlug: string;
  defaultOpen: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const isSingle = venue.classes.length === 1 && !venue.locationGroups;

  // Derive dominant category from classes for accent color
  const dominantCategory = venue.classes[0]?.category || null;
  const categoryColor = dominantCategory ? getCategoryColor(dominantCategory) : null;
  const reflectionClass = getReflectionClass(dominantCategory);
  const accentColor = categoryColor || "var(--neon-magenta)";
  const accentClass = createCssVarClass("--accent-color", accentColor, "accent");

  // Single class: render the same card shell for consistency, without accordion behavior
  if (isSingle) {
    const cls = venue.classes[0];
    const timeParts = cls.is_all_day
      ? { time: "All Day", period: "" }
      : formatTimeSplit(cls.start_time);
    const categoryLabel = getCategoryLabel(cls.class_category || cls.category || "learning");

    return (
      <>
        <ScopedStyles css={accentClass?.css} />
        <div
          className={`find-row-card rounded-2xl border border-[var(--twilight)]/75 overflow-hidden ${reflectionClass} ${accentClass?.className ?? ""} ${
            categoryColor ? "border-l-[2px] border-l-[var(--accent-color)]" : ""
          }`}
        >
          <Link href={`/${portalSlug}?event=${cls.id}`} scroll={false} className="group block">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 sm:gap-3">
              <div className="min-w-0 p-3.5 sm:p-4 group-hover:bg-[var(--twilight)]/10 transition-colors">
                <div className="flex gap-3 sm:gap-4">
                  <div className="hidden sm:flex flex-shrink-0 self-stretch relative w-[124px] -ml-3.5 sm:-ml-4 -my-3.5 sm:-my-4 overflow-hidden list-rail-media border-r border-[var(--twilight)]/60">
                    <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/56 to-black/20 pointer-events-none" />
                    <div className="relative z-10 flex h-full flex-col items-start justify-center gap-1.5 pl-3 pr-2 py-3 sm:py-4">
                      <span className="font-mono text-[0.62rem] font-semibold text-[var(--accent-color)] leading-none uppercase tracking-[0.12em]">
                        1 class
                      </span>
                      <span className="font-mono text-[1.42rem] font-bold leading-none tabular-nums text-[var(--cream)]">
                        {timeParts.time}
                      </span>
                      {timeParts.period && (
                        <span className="font-mono text-[0.58rem] font-medium uppercase tracking-[0.12em] text-[var(--soft)]">
                          {timeParts.period}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0 text-left">
                    <div className="sm:hidden flex items-center gap-2 mb-2">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-accent-20 border border-[var(--twilight)]/50">
                        <CategoryIcon type={dominantCategory || "learning"} size={14} glow="subtle" />
                      </span>
                      <span className="font-mono text-[0.66rem] font-semibold uppercase tracking-[0.1em] text-[var(--accent-color)] truncate">
                        {timeParts.time}
                        {timeParts.period ? ` ${timeParts.period}` : ""}
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5 mb-1">
                      <span className="hidden sm:inline-flex flex-shrink-0 items-center justify-center w-9 h-9 rounded-lg bg-accent-20 border border-[var(--twilight)]/55">
                        <CategoryIcon type={dominantCategory || "learning"} size={18} glow="subtle" />
                      </span>
                      <span className="font-semibold text-[1.05rem] sm:text-[1.3rem] text-[var(--cream)] group-hover:text-[var(--accent-color)] truncate block transition-colors leading-tight">
                        {cls.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)] mt-1.5 leading-relaxed flex-wrap">
                      <span className="truncate max-w-[75%] sm:max-w-[55%] text-[var(--text-base)]">
                        {venue.venueName}
                      </span>
                      <span className="opacity-40">·</span>
                      <span className="font-mono text-[0.66rem] uppercase tracking-[0.08em] text-[var(--muted)]">
                        1 class
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2 pt-3 pr-3 pb-3 sm:pt-4 sm:pr-4 sm:pb-4 flex-shrink-0">
                <span
                  className={`font-mono text-[0.62rem] px-2 py-1 rounded-full whitespace-nowrap font-medium ${
                    categoryColor ? "bg-accent-20 text-accent border border-[var(--twilight)]/45" : "bg-[var(--twilight)] text-[var(--cream)] border border-[var(--twilight)]/60"
                  }`}
                >
                  {categoryLabel}
                </span>
                <span className="inline-flex w-10 h-10 items-center justify-center rounded-xl border border-[var(--twilight)]/75 bg-[var(--dusk)]/72 text-[var(--muted)] backdrop-blur-[2px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)] group-hover:text-[var(--cream)] group-hover:border-[var(--accent-color)]/55 transition-all">
                  <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 3h7v7m0-7L10 14" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10v8a1 1 0 001 1h8" />
                  </svg>
                </span>
              </div>
            </div>
          </Link>
        </div>
      </>
    );
  }

  // Earliest class time
  const earliestClass = venue.classes[0];
  const timeParts = earliestClass ? formatTimeSplit(earliestClass.start_time) : null;

  return (
    <>
      <ScopedStyles css={accentClass?.css} />
      <div
        className={`find-row-card rounded-2xl border border-[var(--twilight)]/75 overflow-hidden ${reflectionClass} ${accentClass?.className ?? ""} ${
          categoryColor ? "border-l-[2px] border-l-[var(--accent-color)]" : ""
        }`}
      >
        {/* Header — matches EventGroup layout */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="group w-full"
        >
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 sm:gap-3">
            <div className="min-w-0 p-3.5 sm:p-4 group-hover:bg-[var(--twilight)]/10 transition-colors">
              <div className="flex gap-3 sm:gap-4">
                <div className="hidden sm:flex flex-shrink-0 self-stretch relative w-[124px] -ml-3.5 sm:-ml-4 -my-3.5 sm:-my-4 overflow-hidden list-rail-media border-r border-[var(--twilight)]/60">
                  <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/56 to-black/20 pointer-events-none" />
                  <div className="relative z-10 flex h-full flex-col items-start justify-center gap-1.5 pl-3 pr-2 py-3 sm:py-4">
                    <span className="font-mono text-[0.62rem] font-semibold text-[var(--accent-color)] leading-none uppercase tracking-[0.12em]">
                      {venue.classes.length} {venue.classes.length === 1 ? "class" : "classes"}
                    </span>
                    <span className="font-mono text-[1.42rem] font-bold leading-none tabular-nums text-[var(--cream)]">
                      {timeParts?.time || "TBA"}
                    </span>
                    {timeParts?.period && (
                      <span className="font-mono text-[0.58rem] font-medium uppercase tracking-[0.12em] text-[var(--soft)]">
                        {timeParts.period}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex-1 min-w-0 text-left">
                  <div className="sm:hidden flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-accent-20 border border-[var(--twilight)]/50">
                      <CategoryIcon type={dominantCategory || "learning"} size={14} glow="subtle" />
                    </span>
                    <span className="font-mono text-[0.66rem] font-semibold uppercase tracking-[0.1em] text-[var(--accent-color)] truncate">
                      {timeParts?.time || "TBA"}{timeParts?.period ? ` ${timeParts.period}` : ""}
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5 mb-1">
                    <span className="hidden sm:inline-flex flex-shrink-0 items-center justify-center w-9 h-9 rounded-lg bg-accent-20 border border-[var(--twilight)]/55">
                      <CategoryIcon type={dominantCategory || "learning"} size={18} glow="subtle" />
                    </span>
                    {venue.venueSlug ? (
                      <Link
                        href={`/${portalSlug}?spot=${venue.venueSlug}`}
                        scroll={false}
                        onClick={(e) => e.stopPropagation()}
                        className="font-semibold text-[1.05rem] sm:text-[1.3rem] text-[var(--cream)] hover:text-[var(--accent-color)] truncate block transition-colors leading-tight"
                      >
                        {venue.venueName}
                      </Link>
                    ) : (
                      <span className="font-semibold text-[1.05rem] sm:text-[1.3rem] text-[var(--cream)] group-hover:text-[var(--accent-color)] truncate block transition-colors leading-tight">
                        {venue.venueName}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)] mt-1.5 leading-relaxed flex-wrap">
                    {venue.locations && venue.locations.length > 0 && (
                      <span className="truncate max-w-[75%] sm:max-w-[55%] text-[var(--text-base)]" title={formatLocationList(venue.locations)}>
                        {formatLocationList(venue.locations)}
                      </span>
                    )}
                    <span className="opacity-40">·</span>
                    <span className="font-mono text-[0.66rem] uppercase tracking-[0.08em] text-[var(--muted)]">
                      {venue.classes.length} {venue.classes.length === 1 ? "class" : "classes"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2 pt-3 pr-3 pb-3 sm:pt-4 sm:pr-4 sm:pb-4 flex-shrink-0">
              <span
                className={`font-mono text-[0.62rem] px-2 py-1 rounded-full whitespace-nowrap font-medium ${
                  categoryColor ? "bg-accent-20 text-accent border border-[var(--twilight)]/45" : "bg-[var(--twilight)] text-[var(--cream)] border border-[var(--twilight)]/60"
                }`}
              >
                {venue.classes.length}
              </span>
              <span className="inline-flex w-10 h-10 items-center justify-center rounded-xl border border-[var(--twilight)]/75 bg-[var(--dusk)]/72 text-[var(--muted)] backdrop-blur-[2px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)] group-hover:text-[var(--cream)] group-hover:border-[var(--accent-color)]/55 transition-all">
                <svg
                  className={`w-4.5 h-4.5 transition-transform ${isOpen ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </span>
            </div>
          </div>
        </button>

        {/* Expanded class list */}
        {isOpen && (
          <div className="border-t border-[var(--twilight)]/30 py-1">
            {venue.locationGroups && venue.locationGroups.length > 0 ? (
              <div className="space-y-2 py-1">
                {venue.locationGroups.map((group) => (
                  <div key={group.location}>
                    <div className="px-3 py-1 text-[0.6rem] font-mono uppercase tracking-wider text-[var(--muted)]">
                      {group.location}
                    </div>
                    {group.classes.map((cls) => (
                      <ClassRow key={cls.id} cls={cls} portalSlug={portalSlug} />
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              venue.classes.map((cls) => (
                <ClassRow key={cls.id} cls={cls} portalSlug={portalSlug} />
              ))
            )}
          </div>
        )}
      </div>
    </>
  );
}

// Day section header — matches AnimatedEventList date header
function DayHeader({ day }: { day: DayGroup }) {
  return (
    <div
      className="sticky z-20 -mx-4 px-4 py-2.5 sm:py-3 bg-[var(--void)]/90 backdrop-blur-md border-b border-[var(--twilight)]/45"
      style={{ top: "var(--find-list-sticky-top, 52px)" }}
    >
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-mono text-[1.08rem] sm:text-[1.2rem] font-semibold text-[var(--cream)] tracking-tight truncate">
            {day.label}
          </h2>
          <p className="font-mono text-[0.62rem] text-[var(--muted)] uppercase tracking-[0.12em] mt-0.5">
            Class timeline
          </p>
        </div>
        <span className="inline-flex items-center px-2.5 py-1 rounded-full border border-[var(--twilight)]/70 bg-[var(--dusk)]/82 font-mono text-[0.62rem] text-[var(--soft)] whitespace-nowrap">
          {day.totalClasses} {day.totalClasses === 1 ? "class" : "classes"}
        </span>
      </div>
    </div>
  );
}

export default function ClassesView({
  portalId,
  portalSlug,
}: ClassesViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCategory = searchParams?.get("class_category") || "all";
  const initialDateWindow = searchParams?.get("class_date") || "upcoming";
  const initialSkill = searchParams?.get("class_skill") || "all";

  const [classes, setClasses] = useState<ClassEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const [category, setCategory] = useState<ClassCategoryKey>(
    isClassCategoryKey(initialCategory) ? initialCategory : "all",
  );
  const [dateWindow, setDateWindow] = useState<ClassDateWindowKey>(
    isClassDateWindowKey(initialDateWindow) ? initialDateWindow : "upcoming",
  );
  const [skillLevel, setSkillLevel] = useState<ClassSkillKey>(
    isClassSkillKey(initialSkill) ? initialSkill : "all",
  );
  const offsetRef = useRef(0);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const hasLoadedRef = useRef(false);
  const requestIdRef = useRef(0);
  const zeroResultsSignatureRef = useRef<string | null>(null);

  // Keep local control state synced with URL changes (back/forward navigation).
  useEffect(() => {
    const nextCategory = isClassCategoryKey(initialCategory)
      ? initialCategory
      : "all";
    const nextDateWindow = isClassDateWindowKey(initialDateWindow)
      ? initialDateWindow
      : "upcoming";
    const nextSkill = isClassSkillKey(initialSkill) ? initialSkill : "all";

    setCategory((current) => (current === nextCategory ? current : nextCategory));
    setDateWindow((current) => (current === nextDateWindow ? current : nextDateWindow));
    setSkillLevel((current) => (current === nextSkill ? current : nextSkill));
  }, [initialCategory, initialDateWindow, initialSkill]);

  const fetchClasses = useCallback(
    async (
      offset: number,
      cat: string,
      datePreset: string,
      skillPreset: string,
      append = false
    ) => {
      const requestId = ++requestIdRef.current;
      const isInitial = offset === 0;
      const shouldShowSkeleton = isInitial && !hasLoadedRef.current;

      if (shouldShowSkeleton) setLoading(true);
      else if (!isInitial) setLoadingMore(true);

      try {
        const params = new URLSearchParams({
          limit: String(PAGE_SIZE),
          offset: String(offset),
        });
        if (cat !== "all") params.set("class_category", cat);
        const { startDate, endDate } = resolveClassDateWindow(datePreset);
        if (startDate) params.set("start_date", startDate);
        if (endDate) params.set("end_date", endDate);
        if (skillPreset !== "all") params.set("skill_level", skillPreset);
        if (portalId) params.set("portal_id", portalId);

        const res = await fetch(`/api/classes?${params.toString()}`);
        if (!res.ok) return;
        const data = await res.json();

        if (requestId !== requestIdRef.current) return;

        const newClasses = data.classes || [];
        const responseLimit = Math.max(1, Number(data.limit) || PAGE_SIZE);
        const nextOffset = offset + responseLimit;
        if (append) {
          setClasses((prev) => [...prev, ...newClasses]);
        } else {
          setClasses(newClasses);
        }
        setTotal(data.total ?? 0);
        setHasMore(nextOffset < (data.total ?? 0));
        offsetRef.current = nextOffset;
      } catch {
        // fail silently
      } finally {
        if (requestId !== requestIdRef.current) return;
        setLoading(false);
        setLoadingMore(false);
        if (isInitial) {
          hasLoadedRef.current = true;
        }
      }
    },
    [portalId]
  );

  // Keep URL params aligned with active class filters.
  useEffect(() => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    const setOrDelete = (key: string, value: string | null) => {
      if (value) params.set(key, value);
      else params.delete(key);
    };

    setOrDelete("class_category", category !== "all" ? category : null);
    setOrDelete("class_date", dateWindow !== "upcoming" ? dateWindow : null);
    setOrDelete("class_skill", skillLevel !== "all" ? skillLevel : null);

    const next = params.toString();
    const current = searchParams?.toString() || "";
    if (next !== current) {
      router.replace(`/${portalSlug}?${next}`, { scroll: false });
    }
  }, [category, dateWindow, skillLevel, portalSlug, router, searchParams]);

  // Initial load and class filter changes.
  useEffect(() => {
    offsetRef.current = 0;
    hasLoadedRef.current = false;
    requestIdRef.current += 1;
    fetchClasses(0, category, dateWindow, skillLevel);
  }, [category, dateWindow, skillLevel, fetchClasses]);

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loadingMore && !loading) {
          fetchClasses(offsetRef.current, category, dateWindow, skillLevel, true);
        }
      },
      { rootMargin: "400px" }
    );

    if (sentinelRef.current) {
      observerRef.current.observe(sentinelRef.current);
    }

    return () => observerRef.current?.disconnect();
  }, [category, dateWindow, fetchClasses, hasMore, loading, loadingMore, skillLevel]);

  // Group classes by day and venue
  const dayGroups = groupClassesByDayAndVenue(classes);
  const classFilterSnapshot = useMemo(
    () =>
      createFindFilterSnapshot(
        {
          class_category: category !== "all" ? category : undefined,
          class_date: dateWindow !== "upcoming" ? dateWindow : undefined,
          class_skill: skillLevel !== "all" ? skillLevel : undefined,
        },
        "classes"
      ),
    [category, dateWindow, skillLevel]
  );

  useEffect(() => {
    if (!portalSlug || loading) return;
    if (classes.length > 0) {
      zeroResultsSignatureRef.current = null;
      return;
    }
    if (classFilterSnapshot.activeCount === 0) return;
    if (zeroResultsSignatureRef.current === classFilterSnapshot.signature) return;

    trackFindZeroResults({
      portalSlug,
      findType: "classes",
      displayMode: "list",
      surface: "classes_list",
      snapshot: classFilterSnapshot,
      resultCount: classes.length,
    });
    zeroResultsSignatureRef.current = classFilterSnapshot.signature;
  }, [classFilterSnapshot, classes.length, loading, portalSlug]);

  return (
    <div>
      <section className="mb-4 rounded-2xl border border-[var(--twilight)]/80 bg-[var(--void)]/70 backdrop-blur-md p-3 sm:p-4 relative z-30">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <CategoryDropdown category={category} onSelect={setCategory} />
            <select
              value={dateWindow}
              onChange={(event) => setDateWindow(event.target.value)}
              className="h-9 px-3 rounded-lg bg-[var(--night)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-xs focus:outline-none focus:border-[var(--coral)]/50 transition-colors appearance-none cursor-pointer select-chevron-md min-w-[112px]"
              aria-label="Class date window"
            >
              {CLASS_DATE_WINDOWS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              value={skillLevel}
              onChange={(event) => setSkillLevel(event.target.value)}
              className="h-9 px-3 rounded-lg bg-[var(--night)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-xs focus:outline-none focus:border-[var(--coral)]/50 transition-colors appearance-none cursor-pointer select-chevron-md min-w-[122px]"
              aria-label="Class skill level"
            >
              {CLASS_SKILL_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          {!loading && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full border border-[var(--twilight)]/70 bg-[var(--dusk)]/82 font-mono text-[0.62rem] text-[var(--soft)] whitespace-nowrap">
              {total} {total === 1 ? "class" : "classes"} across {dayGroups.length}{" "}
              {dayGroups.length === 1 ? "day" : "days"}
            </span>
          )}
        </div>
      </section>

      {/* Loading state */}
      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-6 w-32 skeleton-shimmer rounded" />
              <div className="h-16 skeleton-shimmer rounded-lg" />
              <div className="h-16 skeleton-shimmer rounded-lg" />
            </div>
          ))}
        </div>
      )}

      {/* Classes grouped by day, then venue */}
      {!loading && dayGroups.length > 0 && (
        <div className="space-y-6">
          {dayGroups.map((day) => (
            <div key={day.date}>
              <DayHeader day={day} />
              {day.seriesGroups.length > 0 && (
                <div className="space-y-3 mt-2">
                  {day.seriesGroups.map((group) => (
                    <SeriesCard
                      key={group.series.id}
                      series={group.series}
                      venueGroups={group.venueGroups}
                      portalSlug={portalSlug}
                      skipAnimation
                      disableMargin
                    />
                  ))}
                </div>
              )}
              {day.venues.length > 0 && (
                <div className="space-y-3 mt-3">
                  {day.venues.map((venue) => (
                    <VenueSection
                      key={venue.venueId || venue.venueName}
                      venue={venue}
                      portalSlug={portalSlug}
                      defaultOpen={false}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && classes.length === 0 && (
        <div className="py-16 text-center">
          <div className="text-[var(--muted)] font-mono text-sm">
            No classes found
          </div>
          <div className="text-[var(--muted)]/60 font-mono text-xs mt-2">
            Try a different category or check back later
          </div>
        </div>
      )}

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} className="h-4" />

      {/* Loading more indicator */}
      {loadingMore && (
        <div className="py-4 text-center">
          <div className="inline-flex items-center gap-2 text-[var(--muted)] font-mono text-xs">
            <div className="w-3 h-3 border border-[var(--coral)] border-t-transparent rounded-full animate-spin" />
            Loading more classes...
          </div>
        </div>
      )}
    </div>
  );
}
