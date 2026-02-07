"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { FestivalSession, FestivalProgram } from "@/lib/festivals";

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
  if (!category) return "var(--neon-magenta)";
  const colors: Record<string, string> = {
    music: "var(--neon-magenta)",
    film: "var(--neon-cyan)",
    theater: "var(--coral)",
    art: "var(--gold)",
    community: "var(--neon-green)",
    food_drink: "var(--coral)",
    words: "var(--neon-cyan)",
    learning: "var(--gold)",
    comedy: "var(--neon-amber)",
  };
  return colors[category] || "var(--neon-magenta)";
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

  const [selectedDay, setSelectedDay] = useState(days[0] || "");
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
        <div className="overflow-x-auto -mx-4 px-4 mb-4">
          <div className="flex gap-2 min-w-min">
            {days.map((day) => (
              <button
                key={day}
                onClick={() => setSelectedDay(day)}
                className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  selectedDay === day
                    ? "bg-accent text-[var(--void)]"
                    : "bg-[var(--twilight)]/30 text-[var(--soft)] hover:bg-[var(--twilight)]/60"
                }`}
              >
                {formatShortDate(day)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filter pills */}
      {(venues.length > 1 || categories.length > 1 || programs.length > 1) && (
        <div className="flex flex-wrap gap-2 mb-4">
          {/* Venue filter */}
          {venues.length > 1 && (
            <select
              value={selectedVenue ?? ""}
              onChange={(e) => setSelectedVenue(e.target.value ? Number(e.target.value) : null)}
              className="px-3 py-1.5 rounded-lg text-xs bg-[var(--void)] border border-[var(--twilight)] text-[var(--soft)] cursor-pointer"
            >
              <option value="">All Venues</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          )}

          {/* Category filter */}
          {categories.length > 1 && (
            <select
              value={selectedCategory ?? ""}
              onChange={(e) => setSelectedCategory(e.target.value || null)}
              className="px-3 py-1.5 rounded-lg text-xs bg-[var(--void)] border border-[var(--twilight)] text-[var(--soft)] cursor-pointer"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
              ))}
            </select>
          )}

          {/* Program / Track filter */}
          {programs.length > 1 && (
            <select
              value={selectedProgram ?? ""}
              onChange={(e) => setSelectedProgram(e.target.value || null)}
              className="px-3 py-1.5 rounded-lg text-xs bg-[var(--void)] border border-[var(--twilight)] text-[var(--soft)] cursor-pointer"
            >
              <option value="">All Programs</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          )}

          {/* Clear filters */}
          {activeFilters > 0 && (
            <button
              onClick={() => {
                setSelectedVenue(null);
                setSelectedCategory(null);
                setSelectedProgram(null);
              }}
              className="px-3 py-1.5 rounded-lg text-xs text-[var(--muted)] hover:text-[var(--cream)] border border-[var(--twilight)] hover:bg-[var(--twilight)]/30 transition-colors"
            >
              Clear filters
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
                <div className="flex-shrink-0 w-20 pt-1">
                  <span className="font-mono text-sm text-[var(--muted)]">
                    {formatTime(session.start_time) || "TBA"}
                  </span>
                </div>

                {/* Event details */}
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/${portalSlug}/events/${session.id}`}
                    className="font-medium text-[var(--cream)] hover:text-accent transition-colors line-clamp-2"
                  >
                    {session.title}
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
