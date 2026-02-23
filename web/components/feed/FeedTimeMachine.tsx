"use client";

/**
 * FeedTimeMachine — admin toolbar for previewing the feed at any day × time slot.
 *
 * Activated via ?admin query param. Floats at the bottom of the viewport.
 * Sends day/time_slot overrides to the CityPulse API to preview headers,
 * cards, quick links, and section content for any moment of the week.
 */

import { useState, useCallback } from "react";
import type { TimeSlot } from "@/lib/city-pulse/types";

const DAYS = [
  { value: "monday", label: "Mon" },
  { value: "tuesday", label: "Tue" },
  { value: "wednesday", label: "Wed" },
  { value: "thursday", label: "Thu" },
  { value: "friday", label: "Fri" },
  { value: "saturday", label: "Sat" },
  { value: "sunday", label: "Sun" },
] as const;

const TIME_SLOTS: { value: TimeSlot; label: string; icon: string }[] = [
  { value: "morning", label: "Morning", icon: "☀️" },
  { value: "midday", label: "Lunch", icon: "🌤" },
  { value: "happy_hour", label: "Afternoon", icon: "🍺" },
  { value: "evening", label: "Evening", icon: "🌆" },
  { value: "late_night", label: "Night", icon: "🌙" },
];

interface FeedTimeMachineProps {
  currentDay?: string;
  currentTimeSlot?: TimeSlot;
  onOverride: (day: string | undefined, timeSlot: TimeSlot | undefined) => void;
}

export default function FeedTimeMachine({
  currentDay,
  currentTimeSlot,
  onOverride,
}: FeedTimeMachineProps) {
  const [selectedDay, setSelectedDay] = useState<string | undefined>(currentDay);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | undefined>(currentTimeSlot);
  const [collapsed, setCollapsed] = useState(false);

  const handleDayClick = useCallback((day: string) => {
    const newDay = selectedDay === day ? undefined : day;
    setSelectedDay(newDay);
    onOverride(newDay, selectedSlot);
  }, [selectedDay, selectedSlot, onOverride]);

  const handleSlotClick = useCallback((slot: TimeSlot) => {
    const newSlot = selectedSlot === slot ? undefined : slot;
    setSelectedSlot(newSlot);
    onOverride(selectedDay, newSlot);
  }, [selectedDay, selectedSlot, onOverride]);

  const handleReset = useCallback(() => {
    setSelectedDay(undefined);
    setSelectedSlot(undefined);
    onOverride(undefined, undefined);
  }, [onOverride]);

  const isActive = !!(selectedDay || selectedSlot);

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="fixed bottom-4 right-4 z-50 w-10 h-10 rounded-full bg-amber-500 text-black font-bold text-sm flex items-center justify-center shadow-lg hover:bg-amber-400 transition-colors"
        title="Open Feed Time Machine"
      >
        ⏰
      </button>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-sm border-t border-amber-500/30 shadow-2xl">
      <div className="max-w-lg mx-auto px-3 py-2.5">
        {/* Header row */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-amber-400 text-xs font-mono font-semibold tracking-wider uppercase">
              Feed Time Machine
            </span>
            {isActive && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono">
                {selectedDay || "any day"} · {selectedSlot?.replace("_", " ") || "any time"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {isActive && (
              <button
                onClick={handleReset}
                className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors font-mono"
              >
                Reset
              </button>
            )}
            <button
              onClick={() => setCollapsed(true)}
              className="text-neutral-500 hover:text-neutral-300 transition-colors text-sm px-1"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Day selector */}
        <div className="flex gap-1 mb-1.5">
          {DAYS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => handleDayClick(value)}
              className={`flex-1 py-1 text-[11px] font-mono rounded transition-all ${
                selectedDay === value
                  ? "bg-amber-500 text-black font-bold"
                  : "bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-neutral-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Time slot selector */}
        <div className="flex gap-1">
          {TIME_SLOTS.map(({ value, label, icon }) => (
            <button
              key={value}
              onClick={() => handleSlotClick(value)}
              className={`flex-1 py-1 text-[11px] font-mono rounded transition-all ${
                selectedSlot === value
                  ? "bg-amber-500 text-black font-bold"
                  : "bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-neutral-200"
              }`}
            >
              <span className="mr-0.5">{icon}</span> {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
