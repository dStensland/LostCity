"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import type { Event } from "@/lib/supabase";
import { format, parseISO, isToday, isTomorrow, isThisWeek } from "date-fns";
import { formatTimeSplit, formatCompactCount } from "@/lib/formats";
import CategoryIcon from "@/components/CategoryIcon";
import SeriesCard, { type SeriesInfo, type SeriesVenueGroup } from "@/components/SeriesCard";

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

const PAGE_SIZE = 100; // Fetch more to fill multiple days/venues

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
        if (cls.series_id && cls.series) {
          const seriesInfo = cls.series as unknown as SeriesInfo;
          const existing = seriesMap.get(cls.series_id);
          if (existing) {
            existing.events.push(cls);
          } else {
            seriesMap.set(cls.series_id, { series: seriesInfo, events: [cls] });
          }
        } else if (isPaintTwistVenue(cls.venue?.name)) {
          paintTwistClasses.push(cls);
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
    <div ref={dropdownRef} className="relative mb-4">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 bg-[var(--night)] border border-[var(--twilight)] rounded-lg px-3 py-2 font-mono text-xs cursor-pointer hover:border-[var(--coral)]/50 transition-colors"
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
        <div className="absolute z-50 mt-1 w-52 bg-[var(--night)] border border-[var(--twilight)] rounded-lg shadow-xl shadow-black/40 overflow-hidden">
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
  const goingCount = cls.going_count ?? 0;
  const interestedCount = cls.interested_count ?? 0;
  const recommendationCount = cls.recommendation_count ?? 0;
  const hasSocialProof = goingCount > 0 || interestedCount > 0 || recommendationCount > 0;

  return (
    <Link
      href={`/${portalSlug}?event=${cls.id}`}
      scroll={false}
      className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-[var(--twilight)]/30 transition-colors group"
    >
      {/* Time */}
      <div className="w-16 flex-shrink-0 font-mono text-sm text-[var(--soft)]">
        {time}
        <span className="text-[var(--muted)] text-xs">{period}</span>
      </div>

      {/* Category icon */}
      {cls.category && (
        <span
          data-category={cls.category}
          className="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center class-row-category"
        >
          <CategoryIcon type={cls.category} size={12} />
        </span>
      )}

      {/* Title */}
      <span className="flex-1 text-sm text-[var(--cream)] truncate group-hover:text-[var(--coral)] transition-colors">
        {cls.title}
      </span>

      {/* Price */}
      <span className="flex-shrink-0 text-xs font-mono text-[var(--muted)]">
        {cls.is_free ? (
          <span className="text-[var(--neon-green)]">Free</span>
        ) : cls.price_min ? (
          `$${cls.price_min}`
        ) : null}
      </span>

      {hasSocialProof && (
        <span className="flex-shrink-0 flex items-center gap-1.5">
          {goingCount > 0 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--coral)]/10 border border-[var(--coral)]/20 font-mono text-[0.6rem] font-medium text-[var(--coral)]">
              {formatCompactCount(goingCount)} going
            </span>
          )}
          {interestedCount > 0 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--gold)]/15 border border-[var(--gold)]/30 font-mono text-[0.6rem] font-medium text-[var(--gold)]">
              {formatCompactCount(interestedCount)} maybe
            </span>
          )}
          {recommendationCount > 0 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--lavender)]/15 border border-[var(--lavender)]/30 font-mono text-[0.6rem] font-medium text-[var(--lavender)]">
              {formatCompactCount(recommendationCount)} rec&apos;d
            </span>
          )}
        </span>
      )}
    </Link>
  );
}

// Venue section within a day
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

  return (
    <div className="border border-[var(--twilight)] rounded-lg bg-[var(--card-bg)] overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 hover:bg-[var(--twilight)]/20 transition-colors"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[var(--cream)] font-medium">{venue.venueName}</span>
            <span className="text-xs font-mono text-[var(--muted)] bg-[var(--twilight)]/50 px-1.5 py-0.5 rounded">
              {venue.classes.length}
            </span>
          </div>
          {venue.locations && venue.locations.length > 0 && (
            <div className="text-[0.6rem] font-mono text-[var(--muted)] mt-1 truncate">
              {formatLocationList(venue.locations)}
            </div>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-[var(--muted)] transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="border-t border-[var(--twilight)] py-1">
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
  );
}

// Day section header
function DayHeader({ day }: { day: DayGroup }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <h3 className="font-mono text-sm uppercase tracking-wider text-[var(--coral)]">
        {day.label}
      </h3>
      <div className="flex-1 h-px bg-[var(--twilight)]" />
      <span className="font-mono text-xs text-[var(--muted)]">
        {day.totalClasses} {day.totalClasses === 1 ? "class" : "classes"}
      </span>
    </div>
  );
}

export default function ClassesView({
  portalId,
  portalSlug,
}: ClassesViewProps) {
  const [classes, setClasses] = useState<ClassEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const [category, setCategory] = useState("all");
  const offsetRef = useRef(0);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const hasLoadedRef = useRef(false);
  const requestIdRef = useRef(0);

  const fetchClasses = useCallback(
    async (offset: number, cat: string, append = false) => {
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
        if (portalId) params.set("portal_id", portalId);

        const res = await fetch(`/api/classes?${params.toString()}`);
        if (!res.ok) return;
        const data = await res.json();

        if (requestId !== requestIdRef.current) return;

        const newClasses = data.classes || [];
        if (append) {
          setClasses((prev) => [...prev, ...newClasses]);
        } else {
          setClasses(newClasses);
        }
        setTotal(data.total ?? 0);
        setHasMore(offset + PAGE_SIZE < (data.total ?? 0));
        offsetRef.current = offset + PAGE_SIZE;
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

  // Initial load and category change
  useEffect(() => {
    offsetRef.current = 0;
    hasLoadedRef.current = false;
    requestIdRef.current += 1;
    fetchClasses(0, category);
  }, [category, fetchClasses]);

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loadingMore && !loading) {
          fetchClasses(offsetRef.current, category, true);
        }
      },
      { rootMargin: "400px" }
    );

    if (sentinelRef.current) {
      observerRef.current.observe(sentinelRef.current);
    }

    return () => observerRef.current?.disconnect();
  }, [hasMore, loadingMore, loading, category, fetchClasses]);

  // Group classes by day and venue
  const dayGroups = groupClassesByDayAndVenue(classes);

  return (
    <div>
      {/* Category filter dropdown */}
      <CategoryDropdown category={category} onSelect={setCategory} />

      {/* Results count */}
      {!loading && (
        <div className="text-xs font-mono text-[var(--muted)] mb-4">
          {total} {total === 1 ? "class" : "classes"} across {dayGroups.length}{" "}
          {dayGroups.length === 1 ? "day" : "days"}
        </div>
      )}

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
          {dayGroups.map((day, dayIdx) => (
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
                    />
                  ))}
                </div>
              )}
              {day.venues.length > 0 && (
                <div className="space-y-2 mt-3">
                  {day.venues.map((venue, venueIdx) => (
                    <VenueSection
                      key={venue.venueId || venue.venueName}
                      venue={venue}
                      portalSlug={portalSlug}
                      // Open first venue of first day, or venues with few classes
                      defaultOpen={
                        (dayIdx === 0 && venueIdx === 0) || venue.classes.length <= 2
                      }
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
