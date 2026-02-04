"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { formatTimeSplit } from "@/lib/formats";
import { getCategoryColor } from "@/lib/category-config";
import CategoryIcon from "./CategoryIcon";
import CategoryPlaceholder from "./CategoryPlaceholder";
import FeedSectionHeader from "./feed/FeedSectionHeader";

type TonightEvent = {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  is_all_day: boolean;
  is_free: boolean;
  category: string | null;
  image_url: string | null;
  venue: {
    name: string;
    neighborhood: string | null;
  } | null;
};

// Dynamic badge text based on event timing
function getTimeBadge(startTime: string | null, isAllDay: boolean): { text: string; isNow: boolean } {
  if (isAllDay || !startTime) return { text: "TODAY", isNow: false };

  const now = new Date();
  const [hours, minutes] = startTime.split(":").map(Number);
  const eventMinutes = hours * 60 + minutes;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const diffMinutes = eventMinutes - nowMinutes;

  // Within 2 hours before or 1 hour after start = "NOW"
  if (diffMinutes <= 120 && diffMinutes >= -60) {
    return { text: "NOW", isNow: true };
  }
  // Evening events (6pm+) = "TONIGHT"
  if (hours >= 18) {
    return { text: "TONIGHT", isNow: false };
  }
  return { text: "TODAY", isNow: false };
}

export default function TonightsPicks({ portalSlug }: { portalSlug?: string } = {}) {
  const [events, setEvents] = useState<TonightEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchEvents() {
      try {
        const response = await fetch("/api/tonight");
        if (!response.ok) {
          setEvents([]);
          return;
        }
        const data = await response.json();
        setEvents(data.events || []);
      } catch (error) {
        console.error("Failed to fetch tonight events:", error);
        setEvents([]);
      } finally {
        setLoading(false);
      }
    }
    fetchEvents();
  }, []);

  if (loading) {
    return null; // Parent Suspense will show skeleton
  }

  if (events.length === 0) {
    return null;
  }

  const heroEvent = events[0];
  const otherEvents = events.slice(1, 4);
  const heroCategory = heroEvent.category ? getCategoryColor(heroEvent.category) : "var(--neon-magenta)";

  return (
    <section className="py-8 -mx-4 px-4 mb-2 relative overflow-hidden">
      {/* Atmospheric background glow */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 50% 0%, ${heroCategory}22 0%, transparent 70%)`,
        }}
      />

      <div className="relative">
        <FeedSectionHeader
          title="Today's Highlights"
          subtitle="Hand-picked for right now"
          priority="primary"
          accentColor="var(--neon-amber)"
          icon={
            <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
              <path
                d="M12 2C12 2 6 8 6 14C6 18 8.5 21 12 21C15.5 21 18 18 18 14C18 8 12 2 12 2Z"
                fill="currentColor"
                style={{ filter: "drop-shadow(0 0 4px currentColor)" }}
              />
              <path
                d="M12 6C12 6 9 10 9 14C9 16 10 17.5 12 17.5C14 17.5 15 16 15 14C15 10 12 6 12 6Z"
                fill="var(--void)"
                opacity="0.3"
              />
            </svg>
          }
          seeAllHref={portalSlug ? `/${portalSlug}?view=events&date=today` : `/?view=events&date=today`}
          seeAllLabel="View all"
        />

        {/* Hero card with optimized image loading */}
        <Link
          href={portalSlug ? `/${portalSlug}?event=${heroEvent.id}` : `/events/${heroEvent.id}`}
          scroll={false}
          className="block relative rounded-2xl overflow-hidden mb-4 group card-atmospheric card-hero transition-transform duration-300 hover:scale-[1.01]"
          style={{
            "--glow-color": heroCategory,
            willChange: "transform",
          } as React.CSSProperties}
        >
          {/* Background - optimized for performance */}
          {heroEvent.image_url ? (
            <>
              <div
                className="absolute inset-0 transition-transform duration-700 group-hover:scale-105"
                style={{
                  backgroundImage: `url(${heroEvent.image_url})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  willChange: "transform",
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-black/20" />
            </>
          ) : (
            <CategoryPlaceholder category={heroEvent.category} size="lg" />
          )}

          {/* Content */}
          <div className="relative p-5 pt-32">
            <div className="flex items-center gap-2 mb-2">
              {(() => {
                const badge = getTimeBadge(heroEvent.start_time, heroEvent.is_all_day);
                return (
                  <span className={`px-2 py-0.5 rounded-full text-[0.65rem] font-mono font-medium backdrop-blur-sm ${
                    badge.isNow
                      ? "bg-[var(--neon-red)]/30 text-[var(--neon-red)]"
                      : "bg-[var(--neon-magenta)]/30 text-[var(--neon-magenta)]"
                  }`}>
                    {badge.text}
                  </span>
                );
              })()}
              {heroEvent.category && (
                <span
                  className="px-2 py-0.5 rounded-full text-[0.65rem] font-mono font-medium"
                  style={{ backgroundColor: `${heroCategory}33`, color: heroCategory }}
                >
                  <CategoryIcon type={heroEvent.category} size={10} className="inline mr-1" glow="none" />
                  {heroEvent.category}
                </span>
              )}
            </div>

            <h3 className="text-xl font-semibold text-white mb-2 group-hover:text-[var(--neon-magenta)] transition-colors line-clamp-2">
              {heroEvent.title}
            </h3>

            <div className="flex items-center gap-2 text-sm text-white/80 font-mono">
              {heroEvent.start_time && (
                <span className="font-medium">
                  {formatTimeSplit(heroEvent.start_time, heroEvent.is_all_day).time}
                  <span className="opacity-60 ml-0.5 text-xs">
                    {formatTimeSplit(heroEvent.start_time, heroEvent.is_all_day).period}
                  </span>
                </span>
              )}
              {heroEvent.venue && (
                <>
                  <span className="opacity-40">·</span>
                  <span>{heroEvent.venue.name}</span>
                </>
              )}
              {heroEvent.is_free && (
                <>
                  <span className="opacity-40">·</span>
                  <span className="text-[var(--neon-green)]">Free</span>
                </>
              )}
            </div>
          </div>

          {/* Hover arrow */}
          <div className="absolute bottom-4 right-4 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>

        {/* Other tonight events */}
        {otherEvents.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {otherEvents.map((event) => {
              const categoryColor = event.category ? getCategoryColor(event.category) : null;
              return (
                <Link
                  key={event.id}
                  href={portalSlug ? `/${portalSlug}?event=${event.id}` : `/events/${event.id}`}
                  scroll={false}
                  className="block p-3 rounded-xl bg-[var(--dusk)]/80 border border-[var(--twilight)] hover:border-[var(--neon-magenta)]/40 transition-all group card-atmospheric"
                  style={{
                    "--glow-color": categoryColor || "var(--neon-magenta)",
                  } as React.CSSProperties}
                >
                  <div className="font-mono text-[0.6rem] text-[var(--muted)] mb-1">
                    {event.start_time ? formatTimeSplit(event.start_time, event.is_all_day).time : "Today"}
                  </div>
                  <h4 className="text-sm text-[var(--cream)] font-medium line-clamp-2 group-hover:text-[var(--neon-magenta)] transition-colors mb-1">
                    {event.title}
                  </h4>
                  {event.venue && (
                    <p className="font-mono text-[0.55rem] text-[var(--muted)] truncate">
                      {event.venue.name}
                    </p>
                  )}
                </Link>
              );
            })}
          </div>
        )}

      </div>
    </section>
  );
}
