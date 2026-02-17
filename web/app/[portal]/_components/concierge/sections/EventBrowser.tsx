"use client";

import { useMemo, useState } from "react";
import type { FeedSection } from "@/lib/concierge/concierge-types";
import HotelSection from "../../hotel/HotelSection";
import HotelCarousel from "../../hotel/HotelCarousel";
import HotelEventCard from "../../hotel/HotelEventCard";

interface EventBrowserProps {
  sections: FeedSection[];
  portalSlug: string;
  dayOfWeek: number;
  /** If true, start expanded */
  expanded?: boolean;
  /** Active interest filter chips */
  activeInterests?: string[];
  /** Weather annotations for outdoor events */
  weatherAnnotation?: string | null;
}

function toLocalDateStamp(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDateChip(dateStr: string): string {
  const parsed = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return parsed.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export default function EventBrowser({
  sections,
  portalSlug,
  dayOfWeek,
  expanded = false,
  activeInterests,
  weatherAnnotation,
}: EventBrowserProps) {
  const [isOpen, setIsOpen] = useState(expanded);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const todayStamp = useMemo(() => toLocalDateStamp(new Date()), []);

  const allEvents = useMemo(() => sections.flatMap((s) => s.events), [sections]);

  // Apply interest filtering
  const filteredEvents = useMemo(() => {
    if (!activeInterests || activeInterests.length === 0) return allEvents;
    return allEvents.filter((event) => {
      const cat = event.category?.toLowerCase() || "";
      return activeInterests.some(
        (interest) => cat.includes(interest)
      );
    });
  }, [allEvents, activeInterests]);

  const futureDates = useMemo(() => {
    const unique = new Set<string>();
    for (const event of filteredEvents) {
      if (event.start_date && event.start_date >= todayStamp) {
        unique.add(event.start_date);
      }
    }
    return Array.from(unique).sort().slice(0, 7);
  }, [filteredEvents, todayStamp]);

  const activeDate = selectedDate && futureDates.includes(selectedDate) ? selectedDate : futureDates[0] || null;

  const dateEvents = useMemo(() => {
    if (!activeDate) return [];
    return filteredEvents.filter((e) => e.start_date === activeDate).slice(0, 8);
  }, [filteredEvents, activeDate]);

  // Also include weekend events when not fully expanded
  const weekendSection = useMemo(() => {
    if (isOpen) return null;
    if (dayOfWeek === 3) return null; // Hide on Wed
    return sections.find((s) =>
      s.slug?.includes("weekend") || s.title.toLowerCase().includes("weekend")
    );
  }, [sections, dayOfWeek, isOpen]);

  const weekendEvents = weekendSection?.events?.slice(0, 8) || [];
  const isWeekendSoon = dayOfWeek >= 4 || dayOfWeek === 0;

  if (futureDates.length === 0 && weekendEvents.length === 0) {
    return (
      <div className="text-center py-12 rounded-xl border border-dashed border-[var(--hotel-sand)] bg-[var(--hotel-cream)]/50">
        <svg className="mx-auto w-8 h-8 text-[var(--hotel-sand)] mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
        </svg>
        <p className="text-sm font-body font-medium text-[var(--hotel-charcoal)] mb-1">No upcoming events found</p>
        <p className="text-xs font-body text-[var(--hotel-stone)]">
          Check back soon — new events are added daily.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {/* Weekend section (shown when browser is collapsed) */}
      {weekendEvents.length > 0 && !isOpen && (
        <HotelSection
          id="weekend"
          title={isWeekendSoon ? "This Weekend" : "Coming Weekend"}
          subtitle={isWeekendSoon ? "Events and experiences this Friday through Sunday" : "Plan ahead for this coming weekend"}
        >
          <HotelCarousel>
            {weekendEvents.map((event) => (
              <div key={event.id} className="snap-start shrink-0 w-[300px] md:w-[340px]">
                <HotelEventCard event={event} portalSlug={portalSlug} variant="compact" />
              </div>
            ))}
          </HotelCarousel>
        </HotelSection>
      )}

      {/* Date browser */}
      {futureDates.length > 0 && (
        <HotelSection
          id="plan"
          title="Plan Ahead"
          subtitle="Browse events for your upcoming stay"
          action={!isOpen ? { label: "Open planner", onClick: () => setIsOpen(true) } : undefined}
        >
          {isOpen ? (
            <div className="space-y-6">
              {/* Date chips */}
              <div className="flex flex-wrap gap-2">
                {futureDates.map((date) => (
                  <button
                    key={date}
                    onClick={() => setSelectedDate(date)}
                    className={`px-4 py-2 rounded-full text-sm font-body transition-colors ${
                      date === activeDate
                        ? "bg-[var(--hotel-charcoal)] text-white"
                        : "bg-[var(--hotel-cream)] text-[var(--hotel-stone)] border border-[var(--hotel-sand)] hover:bg-[var(--hotel-sand)]"
                    }`}
                  >
                    {formatDateChip(date)}
                  </button>
                ))}
              </div>

              {/* Weather annotation */}
              {weatherAnnotation && (
                <p className="text-xs font-body text-[var(--hotel-champagne)] flex items-center gap-1.5">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--hotel-champagne)]" />
                  {weatherAnnotation}
                </p>
              )}

              {/* Events for selected date */}
              {dateEvents.length > 0 ? (
                <HotelCarousel>
                  {dateEvents.map((event) => (
                    <div key={event.id} className="snap-start shrink-0 w-[300px] md:w-[340px]">
                      <HotelEventCard event={event} portalSlug={portalSlug} variant="compact" />
                    </div>
                  ))}
                </HotelCarousel>
              ) : (
                <p className="text-sm font-body text-[var(--hotel-stone)]">No events found for this date.</p>
              )}
            </div>
          ) : (
            <button
              onClick={() => setIsOpen(true)}
              className="group w-full rounded-xl border border-[var(--hotel-sand)] bg-[var(--hotel-cream)] hover:bg-[var(--hotel-sand)]/30 transition-colors p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-body text-[var(--hotel-stone)]">Upcoming dates with events</span>
                <span className="text-xs font-body uppercase tracking-[0.15em] text-[var(--hotel-champagne)] group-hover:text-[var(--hotel-brass)] transition-colors">
                  Browse &rarr;
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {futureDates.slice(0, 4).map((date) => (
                  <span
                    key={date}
                    className="px-3 py-1.5 rounded-full text-xs font-body bg-[var(--hotel-ivory)] border border-[var(--hotel-sand)] text-[var(--hotel-charcoal)]"
                  >
                    {formatDateChip(date)}
                  </span>
                ))}
                {futureDates.length > 4 && (
                  <span className="px-3 py-1.5 rounded-full text-xs font-body text-[var(--hotel-stone)]">
                    +{futureDates.length - 4} more
                  </span>
                )}
              </div>
            </button>
          )}
        </HotelSection>
      )}
    </div>
  );
}
