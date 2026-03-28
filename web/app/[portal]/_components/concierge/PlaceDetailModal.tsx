"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import type { Destination, FeedEvent } from "@/lib/forth-types";
import type { PropertyMoment } from "@/lib/concierge/concierge-types";

// ---------------------------------------------------------------------------
// Unified venue data for the modal — constructed from either Destination or PropertyMoment
// ---------------------------------------------------------------------------

export type VenueModalData = {
  id: string | number;
  name: string;
  typeLabel: string | null;
  imageUrl: string | null;
  neighborhood: string | null;
  distanceKm: number | null;
  status: "active_now" | "starting_soon" | "later" | "closed" | "none";
  contextLine: string | null;
  specialTitle: string | null;
  description: string | null;
  nextEvent: { title: string; startTime: string | null } | null;
  slug: string | null;
};

export function venueFromDestination(dest: Destination): VenueModalData {
  return {
    id: dest.venue.id,
    name: dest.venue.name,
    typeLabel: dest.venue.venue_type,
    imageUrl: dest.venue.image_url,
    neighborhood: dest.venue.neighborhood,
    distanceKm: dest.distance_km,
    status: dest.special_state === "active_now"
      ? "active_now"
      : dest.special_state === "starting_soon"
      ? "starting_soon"
      : "none",
    contextLine: dest.top_special
      ? `${dest.top_special.title}${dest.top_special.price_note ? ` · ${dest.top_special.price_note}` : ""}`
      : null,
    specialTitle: dest.top_special?.title ?? null,
    description: dest.venue.short_description,
    nextEvent: dest.next_event
      ? { title: dest.next_event.title, startTime: dest.next_event.start_time }
      : null,
    slug: dest.venue.slug,
  };
}

export function venueFromPropertyMoment(moment: PropertyMoment): VenueModalData {
  return {
    id: moment.venue.id,
    name: moment.venue.name,
    typeLabel: moment.venue.typeLabel,
    imageUrl: moment.venue.photoUrl,
    neighborhood: null,
    distanceKm: null,
    status: moment.status,
    contextLine: moment.contextLine,
    specialTitle: moment.specialTitle,
    description: moment.venue.spotlight,
    nextEvent: null,
    slug: null,
  };
}

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  VenueModalData["status"],
  { label: string; dotClass: string; textClass: string; badgeClass: string } | null
