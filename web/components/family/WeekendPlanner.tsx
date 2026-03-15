"use client";

import { memo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import Image from "next/image";
import { MapPin, Clock, ArrowRight } from "@phosphor-icons/react";
import type { EventWithLocation } from "@/lib/search";

interface WeekendPlannerProps {
  portalId: string;
  portalSlug: string;
}

type IndoorOutdoor = "all" | "indoor" | "outdoor";

interface WeekendFilters {
  indoorOutdoor: IndoorOutdoor;
  freeOnly: boolean;
}

// ---- Data fetcher --------------------------------------------------------

async function fetchWeekendEvents(
  portalId: string,
  filters: WeekendFilters
): Promise<EventWithLocation[]> {
  const params = new URLSearchParams({
    date: "weekend",
    tags: "family-friendly",
    portal_id: portalId,
    limit: "24",
    useCursor: "true",
  });

  if (filters.freeOnly) {
    params.set("free", "1");
  }

  if (filters.indoorOutdoor === "indoor") {
    params.set("tags", "family-friendly,indoor");
  } else if (filters.indoorOutdoor === "outdoor") {
    params.set("tags", "family-friendly,outdoor");
  }

  const res = await fetch(`/api/events?${params.toString()}`);
  if (!res.ok) return [];
  const json = await res.json();
  return (json.events ?? []) as EventWithLocation[];
}

// ---- Event card ----------------------------------------------------------

function FamilyEventCard({
  event,
  portalSlug,
}: {
  event: EventWithLocation;
  portalSlug: string;
}) {
  const dateLabel = new Date(event.start_date).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <Link
      href={`/${portalSlug}?event=${event.id}`}
      className="group block bg-white rounded-xl border overflow-hidden hover:shadow-md transition-shadow"
      style={{ borderColor: "var(--twilight, #E8E4DF)" }}
    >
      {/* Image */}
      {event.image_url ? (
        <div className="relative h-36 overflow-hidden">
          <Image
            src={event.image_url}
            alt={event.title}
            fill
            sizes="(max-width: 640px) 100vw, 320px"
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
          {/* Badges */}
          {event.is_free && (
            <div className="absolute top-2 left-2">
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-600 text-white">
                Free
              </span>
            </div>
          )}
        </div>
      ) : (
        /* No image — thin accent strip for badge placement */
        event.is_free ? (
          <div
            className="h-8 relative flex items-center px-3"
            style={{ backgroundColor: "color-mix(in srgb, var(--coral) 6%, white)" }}
          >
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-600 text-white">
              Free
            </span>
          </div>
        ) : null
      )}

      {/* Content */}
      <div className="p-3">
        <h3
          className="text-sm font-semibold leading-snug text-[var(--cream)] line-clamp-2 group-hover:text-[var(--coral)] transition-colors"
          style={{ fontFamily: "var(--font-outfit, system-ui, sans-serif)" }}
        >
          {event.title}
        </h3>

        <div className="mt-1.5 space-y-0.5">
          <div className="flex items-center gap-1 text-xs text-[var(--muted)]">
            <Clock size={11} />
            <span>{dateLabel}{event.start_time ? ` · ${event.start_time}` : ""}</span>
          </div>
          {event.venue?.name && (
            <div className="flex items-center gap-1 text-xs text-[var(--muted)]">
              <MapPin size={11} />
              <span className="truncate">{event.venue.name}</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

// ---- Section block -------------------------------------------------------

function EventSection({
  title,
  events,
  seeAllHref,
  portalSlug,
  isLoading,
  emptyMessage,
}: {
  title: string;
  events: EventWithLocation[];
  seeAllHref: string;
  portalSlug: string;
  isLoading: boolean;
  emptyMessage: string;
}) {
  if (!isLoading && events.length === 0) return null;

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2
          className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]"
          style={{ fontFamily: "var(--font-mono, ui-monospace, monospace)" }}
        >
          {title}
        </h2>
        <Link
          href={seeAllHref}
          className="flex items-center gap-1 text-xs font-medium text-[var(--coral)] hover:opacity-80 transition-opacity"
          style={{ fontFamily: "var(--font-mono, ui-monospace, monospace)" }}
        >
          See all <ArrowRight size={11} />
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-48 rounded-xl skeleton-shimmer-light" />
          ))}
        </div>
      ) : events.length > 0 ? (
        <div className="grid grid-cols-2 gap-3">
          {events.slice(0, 6).map((event) => (
            <FamilyEventCard key={event.id} event={event} portalSlug={portalSlug} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-[var(--muted)] py-2">{emptyMessage}</p>
      )}
    </section>
  );
}

