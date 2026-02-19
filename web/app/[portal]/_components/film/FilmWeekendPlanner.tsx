"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { getProxiedImageSrc } from "@/lib/image-proxy";

type WeekendEvent = {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  image_url: string | null;
  category: string | null;
  venue?: { name: string; slug: string; neighborhood: string | null } | null;
};

type FilmWeekendPlannerProps = {
  portalSlug: string;
};

type DayPart = {
  key: string;
  label: string;
  events: WeekendEvent[];
};

function formatTimeLabel(time: string | null): string {
  if (!time) return "Time TBA";
  const hour = Number(time.slice(0, 2));
  const minute = time.slice(3, 5);
  if (Number.isNaN(hour)) return time;
  const normalizedHour = hour % 12 === 0 ? 12 : hour % 12;
  const period = hour >= 12 ? "PM" : "AM";
  return `${normalizedHour}:${minute} ${period}`;
}

function isWeekday(): boolean {
  const day = new Date().getDay();
  return day >= 1 && day <= 5; // Mon-Fri
}

function categorizeDayPart(event: WeekendEvent): string | null {
  const dayOfWeek = new Date(`${event.start_date}T12:00:00Z`).getUTCDay();
  const hour = event.start_time ? Number(event.start_time.slice(0, 2)) : 14;

  if (dayOfWeek === 5) {
    // Friday
    return hour >= 17 ? "friday_night" : null;
  }
  if (dayOfWeek === 6) {
    // Saturday
    return hour < 17 ? "saturday_matinee" : "saturday_night";
  }
  if (dayOfWeek === 0) {
    // Sunday
    return "sunday_indie";
  }
  return null;
}

const DAY_PART_CONFIG: { key: string; label: string }[] = [
  { key: "friday_night", label: "Friday Night" },
  { key: "saturday_matinee", label: "Saturday Matinee" },
  { key: "saturday_night", label: "Saturday Night" },
  { key: "sunday_indie", label: "Sunday Indie" },
];

export default function FilmWeekendPlanner({ portalSlug }: FilmWeekendPlannerProps) {
  const [events, setEvents] = useState<WeekendEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Only show on weekdays
  const showPlanner = isWeekday();

  useEffect(() => {
    if (!showPlanner) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    async function load() {
      try {
        const res = await fetch(
          `/api/feed?categories=film&date=weekend&limit=24&portal=${portalSlug}`,
          { signal: controller.signal }
        );
        if (!res.ok) throw new Error("Failed to load");

        const data = await res.json();
        const allEvents: WeekendEvent[] = [];
        if (data.sections) {
          for (const section of data.sections) {
            if (section.events) allEvents.push(...section.events);
          }
        } else if (data.events) {
          allEvents.push(...data.events);
        }
        setEvents(allEvents);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        // Silently fail — section just won't render
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    load();
    return () => controller.abort();
  }, [portalSlug, showPlanner]);

  const dayParts = useMemo((): DayPart[] => {
    const buckets = new Map<string, WeekendEvent[]>();
    for (const config of DAY_PART_CONFIG) {
      buckets.set(config.key, []);
    }

    for (const event of events) {
      const part = categorizeDayPart(event);
      if (part && buckets.has(part)) {
        buckets.get(part)!.push(event);
      }
    }

    return DAY_PART_CONFIG
      .map((config) => ({
        key: config.key,
        label: config.label,
        events: buckets.get(config.key) || [],
      }))
      .filter((dp) => dp.events.length > 0);
  }, [events]);

  if (!showPlanner) return null;
  if (loading) return null;
  if (dayParts.length === 0) return null;

  return (
    <section className="space-y-4">
      <header>
        <p className="text-[0.62rem] uppercase tracking-[0.18em] text-[#95a8cb]">Weekend Planner</p>
        <h2 className="mt-1 font-[var(--font-film-editorial)] text-3xl text-[#f7f8fd]">Plan your cinema weekend</h2>
      </header>
      <div className="space-y-5">
        {dayParts.map((dayPart) => (
          <div key={dayPart.key}>
            <p className="mb-2 text-[0.66rem] uppercase tracking-[0.16em] text-[#8ea4c8]">{dayPart.label}</p>
            <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1">
              {dayPart.events.slice(0, 6).map((event) => (
                <Link
                  key={event.id}
                  href={`/${portalSlug}/events/${event.id}`}
                  className="group flex w-52 shrink-0 snap-start gap-3 rounded-xl border border-[#30405f] bg-[#10182b] p-2.5 hover:border-[#445a85]"
                >
                  <div className="relative h-16 w-11 shrink-0 overflow-hidden rounded-[3px] border border-[#3b4768] bg-[#0c1220]">
                    {event.image_url ? (
                      <Image
                        src={getProxiedImageSrc(event.image_url)}
                        alt={event.title}
                        fill
                        sizes="44px"
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="h-full w-full bg-gradient-to-br from-slate-300/85 to-slate-500/85" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="line-clamp-2 text-xs font-semibold text-[#f5f7fc]">{event.title}</h3>
                    {event.start_time && (
                      <p className="mt-1 text-[0.62rem] text-[#dbe4f7]">
                        {formatTimeLabel(event.start_time)}
                      </p>
                    )}
                    {event.venue?.name && (
                      <p className="text-[0.58rem] text-[#9fb0cf]">{event.venue.name}</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
