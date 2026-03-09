"use client";
/* eslint-disable @next/next/no-img-element */

import { useMemo } from "react";
import type { FeedEvent } from "@/lib/forth-types";
import { getProxiedImageSrc } from "@/lib/image-proxy";

interface DiscoverComingUpSectionProps {
  events: FeedEvent[];
  onEventClick?: (event: FeedEvent) => void;
}

function formatTime(time: string | null | undefined): string {
  if (!time) return "TBA";
  const [h, m] = time.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return "TBA";
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${m.toString().padStart(2, "0")} ${period}`;
}

function getDayLabel(dateStr: string): string {
  const eventDate = new Date(dateStr + "T12:00:00");
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  const toDateOnly = (d: Date) =>
    `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

  if (toDateOnly(eventDate) === toDateOnly(today)) return "Today";
  if (toDateOnly(eventDate) === toDateOnly(tomorrow)) return "Tomorrow";
  return eventDate.toLocaleDateString("en-US", { weekday: "long" });
}

export default function DiscoverComingUpSection({ events, onEventClick }: DiscoverComingUpSectionProps) {
  const dayGroups = useMemo(() => {
    const groups = new Map<string, { label: string; events: FeedEvent[] }>();

    for (const event of events) {
      const key = event.start_date;
      if (!groups.has(key)) {
        groups.set(key, { label: getDayLabel(key), events: [] });
      }
      const group = groups.get(key)!;
      if (group.events.length < 3) {
        group.events.push(event);
      }
    }

    // Cap at 5 days
    return Array.from(groups.entries())
      .slice(0, 5)
      .map(([, group]) => group);
  }, [events]);

  if (events.length === 0) return null;

  return (
    <section id="coming-up" className="space-y-6">
      <h2 className="font-display text-2xl text-[var(--hotel-charcoal)]">Coming Up</h2>

      {dayGroups.map((group) => (
        <div key={group.label}>
          {/* Day group header with line separator */}
          <div className="flex items-center gap-3 mb-3">
            <p className="font-body text-sm font-semibold uppercase tracking-wider text-[var(--hotel-stone)] shrink-0">
              {group.label}
            </p>
            <div className="flex-1 h-px bg-[var(--hotel-sand)]" />
          </div>

          <div className="space-y-2">
            {group.events.map((event) => {
              const hasImage = Boolean(event.image_url);
              if (hasImage) {
                const imgSrc = getProxiedImageSrc(event.image_url!);
                const resolvedSrc = typeof imgSrc === "string" ? imgSrc : event.image_url!;
                return (
                  <button
                    key={event.id}
                    onClick={() => onEventClick?.(event)}
                    className="w-full p-3 rounded-xl border border-[var(--hotel-sand)] bg-white flex gap-3 hover:shadow-md transition-shadow text-left"
                  >
                    <div className="w-20 h-20 rounded-lg overflow-hidden shrink-0 bg-[var(--hotel-cream)]">
                      <img
                        src={resolvedSrc}
                        alt={event.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1 py-1">
                      <p className="font-body font-semibold text-base text-[var(--hotel-charcoal)] leading-snug line-clamp-2">
                        {event.title}
                      </p>
                      <p className="font-body text-sm text-[var(--hotel-stone)] truncate">
                        {[event.venue_name, formatTime(event.start_time)]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                  </button>
                );
              }

              // Text-only row for events without images
              return (
                <button
                  key={event.id}
                  onClick={() => onEventClick?.(event)}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--hotel-sand)] bg-white hover:shadow-sm transition-shadow text-left"
                >
                  <p className="font-body font-medium text-base text-[var(--hotel-charcoal)] leading-snug">
                    {event.title}
                  </p>
                  <p className="font-body text-sm text-[var(--hotel-stone)] mt-0.5">
                    {[event.venue_name, formatTime(event.start_time)]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}