// ---- Filter chip ---------------------------------------------------------

function FilterChip({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 px-3.5 py-2 rounded-full text-sm font-medium border transition-colors"
      style={{
        backgroundColor: isActive ? "var(--coral)" : "white",
        color: isActive ? "white" : "var(--soft, #57534E)",
        borderColor: isActive ? "var(--coral)" : "var(--twilight, #E8E4DF)",
      }}
    >
      {label}
    </button>
  );
}

// ---- Main component ------------------------------------------------------

export const WeekendPlanner = memo(function WeekendPlanner({
  portalId,
  portalSlug,
}: WeekendPlannerProps) {
  const [filters, setFilters] = useState<WeekendFilters>({
    indoorOutdoor: "all",
    freeOnly: false,
  });

  const { data: allEvents, isLoading } = useQuery({
    queryKey: ["family-weekend-events", portalId, filters],
    queryFn: () => fetchWeekendEvents(portalId, filters),
    staleTime: 60 * 1000,
  });

  const events = allEvents ?? [];

  // Derive sub-sections from the same result set
  const freeEvents = events.filter((e) => e.is_free);
  const nonFreeEvents = events.filter((e) => !e.is_free);
  const bestBets = filters.freeOnly ? [] : nonFreeEvents;

  const toggleIndoorOutdoor = (val: IndoorOutdoor) => {
    setFilters((f) => ({ ...f, indoorOutdoor: f.indoorOutdoor === val ? "all" : val }));
  };

  const toggleFree = () => {
    setFilters((f) => ({ ...f, freeOnly: !f.freeOnly }));
  };

  return (
    <div className="pb-6">
      {/* Filter bar — sticky, scrollable on mobile */}
      <div
        className="sticky top-0 z-10 bg-[var(--background)] border-b px-4 py-3"
        style={{ borderColor: "var(--twilight, #E8E4DF)" }}
      >
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
          <FilterChip
            label="Indoor"
            isActive={filters.indoorOutdoor === "indoor"}
            onClick={() => toggleIndoorOutdoor("indoor")}
          />
          <FilterChip
            label="Outdoor"
            isActive={filters.indoorOutdoor === "outdoor"}
            onClick={() => toggleIndoorOutdoor("outdoor")}
          />
          <FilterChip
            label="Free"
            isActive={filters.freeOnly}
            onClick={toggleFree}
          />
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pt-5 space-y-8">
        {/* Best Bets — shown when not filtering free-only */}
        {!filters.freeOnly && (
          <EventSection
            title="Best Bets"
            events={bestBets.length > 0 ? bestBets : events}
            seeAllHref={`/${portalSlug}?view=find&type=events&date=weekend`}
            portalSlug={portalSlug}
            isLoading={isLoading}
            emptyMessage="No events found for this weekend."
          />
        )}

        {/* Free Activities */}
        {(filters.freeOnly || freeEvents.length > 0 || isLoading) && (
          <EventSection
            title="Free Activities"
            events={freeEvents}
            seeAllHref={`/${portalSlug}?view=find&type=events&date=weekend&free=1`}
            portalSlug={portalSlug}
            isLoading={isLoading && filters.freeOnly}
            emptyMessage="No free events found this weekend."
          />
        )}

        {/* Empty state when filters yield nothing */}
        {!isLoading && events.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-[var(--muted)]">
              No events matched your filters. Try removing Indoor/Outdoor or the Free filter.
            </p>
          </div>
        )}
      </div>
    </div>
  );
});

export type { WeekendPlannerProps };
