"use client";

import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useCalendar } from "@/lib/calendar/CalendarProvider";
import type { CalendarEvent, RSVPStatus } from "@/lib/types/calendar";

interface ChangeRSVPSheetProps {
  event: CalendarEvent;
}

export function ChangeRSVPSheet({ event }: ChangeRSVPSheetProps) {
  const { closeSheet } = useCalendar();
  const queryClient = useQueryClient();
  const [currentStatus, setCurrentStatus] = useState<RSVPStatus>(
    event.rsvp_status
  );
  const [isUpdating, setIsUpdating] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = useCallback(
    async (status: RSVPStatus) => {
      if (isUpdating || status === currentStatus) return;
      setIsUpdating(true);
      setError(null);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      try {
        await fetch("/api/rsvp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event_id: event.id, status }),
          signal: controller.signal,
        });
        setCurrentStatus(status);
        queryClient.invalidateQueries({ queryKey: ["user-calendar"] });
        closeSheet();
      } catch {
        setError("Something went wrong. Try again.");
      } finally {
        clearTimeout(timeoutId);
        setIsUpdating(false);
      }
    },
    [event.id, currentStatus, isUpdating, queryClient, closeSheet]
  );

  const handleRemove = useCallback(async () => {
    if (isRemoving) return;
    setIsRemoving(true);
    setError(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      await fetch("/api/rsvp", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: event.id }),
        signal: controller.signal,
      });
      queryClient.invalidateQueries({ queryKey: ["user-calendar"] });
      closeSheet();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      clearTimeout(timeoutId);
      setIsRemoving(false);
    }
  }, [event.id, isRemoving, queryClient, closeSheet]);

  return (
    <div className="flex flex-col h-full">
      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Event identity */}
        <div className="p-3 rounded-xl bg-[var(--night)] border border-[var(--twilight)]/40">
          <p className="font-mono text-sm font-medium text-[var(--cream)] line-clamp-2">
            {event.title}
          </p>
          {event.venue && (
            <p className="font-mono text-xs text-[var(--muted)] mt-1 truncate">
              {event.venue.name}
            </p>
          )}
        </div>

        {error && (
          <p className="px-4 py-2 text-xs font-mono text-[var(--coral)] bg-[var(--coral)]/10 rounded-lg">
            {error}
          </p>
        )}

        {/* RSVP options */}
        <div>
          <p className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-3">
            Change RSVP
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => handleChange("going")}
              disabled={isUpdating || currentStatus === "going"}
              className={`w-full min-h-[44px] rounded-lg font-mono text-sm font-medium transition-all disabled:opacity-50 ${
                currentStatus === "going"
                  ? "bg-[var(--coral)] text-[var(--void)]"
                  : "bg-[var(--coral)]/15 border border-[var(--coral)]/40 text-[var(--coral)] hover:bg-[var(--coral)]/25"
              }`}
            >
              {currentStatus === "going" ? "Going (current)" : "Going"}
            </button>

            <button
              onClick={() => handleChange("interested")}
              disabled={isUpdating || currentStatus === "interested"}
              className={`w-full min-h-[44px] rounded-lg font-mono text-sm font-medium transition-all disabled:opacity-50 ${
                currentStatus === "interested"
                  ? "bg-[var(--gold)] text-[var(--void)]"
                  : "bg-[var(--gold)]/15 border border-[var(--gold)]/40 text-[var(--gold)] hover:bg-[var(--gold)]/25"
              }`}
            >
              {currentStatus === "interested"
                ? "Interested (current)"
                : "Interested"}
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-[var(--twilight)]" />

        {/* Remove from calendar */}
        <button
          onClick={handleRemove}
          disabled={isRemoving}
          className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-lg bg-[var(--neon-red)]/10 border border-[var(--neon-red)]/30 text-[var(--neon-red)] font-mono text-sm font-medium hover:bg-[var(--neon-red)]/20 transition-colors disabled:opacity-50"
        >
          {/* Trash icon */}
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
          {isRemoving ? "Removing..." : "Remove from Calendar"}
        </button>
      </div>
    </div>
  );
}
