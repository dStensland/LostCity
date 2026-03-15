"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import CategoryIcon from "@/components/CategoryIcon";
import Image from "@/components/SmartImage";
import { useCalendar } from "@/lib/calendar/CalendarProvider";
import { DEFAULT_PORTAL_SLUG } from "@/lib/portal-context";
import { formatTimeSplit, formatSmartDate } from "@/lib/formats";
import type { CalendarEvent, RSVPStatus } from "@/lib/types/calendar";

interface EventPreviewSheetProps {
  event: CalendarEvent;
}

export function EventPreviewSheet({ event }: EventPreviewSheetProps) {
  const { openSheet, closeSheet } = useCalendar();
  const queryClient = useQueryClient();
  const [rsvpStatus, setRsvpStatus] = useState<RSVPStatus | null>(
    event.rsvp_status
  );
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { time: startTime, period: startPeriod } = formatTimeSplit(
    event.start_time,
    event.is_all_day
  );
  const { time: endTime, period: endPeriod } = event.end_time
    ? formatTimeSplit(event.end_time, false)
    : { time: null, period: null };

  const { label: dateLabel } = formatSmartDate(event.start_date);

  const handleRsvp = useCallback(
    async (status: RSVPStatus) => {
      if (isUpdating) return;
      setIsUpdating(true);
      setError(null);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      try {
        if (rsvpStatus === status) {
          // Remove RSVP
          await fetch("/api/rsvp", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ event_id: event.id }),
            signal: controller.signal,
          });
          setRsvpStatus(null);
        } else {
          // Add/change RSVP
          await fetch("/api/rsvp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ event_id: event.id, status }),
            signal: controller.signal,
          });
          setRsvpStatus(status);
        }
        queryClient.invalidateQueries({ queryKey: ["user-calendar"] });
      } catch {
        setError("Something went wrong. Try again.");
      } finally {
        clearTimeout(timeoutId);
        setIsUpdating(false);
      }
    },
    [event.id, rsvpStatus, isUpdating, queryClient]
  );

  const handleAddToPlan = useCallback(() => {
    openSheet({ sheet: "add-to-plan", data: event });
  }, [event, openSheet]);

  return (
    <div className="flex flex-col h-full">
      {/* Hero area */}
      <div className="relative h-36 bg-[var(--dusk)] flex-shrink-0 overflow-hidden">
        {event.image_url ? (
          <Image
            src={event.image_url}
            alt={event.title}
            fill
            className="object-cover"
            sizes="420px"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {event.category ? (
              <CategoryIcon
                type={event.category}
                size={48}
                className="opacity-20"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-[var(--twilight)]" />
            )}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--void)]/80 via-transparent to-transparent" />
        {/* Category pill */}
        {event.category && (
          <div className="absolute bottom-3 left-4">
            <span className="px-2 py-1 rounded-full bg-[var(--void)]/70 backdrop-blur-sm font-mono text-xs text-[var(--muted)]">
              {event.category}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="overflow-y-auto flex-1 px-4 py-4 space-y-4">
        {/* Title */}
        <h2 className="text-lg font-semibold text-[var(--cream)] leading-snug">
          {event.title}
        </h2>

        {/* Date / time row */}
        <div className="flex items-center gap-1.5 font-mono text-xs text-[var(--soft)]">
          <svg
            className="w-3.5 h-3.5 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>
            {dateLabel}
            {!event.is_all_day && startTime && (
              <>
                {" · "}
                {startTime}
                {startPeriod && (
                  <span className="text-[var(--muted)]"> {startPeriod}</span>
                )}
                {endTime && (
                  <>
                    {" – "}
                    {endTime}
                    {endPeriod && (
                      <span className="text-[var(--muted)]"> {endPeriod}</span>
                    )}
                  </>
                )}
              </>
            )}
            {event.is_all_day && " · All day"}
          </span>
        </div>

        {/* Venue */}
        {event.venue && (
          <div className="flex items-center gap-1.5 font-mono text-xs text-[var(--soft)]">
            <svg
              className="w-3.5 h-3.5 flex-shrink-0 text-[var(--muted)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <span>
              {event.venue.name}
              {event.venue.neighborhood && (
                <span className="text-[var(--muted)]">
                  {" · "}
                  {event.venue.neighborhood}
                </span>
              )}
            </span>
          </div>
        )}

        {/* Price */}
        {(event.is_free || event.price_min !== null) && (
          <div>
            <span
              className={`inline-flex px-2.5 py-1 rounded-full font-mono text-xs font-medium ${
                event.is_free
                  ? "bg-[var(--neon-green)]/15 text-[var(--neon-green)]"
                  : "bg-[var(--twilight)] text-[var(--cream)]"
              }`}
            >
              {event.is_free
                ? "Free"
                : event.price_min
                ? `$${event.price_min}${event.price_max && event.price_max !== event.price_min ? ` – $${event.price_max}` : ""}`
                : "Paid"}
            </span>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="flex-shrink-0 border-t border-[var(--twilight)] bg-[var(--void)] px-4 py-3 space-y-2">
        {error && (
          <p className="px-4 py-2 text-xs font-mono text-[var(--coral)] bg-[var(--coral)]/10 rounded-lg">
            {error}
          </p>
        )}
        {/* RSVP row */}
        <div className="flex gap-2">
          <button
            onClick={() => handleRsvp("going")}
            disabled={isUpdating}
            className={`flex-1 min-h-[44px] rounded-lg font-mono text-sm font-medium transition-all disabled:opacity-50 ${
              rsvpStatus === "going"
                ? "bg-[var(--coral)] text-[var(--void)]"
                : "bg-[var(--coral)]/15 border border-[var(--coral)]/40 text-[var(--coral)] hover:bg-[var(--coral)]/25"
            }`}
          >
            {rsvpStatus === "going" ? "Going ✓" : "Going"}
          </button>
          <button
            onClick={() => handleRsvp("interested")}
            disabled={isUpdating}
            className={`flex-1 min-h-[44px] rounded-lg font-mono text-sm font-medium transition-all disabled:opacity-50 ${
              rsvpStatus === "interested"
                ? "bg-[var(--gold)] text-[var(--void)]"
                : "bg-[var(--gold)]/15 border border-[var(--gold)]/40 text-[var(--gold)] hover:bg-[var(--gold)]/25"
            }`}
          >
            {rsvpStatus === "interested" ? "Interested ✓" : "Interested"}
          </button>
        </div>

        {/* Secondary actions */}
        <div className="flex gap-2">
          <button
            onClick={handleAddToPlan}
            className="flex-1 min-h-[44px] rounded-lg bg-[var(--twilight)] text-[var(--cream)] font-mono text-sm hover:bg-[var(--dusk)] transition-colors"
          >
            Add to Plan
          </button>
          <Link
            href={`/${DEFAULT_PORTAL_SLUG}?event=${event.id}`}
            onClick={closeSheet}
            className="flex-1 min-h-[44px] flex items-center justify-center rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--soft)] font-mono text-sm hover:border-[var(--soft)] transition-colors"
          >
            View Event
          </Link>
        </div>
      </div>
    </div>
  );
}
