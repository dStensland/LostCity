"use client";

import { memo } from "react";
import Link from "next/link";
import Image from "next/image";
import type { PlanningHorizonEvent, PlanningUrgency } from "@/lib/types/planning-horizon";
import { isTicketStatusStale } from "@/lib/types/planning-horizon";

interface PlanningHorizonCardProps {
  event: PlanningHorizonEvent & {
    urgency: PlanningUrgency;
    ticket_freshness: string | null;
  };
  portalSlug: string;
}

// ─── Urgency Badge ───────────────────────────────────────────────────────────

function UrgencyBadge({ urgency }: { urgency: PlanningUrgency }) {
  if (!urgency) return null;

  const base =
    "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-mono font-bold uppercase tracking-wider";

  switch (urgency.type) {
    case "just_on_sale":
      return (
        <span
          className={`${base} bg-[var(--coral)]/15 text-[var(--coral)] border border-[var(--coral)]/30`}
          style={{ animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite" }}
        >
          {urgency.label}
        </span>
      );
    case "selling_fast":
      return (
        <span className={`${base} bg-[var(--coral)]/20 text-[var(--coral)] border border-[var(--coral)]/35`}>
          {urgency.label}
        </span>
      );
    case "early_bird_ending":
    case "registration_closing":
      return (
        <span className={`${base} bg-[var(--gold)]/15 text-[var(--gold)] border border-[var(--gold)]/30`}>
          {urgency.label}
        </span>
      );
    case "sold_out":
      return (
        <span className={`${base} bg-[var(--twilight)] text-[var(--muted)] border border-[var(--twilight)]`}>
          {urgency.label}
        </span>
      );
    case "cancelled":
      return (
        <span className={`${base} bg-[var(--coral)]/10 text-[var(--muted)] border border-[var(--coral)]/20 line-through`}>
          {urgency.label}
        </span>
      );
    default:
      return null;
  }
}

// ─── Date formatting ─────────────────────────────────────────────────────────

function formatEventDate(startDate: string, endDate: string | null): string {
  const start = new Date(`${startDate}T00:00:00`);
  const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };

  if (!endDate || endDate === startDate) {
    return start.toLocaleDateString("en-US", { ...options, weekday: "short" });
  }

  const end = new Date(`${endDate}T00:00:00`);
  // Multi-day: "Jun 14 – 16" or "Jun 28 – Jul 2"
  const startStr = start.toLocaleDateString("en-US", options);
  const endDay = end.getDate();
  const endMonth = end.toLocaleDateString("en-US", { month: "short" });
  if (start.getMonth() === end.getMonth()) {
    return `${startStr}\u2013${endDay}`;
  }
  return `${startStr} \u2013 ${endMonth} ${endDay}`;
}

// ─── Price formatting ────────────────────────────────────────────────────────

function formatPrice(
  isFree: boolean,
  priceMin: number | null,
  priceMax: number | null,
): string | null {
  if (isFree) return "Free";
  if (!priceMin && !priceMax) return null;
  if (priceMin && priceMax && priceMin !== priceMax) {
    return `$${priceMin}\u2013$${priceMax}`;
  }
  if (priceMin) return `From $${priceMin}`;
  if (priceMax) return `$${priceMax}`;
  return null;
}

// ─── Ticket CTA ──────────────────────────────────────────────────────────────

function TicketCTA({
  ticketUrl,
  ticketStatus,
  ticketCheckedAt,
  ticketFreshness,
}: {
  ticketUrl: string | null;
  ticketStatus: string | null;
  ticketCheckedAt: string | null;
  ticketFreshness: string | null;
}) {
  const stale = isTicketStatusStale({ ticket_status: ticketStatus, ticket_status_checked_at: ticketCheckedAt });
  const url = ticketUrl || "#";

  // Status is stale (24h+): show check venue fallback
  if (stale || !ticketCheckedAt) {
    if (!ticketUrl) return null;
    return (
      <div className="mt-auto pt-3">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full py-2 text-center rounded-lg font-mono text-xs font-medium bg-[var(--twilight)] text-[var(--soft)] hover:bg-[var(--dusk)] hover:text-[var(--cream)] transition-colors"
        >
          Check Venue Site
        </a>
      </div>
    );
  }

  // Sold out: no CTA
  if (ticketStatus === "sold-out") return null;

  // Cancelled: no CTA
  if (ticketStatus === "cancelled") return null;

  if (!ticketUrl) return null;

  return (
    <div className="mt-auto pt-3">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full py-2 text-center rounded-lg font-mono text-xs font-medium bg-[var(--coral)] text-[var(--void)] hover:opacity-90 transition-opacity"
      >
        Get Tickets
      </a>
      {ticketFreshness && (
        <p className="text-2xs text-[var(--muted)] text-center mt-1.5">
          Tickets checked {ticketFreshness}
        </p>
      )}
    </div>
  );
}

// ─── Card ────────────────────────────────────────────────────────────────────

export const PlanningHorizonCard = memo(function PlanningHorizonCard({
  event,
  portalSlug,
}: PlanningHorizonCardProps) {
  const isCancelled = event.urgency?.type === "cancelled";
  const isSoldOut = event.urgency?.type === "sold_out";

  return (
    <article className="flex-shrink-0 w-72 snap-start rounded-card overflow-hidden bg-[var(--night)] shadow-card-sm hover-lift border border-[var(--twilight)]/40 flex flex-col">
      {/* Hero image */}
      <Link
        href={`/${portalSlug}/events/${event.id}`}
        className="relative h-36 overflow-hidden block flex-shrink-0"
      >
        {event.image_url ? (
          <Image
            src={event.image_url}
            alt={event.title}
            fill
            sizes="288px"
            className={`object-cover transition-transform group-hover:scale-105 ${isCancelled ? "opacity-40 grayscale" : ""}`}
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, var(--night), var(--dusk))" }}
          >
            <svg
              className="w-10 h-10 text-[var(--twilight)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[var(--night)] via-[var(--night)]/60 to-transparent" />
        {/* Urgency badge overlaid on image */}
        {event.urgency && (
          <div className="absolute bottom-2 left-3">
            <UrgencyBadge urgency={event.urgency} />
          </div>
        )}
      </Link>

      {/* Content */}
      <div className="flex flex-col flex-1 p-3">
        {/* Date row */}
        <p className="text-xs text-[var(--gold)] font-mono font-medium mb-1">
          {formatEventDate(event.start_date, event.end_date)}
        </p>

        {/* Title */}
        <Link href={`/${portalSlug}/events/${event.id}`}>
          <h3
            className={`text-lg font-semibold leading-snug mb-1 ${
              isCancelled
                ? "line-through text-[var(--muted)]"
                : isSoldOut
                ? "text-[var(--soft)]"
                : "text-[var(--cream)]"
            }`}
          >
            {event.title}
          </h3>
        </Link>

        {/* Venue + price row */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {event.venue && (
            <span className="text-sm text-[var(--soft)]">
              {event.venue.name}
              {event.venue.neighborhood && (
                <span className="text-[var(--muted)]"> · {event.venue.neighborhood}</span>
              )}
            </span>
          )}
          {(() => {
            const price = formatPrice(event.is_free, event.price_min, event.price_max);
            return price ? (
              <span className="text-xs text-[var(--muted)] font-mono">{price}</span>
            ) : null;
          })()}
        </div>

        {/* Ticket CTA */}
        <TicketCTA
          ticketUrl={event.ticket_url}
          ticketStatus={event.ticket_status}
          ticketCheckedAt={event.ticket_status_checked_at}
          ticketFreshness={event.ticket_freshness}
        />
      </div>
    </article>
  );
});

export type { PlanningHorizonCardProps };
