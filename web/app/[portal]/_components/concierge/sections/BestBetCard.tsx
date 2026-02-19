"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useEffect, useRef } from "react";
import type { FeedEvent, DayPart } from "@/lib/forth-types";
import { getProxiedImageSrc } from "@/lib/image-proxy";
import {
  buildReasonChipInfluenceMetadata,
  trackConciergeReasonChipImpression,
  trackConciergeResource,
} from "@/lib/analytics/concierge-tracking";
import ItineraryQuickAddButton from "./ItineraryQuickAddButton";

interface BestBetCardProps {
  event: FeedEvent;
  portalId: string;
  portalSlug: string;
  dayPart: DayPart;
  conciergePhone?: string;
  weatherBadge?: string | null;
  reasonChips?: string[];
}

const DAYPART_LABELS: Record<DayPart, string> = {
  morning: "This Morning",
  afternoon: "This Afternoon",
  evening: "Tonight\u2019s Pick",
  late_night: "Late Night Pick",
};

function formatTime(time: string | null | undefined): string {
  if (!time) return "";
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${m} ${ampm}`;
}

export default function BestBetCard({
  event,
  portalId,
  portalSlug,
  dayPart,
  conciergePhone,
  weatherBadge,
  reasonChips = [],
}: BestBetCardProps) {
  const imgSrc = event.image_url ? getProxiedImageSrc(event.image_url) : null;
  const resolvedImg = typeof imgSrc === "string" ? imgSrc : event.image_url;
  const label = DAYPART_LABELS[dayPart];
  const eventHref = `/${portalSlug}?event=${event.id}`;
  const cardRef = useRef<HTMLAnchorElement | null>(null);
  const reasonChipSeenRef = useRef(false);

  useEffect(() => {
    if (!cardRef.current || reasonChips.length === 0) return;

    const element = cardRef.current;
    const impressionMetadata = {
      context_key: "best_bet",
      day_part: dayPart,
    };

    const trackImpression = () => {
      if (reasonChipSeenRef.current) return;
      reasonChipSeenRef.current = true;
      trackConciergeReasonChipImpression(portalSlug, {
        sectionKey: "best_bet",
        targetKind: "event",
        targetId: event.id,
        targetLabel: event.title,
        reasonChips,
        metadata: impressionMetadata,
      });
    };

    if (typeof IntersectionObserver === "undefined") {
      trackImpression();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.55) {
            trackImpression();
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: [0.55] },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [portalSlug, event.id, event.title, reasonChips, dayPart]);

  return (
    <article className="w-full overflow-hidden rounded-2xl bg-[var(--hotel-charcoal)] shadow-xl transition-shadow duration-500 hover:shadow-2xl concierge-card-enter">
      <Link
        ref={cardRef}
        href={eventHref}
        onClick={() => {
          const metadata = buildReasonChipInfluenceMetadata(reasonChips, {
            day_part: dayPart,
            weather_badge: weatherBadge || undefined,
            context_key: "best_bet",
            reason_chip_seen_in_viewport: reasonChipSeenRef.current,
          });

          trackConciergeResource(portalSlug, {
            sectionKey: "best_bet",
            targetKind: "event",
            targetId: event.id,
            targetLabel: event.title,
            targetUrl: eventHref,
            metadata,
          });
        }}
        className="group block relative"
      >
        <div className="relative aspect-[21/9] md:aspect-[3/1] overflow-hidden">
          {resolvedImg && (
            <img
              src={resolvedImg}
              alt={event.title}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              loading="eager"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />

          {/* Label badge */}
          <div className="absolute top-4 left-4 md:top-6 md:left-6">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--hotel-champagne)] text-[var(--hotel-ink)] text-xs font-body font-semibold uppercase tracking-[0.1em]">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              {label}
            </span>
          </div>

          {/* Weather badge */}
          {weatherBadge && (
            <div className="absolute top-4 right-4 md:top-6 md:right-6">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-sm text-white text-xs font-body">
                {weatherBadge}
              </span>
            </div>
          )}

          {/* Content */}
          <div className="absolute bottom-0 left-0 right-0 p-5 md:p-8">
            <div className="flex items-end justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h2 className="font-display text-2xl md:text-3xl lg:text-4xl text-white tracking-tight mb-2 line-clamp-2">
                  {event.title}
                </h2>
                {reasonChips.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 mb-2">
                    {reasonChips.map((reason) => (
                      <span
                        key={reason}
                        className="inline-flex items-center px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm text-[11px] leading-none text-white/95 font-body"
                      >
                        {reason}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/70 font-body">
                  {event.venue_name && <span>{event.venue_name}</span>}
                  {event.start_time && (
                    <>
                      <span className="text-white/30">&middot;</span>
                      <span>{formatTime(event.start_time)}</span>
                    </>
                  )}
                  {event.is_free && (
                    <>
                      <span className="text-white/30">&middot;</span>
                      <span className="text-emerald-400 font-medium">Free</span>
                    </>
                  )}
                  {!event.is_free && event.price_min != null && (
                    <>
                      <span className="text-white/30">&middot;</span>
                      <span>From ${event.price_min}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="shrink-0">
                <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[var(--hotel-champagne)] text-[var(--hotel-ink)] text-sm font-body font-semibold transition-all group-hover:brightness-110 group-hover:shadow-lg group-hover:shadow-[var(--hotel-champagne)]/25">
                  View Details
                  <svg className="w-4 h-4 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </div>
            </div>
          </div>
        </div>
      </Link>
      <div className="border-t border-white/10 bg-black/45 px-5 py-3 md:px-8">
        <ItineraryQuickAddButton
          event={event}
          portalId={portalId}
          portalSlug={portalSlug}
          sectionKey="best_bet_quick_add"
          conciergePhone={conciergePhone}
        />
      </div>
    </article>
  );
}
