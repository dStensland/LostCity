"use client";

/**
 * FeedTimeMachine — admin toolbar for previewing the feed at any day × time
 * slot. Activated by `?admin` in the URL, floats at the bottom of the
 * viewport, and pushes overrides into the `FeedAdminOverrideContext` so the
 * briefing + lineup islands refetch through `useCityPulseFeed`.
 */
import { useCallback, useState } from "react";
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
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | undefined>(
    currentTimeSlot,
  );
  const [collapsed, setCollapsed] = useState(false);

  const handleDayClick = useCallback(
    (day: string) => {
      const newDay = selectedDay === day ? undefined : day;
      setSelectedDay(newDay);
      onOverride(newDay, selectedSlot);
    },
    [selectedDay, selectedSlot, onOverride],
  );

  const handleSlotClick = useCallback(
    (slot: TimeSlot) => {
      const newSlot = selectedSlot === slot ? undefined : slot;
      setSelectedSlot(newSlot);
      onOverride(selectedDay, newSlot);
    },
    [selectedDay, selectedSlot, onOverride],
  );

  const handleReset = useCallback(() => {
    setSelectedDay(undefined);
    setSelectedSlot(undefined);
    onOverride(undefined, undefined);
  }, [onOverride]);

  const hasOverride = selectedDay !== undefined || selectedSlot !== undefined;

  return (
    <aside
      className="fixed bottom-3 left-1/2 z-[140] -translate-x-1/2 rounded-xl border border-[var(--coral)]/55 bg-[var(--night)]/95 px-3 py-2 text-[var(--cream)] shadow-[0_10px_30px_rgba(0,0,0,0.55)] backdrop-blur-sm"
      role="complementary"
      aria-label="Feed time machine"
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-2xs uppercase tracking-[0.18em] text-[var(--muted)]">
            Time machine
          </span>
          {hasOverride && (
            <span className="rounded-full bg-[var(--coral)]/20 px-1.5 py-0.5 font-mono text-2xs text-[var(--coral)]">
              active
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="rounded-md border border-[var(--twilight)]/55 px-2 py-0.5 font-mono text-2xs text-[var(--muted)] hover:text-[var(--cream)]"
        >
          {collapsed ? "Expand" : "Collapse"}
        </button>
        {hasOverride && !collapsed && (
          <button
            type="button"
            onClick={handleReset}
            className="rounded-md border border-[var(--twilight)]/55 px-2 py-0.5 font-mono text-2xs text-[var(--muted)] hover:text-[var(--cream)]"
          >
            Reset
          </button>
        )}
      </div>

      {!collapsed && (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            {DAYS.map((d) => {
              const active = selectedDay === d.value;
              return (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => handleDayClick(d.value)}
                  className={`rounded-md px-2 py-1 font-mono text-2xs transition-colors ${
                    active
                      ? "bg-[var(--coral)] text-[var(--void)]"
                      : "border border-[var(--twilight)]/55 text-[var(--muted)] hover:text-[var(--cream)]"
                  }`}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-1">
            {TIME_SLOTS.map((s) => {
              const active = selectedSlot === s.value;
              return (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => handleSlotClick(s.value)}
                  className={`flex items-center gap-1 rounded-md px-2 py-1 font-mono text-2xs transition-colors ${
                    active
                      ? "bg-[var(--coral)] text-[var(--void)]"
                      : "border border-[var(--twilight)]/55 text-[var(--muted)] hover:text-[var(--cream)]"
                  }`}
                >
                  <span aria-hidden>{s.icon}</span>
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
}
