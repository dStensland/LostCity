"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import type { FeedEvent, DayPart } from "@/lib/forth-types";
import { getConciergeReasonChips } from "@/lib/concierge/event-relevance";

interface EventDetailModalProps {
  event: FeedEvent;
  dayPart: DayPart;
  onClose: () => void;
  onAddToPlan?: (event: FeedEvent) => void;
}

function formatTime(time: string | null | undefined): string {
  if (!time) return "TBA";
  const [h, m] = time.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return "TBA";
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${m.toString().padStart(2, "0")} ${period}`;
}

function formatDateParts(dateStr: string): {
  month: string;
  day: string;
  dow: string;
} {
  const d = new Date(dateStr + "T12:00:00");
  return {
    month: d
      .toLocaleDateString("en-US", { month: "short" })
      .toUpperCase(),
    day: String(d.getDate()),
    dow: d
      .toLocaleDateString("en-US", { weekday: "short" })
      .toUpperCase(),
  };
}

function estimateWalkMinutes(distanceKm: number | null | undefined): number | null {
  if (distanceKm == null) return null;
  return Math.round(distanceKm * 12);
}

export default function EventDetailModal({
  event,
  dayPart,
  onClose,
  onAddToPlan,
}: EventDetailModalProps) {
  const chips = getConciergeReasonChips(event, dayPart);
  const dateParts = formatDateParts(event.start_date);
  const walkMin = estimateWalkMinutes(event.distance_km);

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
        <div className="relative h-56 md:h-64 overflow-hidden md:rounded-t-2xl">
          {event.image_url ? (
            <img
              src={event.image_url}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-[var(--hotel-charcoal)]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

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

          {/* Date badge */}
          <div className="absolute bottom-4 left-4 bg-white rounded-xl px-3 py-2 shadow-lg text-center min-w-[56px]">
            <div className="font-body text-2xs font-bold text-[var(--hotel-champagne)] tracking-wider">
              {dateParts.month}
            </div>
            <div className="font-display text-2xl font-bold text-[var(--hotel-charcoal)] leading-none">
              {dateParts.day}
            </div>
            <div className="font-body text-2xs text-[var(--hotel-stone)]">
              {dateParts.dow}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Title + meta */}
          <div>
            <h2 className="font-display text-2xl text-[var(--hotel-charcoal)] leading-tight">
              {event.title}
            </h2>
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <span className="font-body text-sm text-[var(--hotel-charcoal)] font-medium">
                {formatTime(event.start_time)}
              </span>
              {event.venue_name && (
                <>
                  <span className="text-[var(--hotel-stone)]">&middot;</span>
                  <span className="font-body text-sm text-[var(--hotel-champagne)] font-medium">
                    {event.venue_name}
                  </span>
                </>
              )}
            </div>
            {walkMin != null && (
              <p className="font-body text-xs text-[var(--hotel-stone)] mt-1">
                🚶 {walkMin} min walk from hotel
              </p>
            )}
          </div>

          {/* Reason chips */}
          {chips.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {chips.map((chip, i) => (
                <span
                  key={chip}
                  className={`text-xs font-body px-3 py-1.5 rounded-full font-medium ${
                    i === 0
                      ? "bg-[var(--hotel-champagne)] text-white"
                      : "bg-[var(--hotel-sand)] text-[var(--hotel-charcoal)]"
                  }`}
                >
                  {chip}
                </span>
              ))}
            </div>
          )}

          <div className="h-px bg-[var(--hotel-sand)]" />

          {/* Description — gated to skip auto-generated boilerplate */}
          {event.description &&
            !event.description.includes("Location:") &&
            !event.description.includes("Scheduled on") &&
            event.description.length > 20 && (
            <p className="font-body text-sm text-[var(--hotel-charcoal)] leading-relaxed">
              {event.description}
            </p>
          )}

          {/* Price badge */}
          {(event.is_free || event.price_min != null) && (
            <div className="flex items-center gap-2">
              {event.is_free ? (
                <span className="text-xs font-body font-semibold px-3 py-1.5 rounded-full bg-green-50 text-green-700 border border-green-200">
                  Free
                </span>
              ) : event.price_min != null ? (
                <span className="text-xs font-body px-3 py-1.5 rounded-full bg-[var(--hotel-cream)] text-[var(--hotel-charcoal)] border border-[var(--hotel-sand)]">
                  From ${event.price_min}
                </span>
              ) : null}
            </div>
          )}

          {/* Add to Evening CTA */}
          {onAddToPlan && (
            <button
              onClick={() => onAddToPlan(event)}
              className="w-full py-3.5 rounded-full bg-[var(--hotel-champagne)] text-[var(--hotel-charcoal)] font-body font-bold text-base shadow-lg hover:shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <span>✨</span>
              <span>Add to Your Evening</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
