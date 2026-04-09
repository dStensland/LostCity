"use client";

import { memo } from "react";
import Link from "next/link";
import SmartImage from "@/components/SmartImage";
import Dot from "@/components/ui/Dot";
import CategoryIcon from "@/components/CategoryIcon";
import { getCategoryColor, getCategoryLabel } from "@/lib/category-config";
import type { PlanningHorizonEvent, PlanningUrgency } from "@/lib/types/planning-horizon";
import { isTicketStatusStale } from "@/lib/types/planning-horizon";

interface PlanningHorizonCardProps {
  event: PlanningHorizonEvent & {
    urgency: PlanningUrgency;
    ticket_freshness: string | null;
    featured_blurb?: string | null;
    description?: string | null;
  };
  portalSlug: string;
}

// ─── Urgency Pill ─────────────────────────────────────────────────────────────
// Pure visual pill, no positioning — parent positions it absolutely.

function UrgencyPill({ urgency }: { urgency: NonNullable<PlanningUrgency> }) {
  const base =
    "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-mono font-bold uppercase tracking-wider";

  switch (urgency.type) {
    case "just_on_sale":
      return (
        <span className={`${base} bg-[var(--coral)]/15 text-[var(--coral)] border border-[var(--coral)]/30 motion-safe:animate-pulse`}>
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
  if (priceMin == null && priceMax == null) return null;
  if (priceMin === 0 && (priceMax === 0 || priceMax == null)) return "Free";
  if (priceMin != null && priceMax != null && priceMin !== priceMax) {
    return `$${priceMin}\u2013$${priceMax}`;
  }
  if (priceMin) return `From $${priceMin}`;
  if (priceMax) return `$${priceMax}`;
  return null;
}

// ─── Ticket CTA ──────────────────────────────────────────────────────────────

function TicketCTA({ event }: { event: PlanningHorizonCardProps["event"] }) {
  const { ticket_url, source_url, is_free, ticket_status, ticket_status_checked_at, ticket_freshness } = event;

  // Sold out or cancelled: no CTA
  if (ticket_status === "sold-out" || ticket_status === "cancelled") return null;

  const stale = isTicketStatusStale({ ticket_status, ticket_status_checked_at });
  const url = ticket_url || source_url;
  if (!url || url === "#") return null;

  const openExternal = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // Stale ticket data or no ticket URL: muted CTA
  if (stale || !ticket_url) {
    const effectivelyFreeForMuted = is_free === true || ticket_status === "free";
    return (
      <div className="mt-auto pt-3">
        <button
          type="button"
          onClick={openExternal}
          className="block w-full min-h-[44px] flex items-center justify-center text-center rounded-lg font-mono text-xs font-medium bg-transparent text-[var(--soft)] border border-[var(--soft)]/30 hover:text-[var(--cream)] hover:border-[var(--soft)]/50 transition-colors cursor-pointer"
        >
          {effectivelyFreeForMuted ? "See Details" : stale ? "Get Tickets" : "See Details"}
        </button>
      </div>
    );
  }

  // Free event (is_free flag or ticket_status='free') with ticket URL
  const effectivelyFree = is_free === true || ticket_status === "free";
  if (effectivelyFree) {
    return (
      <div className="mt-auto pt-3">
        <button
          type="button"
          onClick={openExternal}
          className="block w-full min-h-[44px] flex items-center justify-center text-center rounded-lg font-mono text-xs font-medium bg-[var(--neon-green)]/15 text-[var(--neon-green)] border border-[var(--neon-green)]/30 hover:bg-[var(--neon-green)]/25 transition-colors cursor-pointer"
        >
          Get Details
        </button>
      </div>
    );
  }

  // Paid event with ticket URL
  return (
    <div className="mt-auto pt-3">
      <button
        type="button"
        onClick={openExternal}
        className="block w-full min-h-[44px] flex items-center justify-center text-center rounded-lg font-mono text-xs font-medium bg-[var(--coral)] text-[var(--void)] hover:opacity-90 transition-opacity cursor-pointer"
      >
        Get Tickets
      </button>
      {ticket_freshness && (
        <p className="text-2xs text-[var(--muted)] text-center mt-1.5">
          Tickets checked {ticket_freshness}
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
  const isDisabled = isCancelled || isSoldOut;
  const price = formatPrice(event.is_free, event.price_min, event.price_max);
  const description = event.featured_blurb || null;
  const catColor = getCategoryColor(event.category);
  const catLabel = getCategoryLabel(event.category);

  return (
    <Link
      href={event.festival_id
        ? `/${portalSlug}?festival=${event.festival_id}`
        : `/${portalSlug}/events/${event.id}`}
      className="group flex-shrink-0 w-[310px] snap-start rounded-card overflow-hidden bg-[var(--night)] shadow-card-sm hover-lift border border-[var(--twilight)]/40 flex flex-col"
    >
      {/* ── Image zone ────────────────────────────────────────────── */}
      <div className="relative h-40 overflow-hidden flex-shrink-0">
        {event.image_url ? (
          <SmartImage
            src={event.image_url}
            alt={event.title}
            fill
            sizes="310px"
            className={`object-cover transition-transform group-hover:scale-105 ${isDisabled ? "opacity-40 grayscale" : ""}`}
            fallback={
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, var(--dusk) 0%, color-mix(in srgb, ${catColor} 20%, var(--twilight)) 50%, color-mix(in srgb, ${catColor} 10%, var(--void)) 100%)`,
                }}
              >
                <CategoryIcon
                  type={event.category || "other"}
                  size={40}
                  glow="none"
                  weight="thin"
                  className="opacity-30"
                />
              </div>
            }
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, var(--dusk) 0%, color-mix(in srgb, ${catColor} 20%, var(--twilight)) 50%, color-mix(in srgb, ${catColor} 10%, var(--void)) 100%)`,
            }}
          >
            <CategoryIcon
              type={event.category || "other"}
              size={40}
              glow="none"
              weight="thin"
              className="opacity-30"
            />
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[var(--night)] via-[var(--night)]/60 to-transparent" />

        {/* Category badge — top left */}
        <div
          className="absolute top-2.5 left-2.5 flex items-center gap-1.5 rounded-md px-2.5 py-1 bg-[var(--void)]/80"
          style={{ color: catColor }}
        >
          <CategoryIcon type={event.category || "other"} size={12} glow="none" weight="bold" />
          <span className="font-mono text-2xs font-bold uppercase tracking-wider">
            {catLabel}
          </span>
        </div>

        {/* Urgency badge — bottom left */}
        {event.urgency && (
          <div className="absolute bottom-2.5 left-2.5">
            <UrgencyPill urgency={event.urgency} />
          </div>
        )}
      </div>

      {/* ── Content zone ──────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 p-3.5">
        {/* Date */}
        <p className="text-xs text-[var(--gold)] font-mono font-semibold tracking-wide mb-1">
          {formatEventDate(event.start_date, event.end_date)}
        </p>

        {/* Title */}
        <h3
          className={`text-lg font-semibold leading-snug mb-1 line-clamp-2 ${
            isCancelled
              ? "line-through text-[var(--muted)]"
              : isSoldOut
                ? "text-[var(--soft)]"
                : "text-[var(--cream)]"
          }`}
        >
          {event.title}
        </h3>

        {/* Description (from featured_blurb) */}
        {description && (
          <p className="text-xs text-[var(--soft)] leading-relaxed line-clamp-2 mb-1.5">
            {description}
          </p>
        )}

        {/* Venue + price row */}
        <div className="flex items-center gap-1.5 flex-wrap text-xs text-[var(--muted)]">
          {event.venue && (
            <>
              <span className="font-medium">{event.venue.name}</span>
              {event.venue.neighborhood && (
                <>
                  <Dot />
                  <span>{event.venue.neighborhood}</span>
                </>
              )}
            </>
          )}
          {price && (
            <>
              {event.venue && <Dot />}
              <span
                className={
                  event.is_free
                    ? "font-mono font-semibold text-[var(--neon-green)]"
                    : "font-mono"
                }
              >
                {price}
              </span>
            </>
          )}
        </div>

        {/* Ticket CTA */}
        <TicketCTA event={event} />
      </div>
    </Link>
  );
});

export type { PlanningHorizonCardProps };
