"use client";

import RSVPButton from "./RSVPButton";
import RecommendButton from "./RecommendButton";
import AddToCalendar from "./AddToCalendar";
import ShareEventButton from "./ShareEventButton";
import { getCategoryColor } from "./CategoryIcon";
import { formatPrice, formatDuration } from "@/lib/formats";

interface EventActionCardProps {
  event: {
    id: number;
    title: string;
    start_date: string;
    start_time: string | null;
    end_time: string | null;
    ticket_url: string | null;
    source_url: string;
    is_free: boolean;
    price_min: number | null;
    price_max: number | null;
    price_note: string | null;
    category: string | null;
    attendee_count?: number | null;
    venue?: {
      name?: string;
      address?: string | null;
      city?: string;
      state?: string;
    } | null;
  };
  isLive?: boolean;
  className?: string;
}

export default function EventActionCard({ event, isLive, className = "" }: EventActionCardProps) {
  const categoryColor = event.category ? getCategoryColor(event.category) : "var(--coral)";
  const duration = formatDuration(event.start_time, event.end_time);
  const priceDisplay = formatPrice(event);
  const hasRange = event.price_max && event.price_min && event.price_max !== event.price_min;

  return (
    <div
      className={`relative rounded-lg border border-[var(--twilight)] animate-card-emerge ${className}`}
      style={{
        backgroundColor: "var(--card-bg)",
        animationDelay: "0.1s",
      }}
    >
      {/* Category gradient top border */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px] rounded-t-lg"
        style={{
          background: `linear-gradient(to right, ${categoryColor}, transparent)`,
        }}
      />

      <div className="p-5 sm:p-6">
        {/* Quick Stats Row */}
        <div className="flex items-center gap-4 mb-5 text-sm">
          {/* Price */}
          <div className="flex items-center gap-2">
            <span
              className={`font-mono text-lg font-bold ${
                event.is_free ? "text-[var(--neon-green)]" : "text-[var(--gold)]"
              }`}
            >
              {priceDisplay}
            </span>
            {hasRange && (
              <span className="text-[var(--muted)] text-xs font-mono">range</span>
            )}
          </div>

          {/* Divider */}
          <div className="w-px h-5 bg-[var(--twilight)]" />

          {/* Duration */}
          {duration && (
            <>
              <div className="flex items-center gap-1.5 text-[var(--soft)]">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-mono text-sm">{duration}</span>
              </div>
              <div className="w-px h-5 bg-[var(--twilight)]" />
            </>
          )}

          {/* Attendee count */}
          {event.attendee_count && event.attendee_count > 0 && (
            <div className="flex items-center gap-1.5 text-[var(--soft)]">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span className="font-mono text-sm">{event.attendee_count} going</span>
            </div>
          )}
        </div>

        {/* Price note if present */}
        {event.price_note && (
          <p className="text-xs text-[var(--muted)] mb-4 font-mono">
            {event.price_note}
          </p>
        )}

        {/* Primary CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          {/* Get Tickets - Primary CTA */}
          {event.ticket_url ? (
            <a
              href={event.ticket_url}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex-1 inline-flex items-center justify-center gap-2.5 px-6 py-3.5 bg-[var(--coral)] text-[var(--void)] text-base font-semibold rounded-lg hover:bg-[var(--rose)] transition-all glow-sm hover:glow ${
                isLive ? "animate-pulse-glow" : ""
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
              </svg>
              {isLive ? "Join Now" : "Get Tickets"}
            </a>
          ) : (
            <div className="flex-1">
              <RSVPButton eventId={event.id} variant="primary" className="w-full justify-center text-base py-3.5" />
            </div>
          )}

          {/* Add to Calendar */}
          <AddToCalendar
            title={event.title}
            date={event.start_date}
            time={event.start_time}
            venue={event.venue?.name}
            address={event.venue?.address}
            city={event.venue?.city}
            state={event.venue?.state}
          />
        </div>

        {/* Secondary Actions Row */}
        <div className="flex items-center justify-between gap-3 pt-4 border-t border-[var(--twilight)]">
          <div className="flex items-center gap-2">
            {event.ticket_url && <RSVPButton eventId={event.id} variant="compact" />}
            <RecommendButton eventId={event.id} />
          </div>

          <div className="flex items-center gap-2">
            {event.source_url && (
              <a
                href={event.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center w-10 h-10 text-[var(--muted)] rounded-lg hover:bg-[var(--twilight)] hover:text-[var(--cream)] transition-colors"
                aria-label="View source"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}
            <ShareEventButton eventId={event.id} eventTitle={event.title} />
          </div>
        </div>
      </div>
    </div>
  );
}
