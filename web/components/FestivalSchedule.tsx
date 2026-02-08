"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { FestivalSession, FestivalProgram } from "@/lib/festivals";
import { getCategoryAccentColor } from "@/lib/moments-utils";
import { decodeHtmlEntities } from "@/lib/formats";

interface FestivalScheduleProps {
  sessions: FestivalSession[];
  programs: FestivalProgram[];
  portalSlug: string;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatShortDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(timeStr: string | null): string {
  if (!timeStr) return "";
  const [hours, minutes] = timeStr.split(":");
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
}

function getCategoryColor(category: string | null): string {
  return getCategoryAccentColor(category);
}

export default function FestivalSchedule({
  sessions,
  programs,
  portalSlug,
}: FestivalScheduleProps) {
  // Extract unique days
  const days = useMemo(() => {
    const daySet = new Set(sessions.map((s) => s.start_date));
    return Array.from(daySet).sort();
  }, [sessions]);

  // Extract unique venues
  const venues = useMemo(() => {
    const venueMap = new Map<number, { id: number; name: string; slug: string }>();
    for (const s of sessions) {
      if (s.venue && !venueMap.has(s.venue.id)) {
        venueMap.set(s.venue.id, { id: s.venue.id, name: s.venue.name, slug: s.venue.slug });
      }
    }
    return Array.from(venueMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [sessions]);

  // Extract unique categories
  const categories = useMemo(() => {
    const catSet = new Set(sessions.map((s) => s.category).filter(Boolean) as string[]);
    return Array.from(catSet).sort();
  }, [sessions]);

  // Default to today if it's one of the festival days, otherwise first day
  const todayStr = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }, []);
  const [selectedDay, setSelectedDay] = useState(
    days.includes(todayStr) ? todayStr : days[0] || ""
  );
  const [selectedVenue, setSelectedVenue] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return sessions.filter((s) => {
      if (selectedDay && s.start_date !== selectedDay) return false;
      if (selectedVenue !== null && s.venue?.id !== selectedVenue) return false;
      if (selectedCategory && s.category !== selectedCategory) return false;
      if (selectedProgram && s.series_id !== selectedProgram) return false;
      return true;
    });
  }, [sessions, selectedDay, selectedVenue, selectedCategory, selectedProgram]);

  const activeFilters = [selectedVenue, selectedCategory, selectedProgram].filter((v) => v !== null).length;

  return (
    <div id="schedule">
      <h2 className="text-lg font-semibold text-[var(--cream)] mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        Schedule
        <span className="text-sm font-normal text-[var(--muted)]">
          ({filtered.length} session{filtered.length !== 1 ? "s" : ""})
        </span>
      </h2>

      {/* Day tabs */}
      {days.length > 1 && (
        <div className="relative mb-4">
          <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-[var(--void)] to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-[var(--void)] to-transparent z-10 pointer-events-none" />
          <div className="overflow-x-auto -mx-4 px-4">
          <div className="flex gap-2 min-w-min">
            {days.map((day) => {
              const isSelected = selectedDay === day;
              const isToday = day === todayStr;
              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  className={`relative px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    isSelected
                      ? "bg-accent-20 text-accent border border-accent-40"
                      : "bg-[var(--twilight)]/30 text-[var(--soft)] hover:bg-[var(--twilight)]/60 border border-transparent"
                  }`}
                >
                  {formatShortDate(day)}
                  {isToday && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-accent shadow-[0_0_6px_rgba(255,107,122,0.6)]" />
                  )}
                </button>
              );
            })}
          </div>
          </div>
        </div>
      )}

      {/* Filter chips */}
      {(venues.length > 1 || categories.length > 1 || programs.length > 1) && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {/* Venue chips */}
          {venues.length > 1 && venues.map((v) => (
            <button
              key={v.id}
              onClick={() => setSelectedVenue(selectedVenue === v.id ? null : v.id)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                selectedVenue === v.id
                  ? "bg-accent-20 text-accent border border-accent-40"
                  : "bg-[var(--twilight)]/20 text-[var(--muted)] border border-transparent hover:bg-[var(--twilight)]/40 hover:text-[var(--soft)]"
              }`}
            >
              {v.name}
            </button>
          ))}

          {/* Category chips */}
          {categories.length > 1 && categories.map((c) => (
            <button
              key={c}
              onClick={() => setSelectedCategory(selectedCategory === c ? null : c)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                selectedCategory === c
                  ? "bg-accent-20 text-accent border border-accent-40"
                  : "bg-[var(--twilight)]/20 text-[var(--muted)] border border-transparent hover:bg-[var(--twilight)]/40 hover:text-[var(--soft)]"
              }`}
            >
              {c.replace(/_/g, " ")}
            </button>
          ))}

          {/* Program chips — only show when manageable count */}
          {programs.length > 1 && programs.length <= 8 && programs.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedProgram(selectedProgram === p.id ? null : p.id)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                selectedProgram === p.id
                  ? "bg-accent-20 text-accent border border-accent-40"
                  : "bg-[var(--twilight)]/20 text-[var(--muted)] border border-transparent hover:bg-[var(--twilight)]/40 hover:text-[var(--soft)]"
              }`}
            >
              {decodeHtmlEntities(p.title)}
            </button>
          ))}

          {/* Clear all */}
          {activeFilters > 0 && (
            <button
              onClick={() => {
                setSelectedVenue(null);
                setSelectedCategory(null);
                setSelectedProgram(null);
              }}
              className="px-2.5 py-1 rounded-full text-xs text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Session list */}
      {filtered.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-sm text-[var(--muted)]">No sessions match your filters</p>
        </div>
      ) : (
        <div className="rounded-lg border border-[var(--twilight)] overflow-hidden bg-[var(--card-bg)]">
          <div className="divide-y divide-[var(--twilight)]/30">
            {filtered.map((session) => (
              <div
                key={session.id}
                className="flex items-start gap-4 px-4 py-3 hover:bg-[var(--card-bg-hover)] transition-colors"
              >
                {/* Time */}
                <div className="flex-shrink-0 w-14 sm:w-20 pt-1">
                  <span className="font-mono text-xs sm:text-sm text-[var(--muted)]">
                    {formatTime(session.start_time) || "TBA"}
                  </span>
                </div>

                {/* Event details */}
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/${portalSlug}/events/${session.id}`}
                    className="font-medium text-[var(--cream)] hover:text-accent transition-colors line-clamp-2"
                  >
                    {decodeHtmlEntities(session.title)}
                  </Link>

                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    {session.venue && (
                      <Link
                        href={`/${portalSlug}/spots/${session.venue.slug}`}
                        className="text-xs text-[var(--soft)] hover:text-[var(--coral)] transition-colors inline-flex items-center gap-1"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {session.venue.name}
                      </Link>
                    )}

                    {session.category && (
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-medium border"
                        style={{
                          borderColor: getCategoryColor(session.category),
                          color: getCategoryColor(session.category),
                          backgroundColor: `color-mix(in srgb, ${getCategoryColor(session.category)} 12%, transparent)`,
                        }}
                      >
                        {session.category.replace(/_/g, " ")}
                      </span>
                    )}
                  </div>
                </div>

                {/* Arrow */}
                <Link href={`/${portalSlug}/events/${session.id}`} className="flex-shrink-0 pt-1">
                  <svg className="w-5 h-5 text-[var(--muted)] hover:text-accent transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
