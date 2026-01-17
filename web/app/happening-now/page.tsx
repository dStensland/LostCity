"use client";

import { useLiveEvents } from "@/lib/hooks/useLiveEvents";
import Link from "next/link";
import { formatTimeSplit } from "@/lib/formats";
import SaveButton from "@/components/SaveButton";
import FriendsGoing from "@/components/FriendsGoing";

export default function HappeningNowPage() {
  const { events, loading, count } = useLiveEvents();

  return (
    <div className="min-h-screen bg-[var(--void)]">
      {/* Header */}
      <header className="sticky top-0 z-40 px-4 sm:px-6 py-4 glass border-b border-[var(--twilight)]/50">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link
            href="/"
            className="text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="sr-only">Back to home</span>
          </Link>

          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full bg-[var(--neon-red)] animate-pulse"
              style={{
                boxShadow: "0 0 8px var(--neon-red), 0 0 16px var(--neon-red)",
              }}
            />
            <h1 className="font-display text-lg font-semibold text-[var(--cream)]">
              Happening Now
            </h1>
            {count > 0 && (
              <span className="font-mono text-xs text-[var(--muted)]">
                ({count})
              </span>
            )}
          </div>

          <div className="w-5" /> {/* Spacer for centering */}
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="animate-pulse rounded-xl bg-[var(--dusk)] h-32"
              />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-16">
            <div
              className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--twilight)] flex items-center justify-center"
              style={{
                boxShadow: "0 0 20px rgba(232, 85, 160, 0.1)",
              }}
            >
              <svg
                className="w-8 h-8 text-[var(--muted)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h2 className="font-serif text-xl text-[var(--cream)] italic mb-2">
              Nothing happening right now
            </h2>
            <p className="text-[var(--muted)] font-mono text-sm max-w-xs mx-auto">
              Check back later to see live events as they&apos;re happening around the city.
            </p>
            <Link
              href="/"
              className="inline-block mt-6 px-4 py-2 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg font-mono text-sm text-[var(--cream)] hover:bg-[var(--twilight)] transition-colors"
            >
              Browse upcoming events
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {events.map((event, index) => {
              const { time, period } = formatTimeSplit(event.start_time, event.is_all_day);
              const categoryColor = event.category
                ? `var(--cat-${event.category === "food_drink" ? "food" : event.category})`
                : "var(--muted)";

              return (
                <Link
                  key={event.id}
                  href={`/events/${event.id}`}
                  className={`card-interactive rounded-xl p-4 block group animate-fade-in ${
                    index < 10 ? `stagger-${index + 1}` : ""
                  }`}
                >
                  <div className="flex gap-4">
                    {/* Live indicator column */}
                    <div className="flex-shrink-0 w-16 text-center pt-1">
                      <div className="text-lg font-semibold text-[var(--cream)] font-mono">
                        {time}
                      </div>
                      {period && (
                        <div className="text-xs text-[var(--muted)] font-mono uppercase">
                          {period}
                        </div>
                      )}
                      {/* Prominent live indicator */}
                      <div className="mt-2 flex items-center justify-center gap-1">
                        <span
                          className="w-2 h-2 rounded-full bg-[var(--neon-red)] animate-pulse"
                          style={{
                            boxShadow: "0 0 6px var(--neon-red), 0 0 12px var(--neon-red)",
                          }}
                        />
                        <span className="font-mono text-[0.65rem] font-medium text-[var(--neon-red)] animate-pulse-glow">
                          LIVE
                        </span>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Badges */}
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {event.category && (
                          <span
                            className="cat-tag text-[0.6rem] font-mono font-semibold uppercase tracking-wide px-2 py-0.5 rounded"
                            style={{ color: categoryColor }}
                          >
                            {event.category.replace("_", " ")}
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <h3 className="font-display text-lg font-semibold text-[var(--cream)] leading-snug line-clamp-2 group-hover:text-[var(--neon-magenta)] transition-colors">
                        {event.title}
                      </h3>

                      {/* Venue */}
                      {event.venue && (
                        <div className="flex items-center gap-2 mt-1.5 text-sm text-[var(--muted)]">
                          <svg
                            className="w-3.5 h-3.5 flex-shrink-0"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                          </svg>
                          <span className="truncate">{event.venue.name}</span>
                          {event.venue.neighborhood && (
                            <>
                              <span className="text-[var(--twilight)]">·</span>
                              <span className="text-[var(--muted)] opacity-70">
                                {event.venue.neighborhood}
                              </span>
                            </>
                          )}
                        </div>
                      )}

                      {/* Social proof */}
                      <div className="flex items-center justify-between mt-3">
                        <FriendsGoing
                          eventId={event.id}
                          fallbackCount={event.going_count || 0}
                        />
                        <SaveButton eventId={event.id} size="sm" />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
