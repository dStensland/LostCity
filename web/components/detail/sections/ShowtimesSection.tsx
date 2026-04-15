"use client";

import { useState, useMemo } from "react";
import { format, parseISO, isToday, isTomorrow } from "date-fns";
import { ShowtimesTheaterCard } from "@/components/detail/ShowtimesTheaterCard";
import PlaceScreeningsSection from "@/components/detail/PlaceScreeningsSection";
import type { SectionProps } from "@/lib/detail/types";
import type { VenueShowtime } from "@/lib/detail/types";

export function ShowtimesSection({ data, portalSlug }: SectionProps) {
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);

  if (data.entityType === "place") {
    const screenings = data.payload.screenings;
    if (!screenings) return null;
    return (
      <PlaceScreeningsSection
        screenings={screenings}
        title="Now Showing"
        onTimeClick={() => {}}
      />
    );
  }

  if (data.entityType === "series") {
    if (data.payload.series.series_type !== "film") return null;
    const venueShowtimes: VenueShowtime[] = data.payload.venueShowtimes ?? [];
    if (venueShowtimes.length === 0) return null;

    return (
      <FilmShowtimes
        venueShowtimes={venueShowtimes}
        selectedDateKey={selectedDateKey}
        setSelectedDateKey={setSelectedDateKey}
        portalSlug={portalSlug}
      />
    );
  }

  if (data.entityType === "festival") {
    const screenings = (data.payload as { screenings?: unknown }).screenings;
    if (!screenings) return null;
    return (
      <PlaceScreeningsSection
        screenings={screenings as Parameters<typeof PlaceScreeningsSection>[0]["screenings"]}
        title="Screenings"
        onTimeClick={() => {}}
      />
    );
  }

  return null;
}

function FilmShowtimes({
  venueShowtimes,
  selectedDateKey,
  setSelectedDateKey,
  portalSlug,
}: {
  venueShowtimes: VenueShowtime[];
  selectedDateKey: string | null;
  setSelectedDateKey: (date: string) => void;
  portalSlug: string;
}) {
  const filmDates = useMemo(() => {
    const dateSet = new Set<string>();
    for (const vs of venueShowtimes) {
      for (const e of vs.events) {
        dateSet.add(e.date);
      }
    }
    return [...dateSet].sort();
  }, [venueShowtimes]);

  const activeDateKey = selectedDateKey ?? filmDates[0] ?? null;

  const theaterCardsForDate = useMemo(() => {
    if (!activeDateKey) return venueShowtimes;
    return venueShowtimes
      .map((vs) => ({
        ...vs,
        events: vs.events.filter((e) => e.date === activeDateKey),
      }))
      .filter((vs) => vs.events.length > 0);
  }, [venueShowtimes, activeDateKey]);

  return (
    <div className="space-y-3">
      {/* Date pill strip */}
      {filmDates.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
          {filmDates.map((dateStr) => {
            const date = parseISO(dateStr);
            const isActive = dateStr === activeDateKey;
            const dayLabel = isToday(date) ? "Today" : isTomorrow(date) ? "Tmrw" : format(date, "EEE");
            return (
              <button
                key={dateStr}
                onClick={() => setSelectedDateKey(dateStr)}
                className={`flex-shrink-0 flex flex-col items-center gap-0.5 rounded-[10px] transition-all px-3 py-2 min-w-[44px] border focus-ring ${
                  isActive
                    ? "bg-[var(--coral)] border-transparent"
                    : "bg-[var(--dusk)] border-[var(--twilight)] hover:border-[var(--coral)]/30"
                }`}
              >
                <span
                  className={`font-mono uppercase tracking-[0.5px] text-[9px] font-medium ${
                    isActive ? "text-white" : "text-[var(--muted)]"
                  }`}
                >
                  {dayLabel}
                </span>
                <span
                  className={`font-[Outfit] text-[16px] leading-tight ${
                    isActive ? "font-bold text-white" : "font-semibold text-[var(--cream)]"
                  }`}
                >
                  {format(date, "d")}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Theater cards for active date */}
      {theaterCardsForDate.length > 0 ? (
        <div className="space-y-2">
          {theaterCardsForDate.map((vs) => (
            <ShowtimesTheaterCard
              key={vs.venue.id}
              theater={{
                venue_name: vs.venue.name,
                venue_slug: vs.venue.slug,
                neighborhood: vs.venue.neighborhood,
                showtimes: vs.events
                  .filter((e) => e.time != null)
                  .sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""))
                  .map((e) => ({ time: e.time!, event_id: e.id })),
                nearest_marta_station: vs.venue.nearest_marta_station,
                marta_walk_minutes: vs.venue.marta_walk_minutes,
                parking_type: vs.venue.parking_type,
                parking_free: vs.venue.parking_free,
              }}
              portalSlug={portalSlug}
              laneColor="var(--coral)"
            />
          ))}
        </div>
      ) : (
        <p className="text-[var(--muted)] text-sm py-3 text-center font-mono">
          No showtimes on this date
        </p>
      )}
    </div>
  );
}
