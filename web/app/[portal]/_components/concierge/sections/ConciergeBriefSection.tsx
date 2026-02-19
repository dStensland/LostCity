"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import Link from "next/link";
import type { DayPart, FeedEvent } from "@/lib/forth-types";
import { getProxiedImageSrc } from "@/lib/image-proxy";
import { getConciergeReasonChips } from "@/lib/concierge/event-relevance";
import {
  buildReasonChipInfluenceMetadata,
  trackConciergeResource,
} from "@/lib/analytics/concierge-tracking";
import ItineraryQuickAddButton from "./ItineraryQuickAddButton";

interface ConciergeBriefSectionProps {
  portalId: string;
  portalSlug: string;
  dayPart: DayPart;
  events: FeedEvent[];
  conciergePhone?: string;
  weatherAnnotation?: string | null;
}

const DAYPART_CONTEXT: Record<DayPart, string> = {
  morning: "this morning",
  afternoon: "this afternoon",
  evening: "tonight",
  late_night: "late tonight",
};

function formatTime(time: string | null | undefined): string | null {
  if (!time) return null;
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${m} ${ampm}`;
}

function formatDistance(distanceKm: number | null | undefined): string | null {
  if (distanceKm == null) return null;
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)}m`;
  return `${distanceKm.toFixed(1)}km`;
}

export default function ConciergeBriefSection({
  portalId,
  portalSlug,
  dayPart,
  events,
  conciergePhone,
  weatherAnnotation,
}: ConciergeBriefSectionProps) {
  const [expanded, setExpanded] = useState(false);
  if (events.length === 0) return null;
  const featured = events[0];
  const secondary = events.slice(1, 3);

  const featuredHref = `/${portalSlug}?event=${featured.id}`;
  const featuredReasonChips = getConciergeReasonChips(featured, dayPart).slice(0, 1);
  const featuredTime = formatTime(featured.start_time);
  const featuredDistance = formatDistance(featured.distance_km);
  const featuredImage = featured.image_url ? getProxiedImageSrc(featured.image_url) : null;
  const resolvedFeaturedImage = typeof featuredImage === "string" ? featuredImage : featured.image_url;

  return (
    <section id="tonight" className="space-y-3">
      <div className="rounded-2xl border border-[var(--hotel-sand)] bg-[var(--hotel-cream)] p-4 md:p-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="inline-flex items-center rounded-full bg-[var(--hotel-charcoal)] px-2.5 py-1 text-[10px] font-body uppercase tracking-[0.16em] text-white">
            Concierge Brief
          </span>
          <span className="text-xs font-body text-[var(--hotel-stone)]">
            Curated for {DAYPART_CONTEXT[dayPart]}
          </span>
        </div>
        <p className="mt-2 text-sm font-body text-[var(--hotel-stone)]">
          One strong recommendation first.
          {weatherAnnotation ? ` ${weatherAnnotation}` : " You can expand for two more picks."}
        </p>
      </div>

      <article className="overflow-hidden rounded-2xl border border-[var(--hotel-sand)] bg-[var(--hotel-cream)] shadow-[var(--hotel-shadow-soft)]">
        <Link
          href={featuredHref}
          onClick={() => {
            const metadata = buildReasonChipInfluenceMetadata(featuredReasonChips, {
              context_key: "concierge_brief",
              rank: 1,
              day_part: dayPart,
            });
            trackConciergeResource(portalSlug, {
              sectionKey: "concierge_brief",
              targetKind: "event",
              targetId: String(featured.id),
              targetLabel: featured.title,
              targetUrl: featuredHref,
              metadata,
            });
          }}
          className="group block"
        >
          <div className="relative aspect-[16/9] overflow-hidden bg-[var(--hotel-sand)]">
            {resolvedFeaturedImage ? (
              <img
                src={resolvedFeaturedImage}
                alt={featured.title}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-[var(--hotel-sand)] to-[var(--hotel-cream)]" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/20 to-transparent" />
          </div>
          <div className="space-y-2 p-4">
            <h2 className="font-display text-xl text-[var(--hotel-charcoal)] line-clamp-2">
              {featured.title}
            </h2>
            {featuredReasonChips[0] && (
              <span className="inline-flex rounded-full border border-[var(--hotel-sand)] bg-[var(--hotel-ivory)] px-2.5 py-1 text-[10px] font-body uppercase tracking-[0.08em] text-[var(--hotel-stone)]">
                {featuredReasonChips[0]}
              </span>
            )}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-body text-[var(--hotel-stone)]">
              {featuredTime && <span>{featuredTime}</span>}
              {featured.venue_name && (
                <>
                  <span>&middot;</span>
                  <span>{featured.venue_name}</span>
                </>
              )}
              {featuredDistance && (
                <>
                  <span>&middot;</span>
                  <span>{featuredDistance} away</span>
                </>
              )}
            </div>
          </div>
        </Link>

        <div className="border-t border-[var(--hotel-sand)] px-4 pb-4 pt-3">
          <ItineraryQuickAddButton
            event={featured}
            portalId={portalId}
            portalSlug={portalSlug}
            sectionKey="concierge_brief_quick_add"
            conciergePhone={conciergePhone}
            tone="light"
          />
        </div>
      </article>

      {secondary.length > 0 && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="w-full rounded-xl border border-[var(--hotel-sand)] bg-[var(--hotel-cream)] px-4 py-3 text-left text-sm font-body text-[var(--hotel-charcoal)] hover:bg-[var(--hotel-ivory)] transition-colors"
          >
            {expanded ? "Hide two more picks" : "Show two more picks"}
          </button>
          {expanded && (
            <div className="grid gap-2">
              {secondary.map((event, index) => {
                const href = `/${portalSlug}?event=${event.id}`;
                const reason = getConciergeReasonChips(event, dayPart)[0];
                const time = formatTime(event.start_time);

                return (
                  <Link
                    key={`${event.id}:${event.start_date}:${event.start_time || ""}`}
                    href={href}
                    onClick={() => {
                      const metadata = buildReasonChipInfluenceMetadata(
                        reason ? [reason] : [],
                        {
                          context_key: "concierge_brief",
                          rank: index + 2,
                          day_part: dayPart,
                        },
                      );

                      trackConciergeResource(portalSlug, {
                        sectionKey: "concierge_brief",
                        targetKind: "event",
                        targetId: String(event.id),
                        targetLabel: event.title,
                        targetUrl: href,
                        metadata,
                      });
                    }}
                    className="rounded-xl border border-[var(--hotel-sand)] bg-[var(--hotel-cream)] px-4 py-3 hover:bg-[var(--hotel-ivory)] transition-colors"
                  >
                    <p className="font-display text-base text-[var(--hotel-charcoal)] line-clamp-1">
                      {event.title}
                    </p>
                    <p className="mt-1 text-xs font-body text-[var(--hotel-stone)]">
                      {time || "Today"}
                      {event.venue_name ? ` · ${event.venue_name}` : ""}
                      {reason ? ` · ${reason}` : ""}
                    </p>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
