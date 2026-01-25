"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { format, parseISO } from "date-fns";

type EventRow = {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  category: string | null;
  is_featured: boolean | null;
  is_trending: boolean | null;
  is_live: boolean | null;
  venue: { name: string } | null;
};

export default function AdminEventsPage() {
  const supabase = createClient();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "featured" | "trending" | "live">("all");
  const [updating, setUpdating] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadEvents() {
      const today = new Date().toISOString().split("T")[0];

      let query = supabase
        .from("events")
        .select(`
          id,
          title,
          start_date,
          start_time,
          category,
          is_featured,
          is_trending,
          is_live,
          venue:venues(name)
        `)
        .gte("start_date", today)
        .order("start_date", { ascending: true })
        .limit(100);

      if (search) {
        query = query.ilike("title", `%${search}%`);
      }

      if (filter === "featured") {
        query = query.eq("is_featured", true);
      } else if (filter === "trending") {
        query = query.eq("is_trending", true);
      } else if (filter === "live") {
        query = query.eq("is_live", true);
      }

      const { data } = await query;
      if (!cancelled) {
        setEvents((data as EventRow[]) || []);
        setLoading(false);
      }
    }

    loadEvents();

    return () => {
      cancelled = true;
    };
  }, [supabase, search, filter]);

  async function toggleFlag(eventId: number, flag: "is_featured" | "is_trending" | "is_live", currentValue: boolean | null) {
    setUpdating(eventId);

    const newValue = !currentValue;

    const { error } = await supabase
      .from("events")
      .update({ [flag]: newValue } as never)
      .eq("id", eventId);

    if (error) {
      console.error("Error updating event:", error);
      alert("Failed to update event");
    } else {
      setEvents((prev) =>
        prev.map((e) =>
          e.id === eventId ? { ...e, [flag]: newValue } : e
        )
      );
    }

    setUpdating(null);
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold text-[var(--cream)] mb-8">
        Manage Events
      </h1>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <input
          type="text"
          placeholder="Search events..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-4 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded-lg text-[var(--cream)] font-mono text-sm focus:outline-none focus:border-[var(--coral)]"
        />
        <div className="flex gap-2">
          {(["all", "featured", "trending", "live"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 font-mono text-sm rounded-lg transition-colors ${
                filter === f
                  ? "bg-[var(--coral)] text-[var(--void)]"
                  : "bg-[var(--twilight)] text-[var(--cream)] hover:bg-[var(--dusk)]"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Events Table */}
      <div className="bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--twilight)]">
                <th className="px-4 py-3 text-left font-mono text-xs text-[var(--muted)] uppercase tracking-wider">
                  Event
                </th>
                <th className="px-4 py-3 text-left font-mono text-xs text-[var(--muted)] uppercase tracking-wider">
                  Date
                </th>
                <th className="px-4 py-3 text-center font-mono text-xs text-[var(--muted)] uppercase tracking-wider">
                  Featured
                </th>
                <th className="px-4 py-3 text-center font-mono text-xs text-[var(--muted)] uppercase tracking-wider">
                  Trending
                </th>
                <th className="px-4 py-3 text-center font-mono text-xs text-[var(--muted)] uppercase tracking-wider">
                  Live
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--twilight)]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[var(--muted)]">
                    Loading...
                  </td>
                </tr>
              ) : events.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--twilight)] flex items-center justify-center">
                      <svg className="w-6 h-6 text-[var(--muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <p className="font-mono text-sm text-[var(--cream)] mb-1">No events found</p>
                    <p className="font-mono text-xs text-[var(--muted)]">Try adjusting your search or filters</p>
                  </td>
                </tr>
              ) : (
                events.map((event) => (
                  <tr key={event.id} className="hover:bg-[var(--twilight)]/50 transition-colors">
                    <td className="px-4 py-3">
                      <a
                        href={`/events/${event.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block group"
                      >
                        <p className="font-medium text-[var(--cream)] group-hover:text-[var(--coral)] transition-colors line-clamp-1">
                          {event.title}
                        </p>
                        <p className="text-xs text-[var(--muted)] mt-0.5">
                          {event.venue?.name || "Venue TBA"}
                          {event.category && (
                            <span className="ml-2 px-1.5 py-0.5 bg-[var(--twilight)] rounded text-[0.6rem] uppercase">
                              {event.category}
                            </span>
                          )}
                        </p>
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-mono text-sm text-[var(--soft)]">
                        {format(parseISO(event.start_date), "MMM d")}
                      </p>
                      {event.start_time && (
                        <p className="font-mono text-xs text-[var(--muted)]">
                          {event.start_time.slice(0, 5)}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggleFlag(event.id, "is_featured", event.is_featured)}
                        disabled={updating === event.id}
                        className={`w-10 h-6 rounded-full transition-colors relative ${
                          event.is_featured
                            ? "bg-[var(--neon-amber)]"
                            : "bg-[var(--twilight)]"
                        } ${updating === event.id ? "opacity-50" : ""}`}
                      >
                        <span
                          className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                            event.is_featured ? "left-5" : "left-1"
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggleFlag(event.id, "is_trending", event.is_trending)}
                        disabled={updating === event.id}
                        className={`w-10 h-6 rounded-full transition-colors relative ${
                          event.is_trending
                            ? "bg-[var(--neon-magenta)]"
                            : "bg-[var(--twilight)]"
                        } ${updating === event.id ? "opacity-50" : ""}`}
                      >
                        <span
                          className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                            event.is_trending ? "left-5" : "left-1"
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggleFlag(event.id, "is_live", event.is_live)}
                        disabled={updating === event.id}
                        className={`w-10 h-6 rounded-full transition-colors relative ${
                          event.is_live
                            ? "bg-[var(--neon-red)]"
                            : "bg-[var(--twilight)]"
                        } ${updating === event.id ? "opacity-50" : ""}`}
                      >
                        <span
                          className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                            event.is_live ? "left-5" : "left-1"
                          }`}
                        />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-xs font-mono text-[var(--muted)]">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[var(--neon-amber)]" />
          <span>Featured - Highlighted in UI with star badge</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[var(--neon-magenta)]" />
          <span>Trending - Shows fire badge, high engagement</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[var(--neon-red)]" />
          <span>Live - Currently happening, shows in &quot;Happening Now&quot;</span>
        </div>
      </div>
    </div>
  );
}
