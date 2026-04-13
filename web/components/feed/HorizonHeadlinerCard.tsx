"use client";

import { memo } from "react";
import Link from "next/link";
import SmartImage from "@/components/SmartImage";
import CategoryIcon, { getCategoryColor, getCategoryLabel } from "@/components/CategoryIcon";
import Dot from "@/components/ui/Dot";
import type { CityPulseEventItem } from "@/lib/city-pulse/types";
import type { PlanningUrgency } from "@/lib/types/planning-horizon";
import { ticketStatusFreshness } from "@/lib/types/planning-horizon";

interface HorizonHeadlinerCardProps {
  item: CityPulseEventItem;
  portalSlug: string;
}

// ─── Urgency Pill ─────────────────────────────────────────────────────────────

function UrgencyPill({ urgency }: { urgency: NonNullable<PlanningUrgency> }) {
  const base =
    "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-mono font-bold uppercase tracking-wider";

  switch (urgency.type) {
    case "just_on_sale":
      return (
        <span
          className={`${base} bg-[var(--coral)]/15 text-[var(--coral)] border border-[var(--coral)]/30 motion-safe:animate-pulse`}
        >
          {urgency.label}
        </span>
      );
    case "selling_fast":
      return (
        <span
          className={`${base} bg-[var(--coral)]/20 text-[var(--coral)] border border-[var(--coral)]/35`}
        >
          {urgency.label}
        </span>
      );
    case "early_bird_ending":
    case "registration_closing":
      return (
        <span
          className={`${base} bg-[var(--gold)]/15 text-[var(--gold)] border border-[var(--gold)]/30`}
        >
          {urgency.label}
        </span>
      );
    case "sold_out":
      return (
        <span
          className={`${base} bg-[var(--twilight)] text-[var(--muted)] border border-[var(--twilight)]`}
        >
          {urgency.label}
        </span>
      );
    case "cancelled":
      return (
        <span
          className={`${base} bg-[var(--coral)]/10 text-[var(--muted)] border border-[var(--coral)]/20 line-through`}
        >
          {urgency.label}
        </span>
      );
    default:
      return null;
  }
}

// ─── Date formatting ──────────────────────────────────────────────────────────

