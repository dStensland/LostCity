"use client";

import { useState, useCallback } from "react";
import { Check, X, Clock, ChatCircle } from "@phosphor-icons/react";
import type { StopStatus } from "@/lib/itinerary-utils";

interface StopAvailabilityRowProps {
  itemId: string;
  stopTitle: string;
  status: StopStatus;
  arrivalTime: string | null;
  note: string | null;
  onUpdate: (update: {
    item_id: string;
    status: StopStatus;
    arrival_time?: string;
    note?: string;
  }) => void;
  disabled?: boolean;
}

export default function StopAvailabilityRow({
  itemId,
  stopTitle,
  status,
  arrivalTime,
  note,
  onUpdate,
  disabled = false,
}: StopAvailabilityRowProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [timeInput, setTimeInput] = useState(arrivalTime || "");
  const [noteInput, setNoteInput] = useState(note || "");

  const handleToggle = useCallback(
    (newStatus: StopStatus) => {
      onUpdate({ item_id: itemId, status: newStatus });
      if (newStatus === "skipping") {
        setShowDetails(false);
      }
    },
    [itemId, onUpdate]
  );

  const handleSaveDetails = useCallback(() => {
    onUpdate({
      item_id: itemId,
      status: "joining",
      arrival_time: timeInput || undefined,
      note: noteInput || undefined,
    });
    setShowDetails(false);
  }, [itemId, timeInput, noteInput, onUpdate]);

  const isJoining = status === "joining";

  return (
    <div className="border border-[var(--twilight)]/60 rounded-lg overflow-hidden">
      {/* Main row */}
      <div className="flex items-center gap-2 px-3 py-2">
        {/* Status toggle */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleToggle("joining")}
            disabled={disabled}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full font-mono text-2xs font-medium transition-all ${
              isJoining
                ? "bg-[var(--coral)]/15 text-[var(--coral)] border border-[var(--coral)]/25"
                : "bg-transparent text-[var(--muted)] border border-[var(--twilight)] hover:text-[var(--soft)]"
            }`}
          >
            <Check size={10} weight="bold" />
            In
          </button>
          <button
            onClick={() => handleToggle("skipping")}
            disabled={disabled}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full font-mono text-2xs font-medium transition-all ${
              !isJoining
                ? "bg-[var(--twilight)] text-[var(--soft)] border border-[var(--twilight)]"
                : "bg-transparent text-[var(--muted)] border border-[var(--twilight)] hover:text-[var(--soft)]"
            }`}
          >
            <X size={10} weight="bold" />
            Skip
          </button>
        </div>

        {/* Stop title */}
        <span
          className={`flex-1 text-sm truncate ${
            isJoining ? "text-[var(--cream)]" : "text-[var(--muted)] line-through"
          }`}
        >
          {stopTitle}
        </span>

        {/* Arrival time chip (if set) */}
        {isJoining && arrivalTime && !showDetails && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--gold)]/10 border border-[var(--gold)]/20 font-mono text-2xs text-[var(--gold)]">
            <Clock size={10} weight="bold" />
            {formatTime12(arrivalTime)}
          </span>
        )}

        {/* Note indicator */}
        {isJoining && note && !showDetails && (
          <ChatCircle
            size={14}
            weight="fill"
            className="text-[var(--soft)] flex-shrink-0"
          />
        )}

        {/* Expand details button */}
        {isJoining && (
          <button
            onClick={() => setShowDetails(!showDetails)}
            disabled={disabled}
            className="text-2xs font-mono text-[var(--muted)] hover:text-[var(--soft)] transition-colors flex-shrink-0"
          >
            {showDetails ? "done" : "details"}
          </button>
        )}
      </div>

      {/* Expanded details (arrival time + note) */}
      {showDetails && isJoining && (
        <div className="px-3 pb-3 pt-1 border-t border-[var(--twilight)]/40 space-y-2">
          {/* Arrival time */}
          <div className="flex items-center gap-2">
            <label className="font-mono text-2xs text-[var(--muted)] uppercase tracking-wider flex-shrink-0">
              Arriving at
            </label>
            <input
              type="time"
              value={timeInput}
              onChange={(e) => setTimeInput(e.target.value)}
              className="flex-1 px-2 py-1.5 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-xs focus:outline-none focus:border-[var(--gold)] transition-colors"
            />
          </div>

          {/* Note */}
          <div className="flex items-start gap-2">
            <label className="font-mono text-2xs text-[var(--muted)] uppercase tracking-wider flex-shrink-0 mt-2">
              Note
            </label>
            <input
              type="text"
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              maxLength={200}
              placeholder="Running late, grab me a seat..."
              className="flex-1 px-2 py-1.5 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-xs placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)] transition-colors"
            />
          </div>

          {/* Save */}
          <div className="flex justify-end">
            <button
              onClick={handleSaveDetails}
              disabled={disabled}
              className="px-3 py-1 rounded-lg bg-[var(--coral)] text-[var(--void)] font-mono text-2xs font-medium hover:brightness-110 transition-all disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Format HH:MM to 12-hour display */
function formatTime12(time: string): string {
  const [h, m] = time.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return time;
  const ampm = h >= 12 ? "pm" : "am";
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, "0")}${ampm}`;
}
