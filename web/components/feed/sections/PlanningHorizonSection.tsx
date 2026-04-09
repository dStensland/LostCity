"use client";

/**
 * Planning Horizon section — big future events with urgency signals.
 *
 * Month selector pills (with counts) filter a horizontal card carousel.
 * Shows flagship + major events across the next 6 months.
 * Minimum 2 items to render.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type { CityPulseSection, CityPulseEventItem } from "@/lib/city-pulse/types";
import { Binoculars } from "@phosphor-icons/react";
import FeedSectionHeader from "@/components/feed/FeedSectionHeader";
import { PlanningHorizonCard } from "@/components/feed/PlanningHorizonCard";
import { buildExploreUrl } from "@/lib/find-url";

interface Props {
  section: CityPulseSection;
  portalSlug: string;
}

/** Format "2026-04" → "Apr" */
function monthLabel(key: string): string {
  const [year, month] = key.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("en-US", { month: "short" });
}

export default function PlanningHorizonSection({ section, portalSlug }: Props) {
  const eventItems = section.items.filter(
    (i): i is CityPulseEventItem => i.item_type === "event",
  );

  // Month counts from server — keys like "2026-04", "2026-05"
  const monthCounts = (section.meta?.month_counts ?? {}) as Record<string, number>;
  const sortedMonths = useMemo(
    () => Object.keys(monthCounts).sort(),
    [monthCounts],
  );

  const [activeMonth, setActiveMonth] = useState<string | null>(null);
  const carouselRef = useRef<HTMLDivElement>(null);

  // Reset carousel scroll position when month filter changes
  useEffect(() => {
    if (carouselRef.current) {
      carouselRef.current.scrollLeft = 0;
    }
  }, [activeMonth]);

  // Filter events by selected month (null = show all)
  const filteredItems = useMemo(() => {
    if (!activeMonth) return eventItems;
    return eventItems.filter((item) => {
      const startDate = item.event.start_date;
      return startDate.startsWith(activeMonth);
    });
  }, [eventItems, activeMonth]);

  if (eventItems.length < 2) return null;

  const showMonthSelector = sortedMonths.length > 1;

  return (
    <section>
      {/* Section header */}
      <FeedSectionHeader
        title={section.title || "On the Horizon"}
        priority="secondary"
        accentColor="var(--gold)"
        icon={<Binoculars weight="duotone" className="w-5 h-5" />}
        seeAllHref={buildExploreUrl({
          portalSlug,
          lane: "events",
          extraParams: { dateRange: "month" },
        })}
        seeAllLabel="All big events"
      />

      {/* Month selector pills */}
      {showMonthSelector && (
        <div className="flex items-center gap-1.5 mb-3 overflow-x-auto scrollbar-none -mx-1 px-1">
          {/* "All" pill */}
          <button
            onClick={() => setActiveMonth(null)}
            className={[
              "shrink-0 px-3 py-2 min-h-[44px] flex items-center justify-center rounded-full font-mono text-2xs font-medium tracking-wide transition-all whitespace-nowrap",
              activeMonth === null
                ? "border"
                : "text-[var(--muted)] hover:text-[var(--soft)] border border-transparent hover:border-[var(--twilight)]/40",
            ].join(" ")}
            style={
              activeMonth === null
                ? {
                    color: "var(--gold)",
                    backgroundColor: "color-mix(in srgb, var(--gold) 12%, transparent)",
                    borderColor: "color-mix(in srgb, var(--gold) 30%, transparent)",
                  }
                : undefined
            }
          >
            All ({eventItems.length})
          </button>

          {sortedMonths.map((monthKey) => {
            const isActive = activeMonth === monthKey;
            const count = monthCounts[monthKey];
            return (
              <button
                key={monthKey}
                onClick={() => setActiveMonth(monthKey)}
                className={[
                  "shrink-0 px-3 py-2 min-h-[44px] flex items-center justify-center rounded-full font-mono text-2xs font-medium tracking-wide transition-all whitespace-nowrap",
                  isActive
                    ? "border"
                    : "text-[var(--muted)] hover:text-[var(--soft)] border border-transparent hover:border-[var(--twilight)]/40",
                ].join(" ")}
                style={
                  isActive
                    ? {
                        color: "var(--gold)",
                        backgroundColor: "color-mix(in srgb, var(--gold) 12%, transparent)",
                        borderColor: "color-mix(in srgb, var(--gold) 30%, transparent)",
                      }
                    : undefined
                }
              >
                {monthLabel(monthKey)} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Horizontal scroll carousel */}
      <div ref={carouselRef} className="flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-2 -mx-4 px-4 mask-fade-x">
        {filteredItems.map((item) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const rawEvent = item.event as any;

          return (
            <PlanningHorizonCard
              key={`horizon-${item.event.id}`}
              event={{
                ...rawEvent,
                urgency: rawEvent.urgency ?? null,
                ticket_freshness: rawEvent.ticket_freshness ?? null,
              }}
              portalSlug={portalSlug}
            />
          );
        })}
      </div>

      {/* Empty state for filtered month */}
      {activeMonth && filteredItems.length === 0 && (
        <p className="py-4 text-center text-sm text-[var(--muted)]">
          No big events in {monthLabel(activeMonth)}
        </p>
      )}
    </section>
  );
}
