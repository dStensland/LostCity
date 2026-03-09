"use client";
/* eslint-disable @next/next/no-img-element */

import type { FeedEvent, DayPart } from "@/lib/forth-types";
import { getConciergeReasonChips } from "@/lib/concierge/event-relevance";

interface DiscoverTonightSectionProps {
  events: FeedEvent[];
  dayPart: DayPart;
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

export function DiscoverTonightSection({ events, dayPart, onEventClick }: DiscoverTonightSectionProps) {
  if (events.length === 0) return null;

  const visible = events.slice(0, 8);

  return (
    <section id="tonight" className="space-y-3">
      {/* Section header */}
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="font-display text-2xl text-[var(--hotel-charcoal)]">Tonight</h2>
          <p className="text-sm font-body text-[var(--hotel-stone)] mt-0.5">
            Our picks for guests this evening
          </p>
        </div>
        <span className="text-sm font-body text-[var(--hotel-stone)]">{events.length} events</span>
      </div>

      {/* 2-column grid on desktop, single column on mobile */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {visible.map((event) => {
          const chips = getConciergeReasonChips(event, dayPart);

          const metaParts: string[] = [];
          if (event.venue_name) metaParts.push(event.venue_name);
          metaParts.push(formatTime(event.start_time));

          return (
            <button
              key={event.id}
              onClick={() => onEventClick?.(event)}
              className="w-full p-3 rounded-xl border border-[var(--hotel-sand)] bg-white flex gap-3 hover:shadow-md transition-shadow text-left"
            >
              {/* Thumbnail */}
              <div className="w-20 h-20 rounded-lg overflow-hidden shrink-0 bg-[var(--hotel-cream)]">
                {event.image_url ? (
                  <img
                    src={event.image_url}
                    alt={event.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full bg-[var(--hotel-cream)]" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 space-y-1.5">
                <h3 className="font-body font-semibold text-base text-[var(--hotel-charcoal)] leading-snug line-clamp-2">
                  {event.title}
                </h3>

                {metaParts.length > 0 && (
                  <p className="font-body text-sm text-[var(--hotel-stone)] truncate">
                    {metaParts.join(" · ")}
                  </p>
                )}

                {chips.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {chips.map((chip) => (
                      <span
                        key={chip}
                        className="text-xs font-body px-2 py-0.5 rounded-full bg-[var(--hotel-cream)] text-[var(--hotel-stone)] border border-[var(--hotel-sand)]"
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
