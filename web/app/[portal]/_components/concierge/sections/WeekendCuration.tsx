"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import type { FeedEvent } from "@/lib/forth-types";
import { getProxiedImageSrc } from "@/lib/image-proxy";

interface WeekendCurationProps {
  events: FeedEvent[];
  portalSlug: string;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatTime(time: string | null | undefined): string {
  if (!time) return "";
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${m} ${ampm}`;
}

export default function WeekendCuration({ events, portalSlug }: WeekendCurationProps) {
  if (events.length === 0) return null;

  // First 2 events get large cards, rest get compact
  const featured = events.slice(0, 2);
  const remaining = events.slice(2, 6);

  return (
    <section className="space-y-5">
      <div>
        <h2 className="font-display text-2xl md:text-3xl text-[var(--hotel-charcoal)]">This Weekend</h2>
        <p className="text-sm font-body text-[var(--hotel-stone)] mt-1">
          Curated picks worth planning around
        </p>
      </div>

      {/* Featured weekend events — large editorial cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {featured.map((event) => {
          const imgSrc = event.image_url ? getProxiedImageSrc(event.image_url) : null;
          const resolvedImg = typeof imgSrc === "string" ? imgSrc : event.image_url;

          return (
            <Link
              key={event.id}
              href={`/${portalSlug}?event=${event.id}`}
              className="group block rounded-xl overflow-hidden border border-[var(--hotel-sand)] bg-[var(--hotel-cream)] shadow-sm hover:shadow-lg transition-all duration-500"
            >
              <div className="relative aspect-[16/10] overflow-hidden">
                {resolvedImg ? (
                  <img
                    src={resolvedImg}
                    alt={event.title}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-[var(--hotel-sand)] to-[var(--hotel-cream)]" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                <div className="absolute bottom-3 left-3 right-3">
                  <span className="text-xs uppercase tracking-[0.15em] text-white/70 font-body">
                    {formatDate(event.start_date)}
                    {event.start_time ? ` \u00B7 ${formatTime(event.start_time)}` : ""}
                  </span>
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-display text-lg text-[var(--hotel-charcoal)] line-clamp-2 mb-1">
                  {event.title}
                </h3>
                <div className="flex items-center gap-2 text-xs font-body text-[var(--hotel-stone)]">
                  {event.venue_name && <span>{event.venue_name}</span>}
                  {event.is_free && (
                    <>
                      <span>&middot;</span>
                      <span className="text-emerald-600 font-medium">Free</span>
                    </>
                  )}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[var(--hotel-charcoal)] text-white text-xs font-body font-medium transition-all group-hover:bg-[var(--hotel-champagne)] group-hover:text-[var(--hotel-ink)]">
                    View Details
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Remaining — compact list */}
      {remaining.length > 0 && (
        <div className="grid grid-cols-1 gap-2">
          {remaining.map((event) => (
            <Link
              key={event.id}
              href={`/${portalSlug}?event=${event.id}`}
              className="group flex items-center gap-4 p-3 rounded-xl border border-[var(--hotel-sand)] bg-[var(--hotel-cream)] hover:bg-[var(--hotel-sand)]/30 transition-colors"
            >
              {event.image_url && (
                <div className="shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-[var(--hotel-sand)]">
                  <img
                    src={typeof getProxiedImageSrc(event.image_url) === "string" ? getProxiedImageSrc(event.image_url) as string : event.image_url}
                    alt={event.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h4 className="font-display text-sm text-[var(--hotel-charcoal)] truncate">{event.title}</h4>
                <p className="text-xs font-body text-[var(--hotel-stone)] mt-0.5">
                  {formatDate(event.start_date)}
                  {event.venue_name ? ` \u00B7 ${event.venue_name}` : ""}
                </p>
              </div>
              <svg className="w-4 h-4 text-[var(--hotel-stone)] shrink-0 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
