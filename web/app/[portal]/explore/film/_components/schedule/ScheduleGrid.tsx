"use client";

import { useEffect, useState } from 'react';
import { FilmSlate } from '@phosphor-icons/react';
import ScheduleCell from './ScheduleCell';
import ScheduleTimeAxis from './ScheduleTimeAxis';
import type { FilmFilters } from '../FilmFilterChips';
import {
  GRID_WIDTH_PX,
  PX_PER_MINUTE,
  ROW_HEIGHT,
  TIER_DIVIDER_HEIGHT,
  currentTimeMinutes,
  hoursLabels,
  sunsetMinutesForDate,
} from '@/lib/film/schedule-geometry';
import type {
  FilmScreening,
  FilmVenue,
  TodayPlaybillPayload,
} from '@/lib/film/types';

function screeningMatchesFilters(s: FilmScreening, f: FilmFilters): boolean {
  if (f.premieresOnly && !s.is_premiere) return false;
  if (f.festival && !s.festival_id) return false;
  if (f.oneNightOnly && s.times.length > 1) return false;
  if (f.driveIn && s.venue.programming_style !== 'drive_in') return false;
  if (f.formats.length > 0) {
    const set = new Set(s.times.flatMap((t) => t.format_labels));
    if (!f.formats.some((ff) => set.has(ff))) return false;
  }
  return true;
}

function RowLabel({ venue }: { venue: FilmVenue }) {
  const isTrueImax = venue.venue_formats.includes('true_imax');
  const isDriveIn = venue.programming_style === 'drive_in';
  return (
    <div className="sticky left-0 z-20 flex items-center w-[160px] shrink-0 px-3 border-r border-[var(--twilight)] bg-[var(--night)]">
      <span
        className={`font-mono text-xs font-bold uppercase tracking-[0.14em] truncate ${
          isTrueImax ? 'text-[var(--gold)]' : 'text-[var(--cream)]'
        }`}
      >
        {venue.name}
      </span>
      {isDriveIn && (
        <span className="ml-2 font-mono text-2xs text-[var(--gold)]/80 uppercase tracking-wider">
          drive-in
        </span>
      )}
    </div>
  );
}

function TheaterRow({
  venue,
  screenings,
  filters,
  portalSlug,
  selectedDate,
}: {
  venue: FilmVenue;
  screenings: FilmScreening[];
  filters: FilmFilters;
  portalSlug: string;
  selectedDate: string;
}) {
  const isDriveIn = venue.programming_style === 'drive_in';
  const sunsetX = isDriveIn ? sunsetMinutesForDate(selectedDate) * PX_PER_MINUTE : null;

  return (
    <div
      className="flex border-b border-[var(--twilight)]/60 last:border-0"
      style={{ height: `${ROW_HEIGHT}px` }}
    >
      <RowLabel venue={venue} />
      <div
        className="relative flex-1"
        style={{ width: `${GRID_WIDTH_PX}px`, height: `${ROW_HEIGHT}px` }}
      >
        {hoursLabels().map((h) => (
          <span
            key={`g-${venue.id}-${h.minutes}`}
            style={{ left: `${h.minutes * PX_PER_MINUTE}px` }}
            className="absolute top-0 bottom-0 w-px bg-[var(--twilight)]/40"
          />
        ))}
        {sunsetX !== null && (
          <>
            <span
              data-sunset-marker
              style={{ left: `${sunsetX}px` }}
              className="absolute top-0 bottom-0 border-l border-dashed border-[var(--gold)]/70"
            />
            <span
              style={{ left: `${sunsetX + 4}px` }}
              className="absolute top-1 font-mono text-2xs text-[var(--gold)]"
            >
              sunset
            </span>
          </>
        )}
        {screenings.map((s) => {
          if (!s.times[0]?.start_time) return null;
          return (
            <ScheduleCell
              key={s.run_id}
              screening={s}
              startTime={s.times[0].start_time}
              matchesFilter={screeningMatchesFilters(s, filters)}
              portalSlug={portalSlug}
              closesToday={false}
            />
          );
        })}
      </div>
    </div>
  );
}

interface Props {
  playbill: TodayPlaybillPayload;
  filters: FilmFilters;
  portalSlug: string;
}

export default function ScheduleGrid({ playbill, filters, portalSlug }: Props) {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  if (playbill.venues.length === 0) {
    return (
      <div className="py-12 text-center space-y-3">
        <FilmSlate weight="duotone" className="w-12 h-12 text-[var(--twilight)] mx-auto" />
        <h3 className="text-xl font-display text-[var(--cream)]">No screenings on this date.</h3>
        <p className="text-sm text-[var(--muted)]">Try another day from the strip above.</p>
      </div>
    );
  }

  const tier1 = playbill.venues.filter((v) => v.venue.classification === 'editorial_program');
  const tier2 = playbill.venues.filter((v) => v.venue.classification === 'premium_format');
  const nowMinutes = currentTimeMinutes(now, playbill.date);
  const hhmm = now.toTimeString().slice(0, 5);

  return (
    <div className="rounded-card-xl border border-[var(--twilight)] bg-[var(--night)] overflow-x-auto">
      <div style={{ width: `${GRID_WIDTH_PX + 160}px` }}>
        <div className="flex">
          <div className="sticky left-0 z-20 w-[160px] shrink-0 border-r border-[var(--twilight)] bg-[var(--night)] h-8" />
          <ScheduleTimeAxis />
        </div>

        <div className="relative">
          {tier1.map(({ venue, screenings }) => (
            <TheaterRow
              key={venue.id}
              venue={venue}
              screenings={screenings}
              filters={filters}
              portalSlug={portalSlug}
              selectedDate={playbill.date}
            />
          ))}

          {tier2.length > 0 && (
            <div
              className="flex items-center gap-3 border-y border-[var(--twilight)] bg-[var(--night)]/90 px-4"
              style={{ height: `${TIER_DIVIDER_HEIGHT}px`, width: `${GRID_WIDTH_PX + 160}px` }}
            >
              <span className="flex-1 h-px bg-[var(--twilight)]" />
              <span className="font-mono text-2xs font-bold uppercase tracking-[0.2em] text-[var(--muted)]">
                PREMIUM FORMATS
              </span>
              <span className="flex-1 h-px bg-[var(--twilight)]" />
            </div>
          )}

          {tier2.map(({ venue, screenings }) => (
            <TheaterRow
              key={venue.id}
              venue={venue}
              screenings={screenings}
              filters={filters}
              portalSlug={portalSlug}
              selectedDate={playbill.date}
            />
          ))}

          {nowMinutes !== null && (
            <>
              <span
                data-now-line
                style={{
                  left: `${160 + nowMinutes * PX_PER_MINUTE}px`,
                  top: 0,
                  bottom: 0,
                }}
                className="absolute w-px bg-[var(--coral)] pointer-events-none"
              />
              <span
                style={{ left: `${160 + nowMinutes * PX_PER_MINUTE}px`, top: 0 }}
                className="absolute -translate-x-1/2 -translate-y-full px-1.5 py-0.5 rounded-b bg-[var(--coral)] text-[var(--void)] font-mono text-2xs font-bold whitespace-nowrap"
              >
                NOW {hhmm}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