function formatEventDate(startDate: string, endDate: string | null | undefined): string {
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

// ─── Price formatting ─────────────────────────────────────────────────────────

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

// ─── Ticket CTA ───────────────────────────────────────────────────────────────

// The event in CityPulseEventItem may carry planning-specific fields at runtime
// (ticket_status, ticket_status_checked_at) even though they're not in the base
// FeedEventData type. Access them via casting to avoid a type error while still
// behaving correctly when the fields are absent.
type EventWithOptionalPlanningFields = {
  ticket_url?: string | null;
  source_url?: string | null;
  is_free: boolean;
  ticket_status?: string | null;
  ticket_status_checked_at?: string | null;
  ticket_freshness?: string | null;
};

function TicketCTA({ event }: { event: EventWithOptionalPlanningFields }) {
  const {
    ticket_url,
    source_url,
    is_free,
    ticket_status,
    ticket_freshness,
  } = event;

  // Sold out or cancelled: no CTA
  if (ticket_status === "sold-out" || ticket_status === "cancelled") return null;

  const url = ticket_url || source_url;
  if (!url || url === "#") return null;

  const openExternal = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // Free event: green "Get Details" button
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

  // No ticket_url and not free: no CTA
  if (!ticket_url) return null;

  // Paid event with ticket_url: coral "Get Tickets" button
  const freshness = ticket_freshness ?? ticketStatusFreshness(event.ticket_status_checked_at ?? null);
  return (
    <div className="mt-auto pt-3">
      <button
        type="button"
        onClick={openExternal}
        className="block w-full min-h-[44px] flex items-center justify-center text-center rounded-lg font-mono text-xs font-medium bg-[var(--coral)]/15 text-[var(--coral)] border border-[var(--coral)]/30 hover:bg-[var(--coral)]/25 transition-colors cursor-pointer"
      >
        Get Tickets
      </button>
      {freshness && (
        <p className="text-2xs text-[var(--muted)] text-center mt-1.5">
          Tickets checked {freshness}
        </p>
      )}
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

export const HorizonHeadlinerCard = memo(function HorizonHeadlinerCard({
  item,
  portalSlug,
}: HorizonHeadlinerCardProps) {
  const event = item.event;

  // Planning-specific fields may be present at runtime — cast for access
  const eventWithPlanning = event as EventWithOptionalPlanningFields & typeof event;

  // Build urgency from runtime planning fields if present
  const urgency: PlanningUrgency | null = (() => {
    if (eventWithPlanning.ticket_status === "cancelled") {
      return { type: "cancelled", label: "Cancelled" };
    }
    if (eventWithPlanning.ticket_status === "sold-out") {
      return { type: "sold_out", label: "Sold Out" };
    }
    if (eventWithPlanning.ticket_status === "low-tickets") {
      return { type: "selling_fast", label: "Selling Fast" };
    }
    return null;
  })();

  const isCancelled = urgency?.type === "cancelled";
  const isSoldOut = urgency?.type === "sold_out";

  const catColor = getCategoryColor(event.category);
  const catLabel = getCategoryLabel(event.category);
  const price = formatPrice(event.is_free, event.price_min, event.price_max);
  const description = event.featured_blurb || event.description || null;
  const showDescription = description && description.length >= 20 ? description : null;

  return (
    <Link
      href={`/${portalSlug}/events/${event.id}`}
      className="group block w-full rounded-card overflow-hidden bg-[var(--night)] border border-[var(--twilight)]/40 shadow-card-sm hover-lift flex flex-col"
    >
      {/* ── Image zone ──────────────────────────────────────────────────── */}
      <div className="relative h-36 sm:h-[200px] overflow-hidden flex-shrink-0">
        {event.image_url ? (
          <>
            <SmartImage
              src={event.image_url}
              alt={event.title}
              fill
              sizes="(max-width: 640px) 100vw, 800px"
              blurhash={event.blurhash}
              className={`object-cover transition-transform group-hover:scale-105 ${
                isCancelled || isSoldOut ? "opacity-40 grayscale" : ""
              }`}
              fallback={
                <div
                  className="absolute inset-0"
                  style={{
                    background: `linear-gradient(135deg, var(--dusk) 0%, color-mix(in srgb, ${catColor} 20%, var(--twilight)) 50%, color-mix(in srgb, ${catColor} 10%, var(--void)) 100%)`,
                  }}
                />
              }
            />
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--night)] via-[var(--night)]/40 to-transparent" />
          </>
        ) : (
          /* No-image fallback — matches HeroCard pattern */
          <>
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--dusk)] to-[var(--night)]" />
            <div className="absolute inset-0 flex items-center justify-center opacity-20">
              <CategoryIcon
                type={event.category || "other"}
                size={64}
                glow="subtle"
                weight="light"
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--night)]/90 via-[var(--night)]/40 to-transparent" />
          </>
        )}

        {/* Category badge — top left */}
        <div
          className="absolute top-2.5 left-2.5 flex items-center gap-1.5 rounded-md px-2.5 py-1 bg-black/50 backdrop-blur-sm"
          data-category={event.category || "other"}
        >
          <CategoryIcon
            type={event.category || "other"}
            size={12}
            glow="none"
            weight="bold"
          />
          <span className="font-mono text-2xs font-bold uppercase tracking-wider text-category">
            {catLabel}
          </span>
        </div>

        {/* Urgency pill — bottom left */}
        {urgency && (
          <div className="absolute bottom-2.5 left-2.5">
            <UrgencyPill urgency={urgency} />
          </div>
        )}
      </div>

      {/* ── Content zone ────────────────────────────────────────────────── */}
      <div className="p-4 flex flex-col gap-1.5">
        {/* Date */}
        <p className="font-mono text-xs text-[var(--gold)]">
          {formatEventDate(event.start_date, event.end_date)}
        </p>

        {/* Title */}
        <h3
          className={`text-lg font-semibold leading-tight line-clamp-2 ${
            isCancelled
              ? "line-through text-[var(--muted)]"
              : isSoldOut
                ? "text-[var(--soft)]"
                : "text-[var(--cream)]"
          }`}
        >
          {event.title}
        </h3>

        {/* Description */}
        {showDescription && (
          <p className="text-sm leading-snug text-[var(--soft)] line-clamp-2">
            {showDescription}
          </p>
        )}

        {/* Venue + neighborhood + price */}
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
        <TicketCTA event={eventWithPlanning} />
      </div>
    </Link>
  );
});

export type { HorizonHeadlinerCardProps };
