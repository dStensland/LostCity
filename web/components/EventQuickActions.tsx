"use client";

import { formatPriceDetailed } from "@/lib/formats";
import { format, parseISO } from "date-fns";
import RSVPButton from "./RSVPButton";
import AddToCalendar from "./AddToCalendar";
import ShareEventButton from "./ShareEventButton";

interface EventQuickActionsProps {
  event: {
    id: number;
    title: string;
    start_date: string;
    start_time: string | null;
    end_time: string | null;
    is_all_day?: boolean;
    ticket_url: string | null;
    source_url: string | null;
    is_free: boolean;
    price_min: number | null;
    price_max: number | null;
    category: string | null;
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

// Known ticketing platform domains
const TICKETING_DOMAINS = [
  "eventbrite.com",
  "ticketmaster.com",
  "axs.com",
  "dice.fm",
  "seetickets.us",
  "etix.com",
  "ticketweb.com",
  "showclix.com",
  "ticketfly.com",
  "universe.com",
  "resident-advisor.net",
  "songkick.com",
];

function isTicketingUrl(url: string | null): boolean {
  if (!url) return false;
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return TICKETING_DOMAINS.some(domain => hostname.includes(domain));
  } catch {
    return false;
  }
}

export default function EventQuickActions({ event, isLive, className = "" }: EventQuickActionsProps) {
  const { text: priceText, isFree } = formatPriceDetailed(event);
  const dateObj = parseISO(event.start_date);
  const dateDisplay = format(dateObj, "EEE, MMM d");
  const isActuallyTicketed = isTicketingUrl(event.ticket_url);

  // Format time
  const timeDisplay = event.is_all_day
    ? "All Day"
    : event.start_time
      ? (() => {
          const [hours, minutes] = event.start_time.split(":");
          const hour = parseInt(hours, 10);
          const period = hour >= 12 ? "PM" : "AM";
          const hour12 = hour % 12 || 12;
          return `${hour12}:${minutes} ${period}`;
        })()
      : "Time TBA";

  return (
    <div
      className={`rounded-xl border border-[var(--twilight)] bg-[var(--card-bg)] ${className}`}
    >
      {/* Summary row: Price | Date | Time */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--twilight)]">
        <div className="flex items-center gap-4 text-sm">
          {/* Price - prominent (hide if unknown/dash) */}
          {priceText !== "—" && (
            <>
              <span
                className={`font-mono font-bold text-base ${
                  isFree ? "text-[var(--neon-green)]" : "text-[var(--gold)]"
                }`}
              >
                {priceText}
              </span>
              <span className="text-[var(--twilight)]">·</span>
            </>
          )}

          {/* Date */}
          <span className="text-[var(--cream)] font-medium">
            {dateDisplay}
          </span>

          <span className="text-[var(--twilight)]">·</span>

          {/* Time */}
          <span className="text-[var(--soft)]">
            {timeDisplay}
          </span>
        </div>

        {/* Secondary actions - desktop */}
        <div className="hidden sm:flex items-center gap-1">
          <AddToCalendar
            title={event.title}
            date={event.start_date}
            time={event.start_time}
            venue={event.venue?.name}
            address={event.venue?.address}
            city={event.venue?.city}
            state={event.venue?.state}
            variant="icon"
          />
          <ShareEventButton eventId={event.id} eventTitle={event.title} variant="icon" />
        </div>
      </div>

      {/* Primary CTA row */}
      <div className="p-3 flex items-center gap-3">
        {/* Primary CTA - Get Tickets (for ticketing sites), Check it out (for other links), or RSVP */}
        {event.ticket_url ? (
          <a
            href={event.ticket_url}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex-1 inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-[var(--coral)] text-[var(--void)] text-base font-semibold rounded-lg hover:bg-[var(--rose)] transition-all shadow-[0_0_20px_rgba(255,107,122,0.3)] hover:shadow-[0_0_30px_rgba(255,107,122,0.5)] ${
              isLive ? "animate-pulse-glow" : ""
            }`}
          >
            {isActuallyTicketed ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            )}
            {isLive ? "Join Now" : isActuallyTicketed ? "Get Tickets" : event.is_free ? "RSVP Free" : "Learn More"}
          </a>
        ) : event.source_url ? (
          <a
            href={event.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-[var(--coral)] text-[var(--void)] text-base font-semibold rounded-lg hover:bg-[var(--rose)] transition-all shadow-[0_0_20px_rgba(255,107,122,0.3)] hover:shadow-[0_0_30px_rgba(255,107,122,0.5)]"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            {event.is_free ? "RSVP Free" : "Learn More"}
          </a>
        ) : (
          <RSVPButton eventId={event.id} variant="primary" className="flex-1 justify-center py-3.5 text-base" />
        )}

        {/* RSVP as secondary when there's a ticket URL or source URL */}
        {(event.ticket_url || event.source_url) && (
          <RSVPButton eventId={event.id} variant="compact" />
        )}

        {/* Mobile secondary actions */}
        <div className="flex sm:hidden items-center gap-1">
          <ShareEventButton eventId={event.id} eventTitle={event.title} variant="icon" />
        </div>
      </div>
    </div>
  );
}