> = {
  active_now: {
    label: "Open Now",
    dotClass: "bg-green-500",
    textClass: "text-green-700",
    badgeClass: "bg-green-50 border border-green-200",
  },
  starting_soon: {
    label: "Starting Soon",
    dotClass: "bg-amber-500",
    textClass: "text-amber-700",
    badgeClass: "bg-amber-50 border border-amber-200",
  },
  later: {
    label: "Later Today",
    dotClass: "bg-[var(--hotel-stone)]/40",
    textClass: "text-[var(--hotel-stone)]",
    badgeClass: "bg-[var(--hotel-cream)] border border-[var(--hotel-sand)]",
  },
  closed: {
    label: "Closed",
    dotClass: "bg-[var(--hotel-stone)]/30",
    textClass: "text-[var(--hotel-stone)]/70",
    badgeClass: "bg-[var(--hotel-cream)] border border-[var(--hotel-sand)]",
  },
  none: null,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface VenueDetailModalProps {
  venue: VenueModalData;
  tonightEvents?: FeedEvent[];
  onClose: () => void;
  onEventClick?: (event: FeedEvent) => void;
}

function formatTime(time: string | null | undefined): string {
  if (!time) return "TBA";
  const [h, m] = time.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return "TBA";
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${m.toString().padStart(2, "0")} ${period}`;
}

function estimateWalkMinutes(distanceKm: number | null): number | null {
  if (distanceKm == null) return null;
  return Math.round(distanceKm * 12);
}

function formatVenueType(type: string | null): string {
  if (!type) return "";
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function VenueDetailModal({
  venue,
  tonightEvents = [],
  onClose,
  onEventClick,
}: VenueDetailModalProps) {
  const walkMin = estimateWalkMinutes(venue.distanceKm);
  const statusConfig = venue.status ? STATUS_CONFIG[venue.status] : null;

  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  if (typeof window === "undefined") return null;

  const content = (
    <div
      className="fixed inset-0 z-[150] bg-black/50 flex items-end md:items-center justify-center"
      onClick={handleBackdropClick}
    >
      <div
        className="relative bg-[var(--hotel-ivory)] w-full md:max-w-md md:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto overscroll-contain"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hero */}
        <div className="relative h-48 md:h-56 overflow-hidden md:rounded-t-2xl">
          {venue.imageUrl ? (
            <img
              src={venue.imageUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-[var(--hotel-charcoal)]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

          {/* Back button */}
          <button
            onClick={onClose}
            className="absolute top-4 left-4 w-9 h-9 rounded-full bg-white/85 backdrop-blur-sm flex items-center justify-center"
            aria-label="Close"
          >
            <svg
              className="w-5 h-5 text-[var(--hotel-charcoal)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>

          {/* Save button */}
          <button
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/85 backdrop-blur-sm flex items-center justify-center"
            aria-label="Save"
          >
            <svg
              className="w-5 h-5 text-[var(--hotel-charcoal)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
          </button>

          {/* Status badge */}
          {statusConfig && (
            <div
              className={`absolute bottom-4 left-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-body font-medium ${statusConfig.textClass} ${statusConfig.badgeClass}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dotClass} shrink-0`} />
              {statusConfig.label}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Venue header */}
          <div>
            <h2 className="font-display text-2xl text-[var(--hotel-charcoal)] leading-tight">
              {venue.name}
            </h2>
            {venue.typeLabel && (
              <p className="font-body text-xs font-semibold uppercase tracking-[0.12em] text-[var(--hotel-stone)] mt-1">
                {formatVenueType(venue.typeLabel)}
              </p>
            )}
            <p className="font-body text-sm text-[var(--hotel-stone)] mt-0.5">
              {[
                venue.neighborhood,
                walkMin != null ? `${walkMin} min walk from hotel` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>

          {/* Concierge note */}
          {venue.description && (
            <div className="border border-[var(--hotel-champagne)]/20 bg-[var(--hotel-champagne)]/[0.06] rounded-xl p-3.5 space-y-1">
              <p className="font-body text-2xs font-bold uppercase tracking-[0.12em] text-[var(--hotel-champagne)]">
                Concierge Pick
              </p>
              <p className="font-body text-sm text-[var(--hotel-charcoal)] italic leading-relaxed">
                {venue.description}
              </p>
            </div>
          )}

          {/* Quick actions */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: "Reserve", icon: "🍽" },
              { label: "Walk", icon: "🚶" },
              { label: "Call", icon: "📞" },
              { label: "Add to Plan", icon: "✨", highlight: true },
            ].map((action) => (
              <button
                key={action.label}
                className={`flex flex-col items-center gap-1.5 py-3 rounded-xl text-center transition-colors ${
                  action.highlight
                    ? "bg-[var(--hotel-champagne)] text-[var(--hotel-charcoal)]"
                    : "bg-white border border-[var(--hotel-sand)] text-[var(--hotel-charcoal)] hover:bg-[var(--hotel-cream)]"
                }`}
              >
                <span className="text-lg">{action.icon}</span>
                <span className="font-body text-2xs font-medium">{action.label}</span>
              </button>
            ))}
          </div>

          {/* Active special */}
          {venue.specialTitle && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3.5 flex items-start gap-3">
              <span className="text-green-600 text-lg leading-none mt-0.5">●</span>
              <div>
                <p className="font-body text-sm font-semibold text-green-800">
                  {venue.specialTitle}
                </p>
                {venue.contextLine && (
                  <p className="font-body text-xs text-green-700 mt-0.5">
                    {venue.contextLine}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Tonight events at this venue */}
          {tonightEvents.length > 0 && (
            <div className="space-y-2.5">
              <div className="h-px bg-[var(--hotel-sand)]" />
              <div className="flex items-baseline justify-between">
                <h3 className="font-display text-lg text-[var(--hotel-charcoal)]">
                  Today Here
                </h3>
                <span className="text-xs font-body text-[var(--hotel-stone)]">
                  See all &rarr;
                </span>
              </div>
              {tonightEvents.slice(0, 3).map((evt) => (
                <button
                  key={evt.id}
                  onClick={() => onEventClick?.(evt)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-white border border-[var(--hotel-sand)] hover:shadow-sm transition-shadow text-left"
                >
                  <div className="w-11 h-11 rounded-lg bg-[var(--hotel-cream)] flex items-center justify-center shrink-0 overflow-hidden">
                    {evt.image_url ? (
                      <img
                        src={evt.image_url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-xl">🎵</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-body text-sm font-medium text-[var(--hotel-charcoal)] truncate">
                      {evt.title}
                    </p>
                    <p className="font-body text-xs text-[var(--hotel-stone)]">
                      {formatTime(evt.start_time)}
                      {evt.category ? ` · ${evt.category.replace(/_/g, " ")}` : ""}
                    </p>
                  </div>
                  <span className="text-[var(--hotel-champagne)] text-lg shrink-0">+</span>
                </button>
              ))}
            </div>
          )}

          {/* Next event (when no tonight events) */}
          {tonightEvents.length === 0 && venue.nextEvent && (
            <>
              <div className="h-px bg-[var(--hotel-sand)]" />
              <div className="space-y-1">
                <p className="font-body text-xs font-bold uppercase tracking-wider text-[var(--hotel-stone)]">
                  Next Event
                </p>
                <p className="font-body text-sm text-[var(--hotel-charcoal)]">
                  {venue.nextEvent.title}
                  {venue.nextEvent.startTime
                    ? ` · ${formatTime(venue.nextEvent.startTime)}`
                    : ""}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
