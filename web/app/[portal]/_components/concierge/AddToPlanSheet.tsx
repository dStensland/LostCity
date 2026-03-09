"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useCallback, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { FeedEvent } from "@/lib/forth-types";
import {
  EVENING_SLOTS,
  type EveningSlot,
  type EveningStop,
} from "@/lib/concierge/evening-vibes";

interface AddToPlanSheetProps {
  event: FeedEvent;
  currentStops: EveningStop[];
  onAdd: (event: FeedEvent, slot: EveningSlot) => void;
  onClose: () => void;
}

function formatTime(time: string | null | undefined): string {
  if (!time) return "TBA";
  const [h, m] = time.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return "TBA";
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${m.toString().padStart(2, "0")} ${period}`;
}

function formatSlotTime(defaultTime: string): { hour: string; period: string } {
  const [h, m] = defaultTime.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return {
    hour: `${hour12}:${m.toString().padStart(2, "0")}`,
    period,
  };
}

const SLOT_ICONS: Record<EveningSlot, string> = {
  dinner: "🍽",
  event: "🎵",
  drinks: "🍸",
  late_night: "🌙",
};

function bestSlotForEvent(event: FeedEvent, filledSlots: Set<EveningSlot>): EveningSlot {
  const cat = event.category?.toLowerCase() ?? "";

  // Category-based suggestion
  if (
    cat.includes("food") ||
    cat.includes("brunch") ||
    cat.includes("dinner")
  ) {
    if (!filledSlots.has("dinner")) return "dinner";
  }

  if (
    cat.includes("music") ||
    cat.includes("comedy") ||
    cat.includes("theater") ||
    cat.includes("art")
  ) {
    if (!filledSlots.has("event")) return "event";
  }

  // Time-based suggestion
  if (event.start_time) {
    const [h] = event.start_time.split(":").map(Number);
    if (!isNaN(h)) {
      if (h < 19 && !filledSlots.has("dinner")) return "dinner";
      if (h >= 19 && h < 22 && !filledSlots.has("event")) return "event";
      if (h >= 22 && h < 24 && !filledSlots.has("drinks")) return "drinks";
      if (h >= 23 && !filledSlots.has("late_night")) return "late_night";
    }
  }

  // First unfilled slot
  for (const slot of EVENING_SLOTS) {
    if (!filledSlots.has(slot.id)) return slot.id;
  }

  return "event";
}

export default function AddToPlanSheet({
  event,
  currentStops,
  onAdd,
  onClose,
}: AddToPlanSheetProps) {
  const filledSlots = useMemo(
    () => new Set(currentStops.map((s) => s.slot)),
    [currentStops],
  );

  const recommendedSlot = useMemo(
    () => bestSlotForEvent(event, filledSlots),
    [event, filledSlots],
  );

  const [selectedSlot, setSelectedSlot] = useState<EveningSlot>(recommendedSlot);

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

  const selectedSlotConfig = EVENING_SLOTS.find((s) => s.id === selectedSlot);

  if (typeof window === "undefined") return null;

  const content = (
    <div
      className="fixed inset-0 z-[160] bg-black/50 flex items-end justify-center"
      onClick={handleBackdropClick}
    >
      <div
        className="relative bg-[var(--hotel-ivory)] w-full md:max-w-md md:mx-auto rounded-t-2xl shadow-2xl max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2 md:hidden">
          <div className="w-10 h-1 rounded-full bg-[var(--hotel-sand)]" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-4 pt-1 md:pt-4">
          <h2 className="font-display text-xl text-[var(--hotel-charcoal)]">
            Add to Your Evening
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[var(--hotel-sand)] flex items-center justify-center hover:bg-[var(--hotel-stone)]/20 transition-colors"
            aria-label="Close"
          >
            <svg
              className="w-4 h-4 text-[var(--hotel-stone)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-5 pb-6 space-y-5">
          {/* Mini event card */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-white border border-[var(--hotel-sand)]">
            <div className="w-12 h-12 rounded-lg bg-[var(--hotel-cream)] overflow-hidden shrink-0">
              {event.image_url ? (
                <img
                  src={event.image_url}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xl">
                  🎵
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="font-body text-sm font-semibold text-[var(--hotel-charcoal)] truncate">
                {event.title}
              </p>
              <p className="font-body text-xs text-[var(--hotel-stone)]">
                {formatTime(event.start_time)}
                {event.venue_name ? ` · ${event.venue_name}` : ""}
              </p>
            </div>
          </div>

          {/* Slot label */}
          <p className="font-body text-2xs font-bold uppercase tracking-[0.15em] text-[var(--hotel-stone)]">
            Choose a Slot
          </p>

          {/* Slot options */}
          <div className="space-y-2">
            {EVENING_SLOTS.map((slot) => {
              const isFilled = filledSlots.has(slot.id);
              const isSelected = selectedSlot === slot.id;
              const isRecommended = recommendedSlot === slot.id;
              const filledStop = currentStops.find((s) => s.slot === slot.id);
              const time = formatSlotTime(slot.defaultTime);

              return (
                <button
                  key={slot.id}
                  onClick={() => !isFilled && setSelectedSlot(slot.id)}
                  disabled={isFilled}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${
                    isFilled
                      ? "bg-[var(--hotel-cream)]/60 border border-[var(--hotel-sand)] opacity-70"
                      : isSelected
                      ? "bg-white border-2 border-[var(--hotel-champagne)] shadow-[0_2px_12px_rgba(201,169,98,0.15)]"
                      : "bg-white border border-[var(--hotel-sand)] hover:border-[var(--hotel-champagne)]/50"
                  }`}
                >
                  {/* Time column */}
                  <div className="w-[52px] shrink-0">
                    <div
                      className={`font-display text-base font-bold leading-none ${
                        isFilled
                          ? "text-[var(--hotel-stone)]"
                          : isSelected
                          ? "text-[var(--hotel-champagne)]"
                          : "text-[var(--hotel-stone)]"
                      }`}
                    >
                      {time.hour}
                    </div>
                    <div
                      className={`font-body text-2xs font-bold tracking-wider ${
                        isSelected ? "text-[var(--hotel-champagne)]" : "text-[var(--hotel-stone)]"
                      }`}
                    >
                      {time.period}
                    </div>
                  </div>

                  {/* Slot info */}
                  <div className="flex-1 min-w-0">
                    <p
                      className={`font-body text-sm font-semibold ${
                        isFilled ? "text-[var(--hotel-stone)]" : "text-[var(--hotel-charcoal)]"
                      }`}
                    >
                      {SLOT_ICONS[slot.id]}&nbsp;&nbsp;{slot.label}
                    </p>
                    <p
                      className={`font-body text-xs mt-0.5 ${
                        isRecommended && !isFilled
                          ? "text-[var(--hotel-champagne)] font-medium"
                          : "text-[var(--hotel-stone)]"
                      }`}
                    >
                      {isFilled && filledStop
                        ? `${filledStop.event?.title || filledStop.venue.name} · Reserved`
                        : isRecommended
                        ? "Recommended slot for this event"
                        : "Empty — tap to assign"}
                    </p>
                  </div>

                  {/* Radio / check indicator */}
                  <div className="shrink-0">
                    {isFilled ? (
                      <span className="text-base font-bold text-green-600">✓</span>
                    ) : (
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          isSelected
                            ? "border-[var(--hotel-champagne)]"
                            : "border-[var(--hotel-sand)]"
                        }`}
                      >
                        {isSelected && (
                          <div className="w-2.5 h-2.5 rounded-full bg-[var(--hotel-champagne)]" />
                        )}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Walk info */}
          {currentStops.length > 0 && (
            <p className="font-body text-xs text-[var(--hotel-stone)] text-center">
              🚶 Walk times calculated after adding
            </p>
          )}

          {/* Add CTA */}
          <button
            onClick={() => onAdd(event, selectedSlot)}
            className="w-full py-3.5 rounded-full bg-[var(--hotel-champagne)] text-[var(--hotel-charcoal)] font-body font-bold text-base shadow-lg hover:shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <span>✨</span>
            <span>
              Add to {selectedSlotConfig ? formatSlotTime(selectedSlotConfig.defaultTime).hour : ""}{" "}
              {selectedSlotConfig ? formatSlotTime(selectedSlotConfig.defaultTime).period : ""} Slot
            </span>
          </button>

          {/* Cancel */}
          <button
            onClick={onClose}
            className="w-full py-2 text-sm font-body text-[var(--hotel-stone)] hover:text-[var(--hotel-charcoal)] transition-colors text-center"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
