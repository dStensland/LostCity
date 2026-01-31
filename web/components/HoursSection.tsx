"use client";

import { useState, useEffect } from "react";
import { isOpenAt, formatCloseTime, type HoursData } from "@/lib/hours";

const DAY_LABELS: Record<string, string> = {
  sun: "Sunday",
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
};

const DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

interface HoursSectionProps {
  hours: HoursData | null;
  hoursDisplay?: string | null;
  is24Hours?: boolean;
  className?: string;
}

export default function HoursSection({
  hours,
  hoursDisplay,
  is24Hours,
  className = "",
}: HoursSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<{
    isOpen: boolean;
    closesAt?: string;
  }>({ isOpen: false });
  const [currentDay, setCurrentDay] = useState<string>("mon");

  // Update status on mount and every minute
  useEffect(() => {
    const updateStatus = () => {
      const now = new Date();
      const dayNames = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
      setCurrentDay(dayNames[now.getDay()]);

      if (is24Hours) {
        setCurrentStatus({ isOpen: true });
      } else if (hours) {
        setCurrentStatus(isOpenAt(hours, now, is24Hours));
      } else {
        // No hours data - show unknown
        setCurrentStatus({ isOpen: false });
      }
    };

    updateStatus();
    const interval = setInterval(updateStatus, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [hours, is24Hours]);

  // Format time for display (HH:MM -> readable)
  const formatTime = (time: string): string => {
    const [hourStr, minStr] = time.split(":");
    const hour = parseInt(hourStr, 10);
    const min = parseInt(minStr, 10);
    const ampm = hour >= 12 ? "pm" : "am";
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return min === 0 ? `${displayHour}${ampm}` : `${displayHour}:${minStr}${ampm}`;
  };

  // If no hours data at all
  if (!hours && !hoursDisplay && !is24Hours) {
    return null;
  }

  // 24 hours
  if (is24Hours) {
    return (
      <div className={`${className}`}>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-mono font-medium bg-[var(--neon-green)]/20 text-[var(--neon-green)] border border-[var(--neon-green)]/30">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--neon-green)] animate-pulse" />
            Open 24 Hours
          </span>
        </div>
      </div>
    );
  }

  // Has structured hours data
  if (hours && Object.keys(hours).length > 0) {
    const todayHours = hours[currentDay];

    return (
      <div className={`${className}`}>
        {/* Open/Closed Badge with Today's Hours */}
        <div className="flex items-center gap-3 flex-wrap">
          {currentStatus.isOpen ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-[var(--neon-green)]/20 text-[var(--neon-green)] border border-[var(--neon-green)]/30">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--neon-green)] animate-pulse" />
              Open
              {currentStatus.closesAt && (
                <span className="text-[var(--neon-green)]/70">
                  til {formatCloseTime(currentStatus.closesAt)}
                </span>
              )}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-[var(--coral)]/20 text-[var(--coral)] border border-[var(--coral)]/30">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--coral)]" />
              Closed
            </span>
          )}

          {/* Today's hours summary */}
          {todayHours && (
            <span className="text-xs text-[var(--muted)] font-mono">
              Today: {formatTime(todayHours.open)} - {formatTime(todayHours.close)}
            </span>
          )}
          {!todayHours && (
            <span className="text-xs text-[var(--muted)] font-mono">
              Closed today
            </span>
          )}
        </div>

        {/* Expandable Weekly Schedule */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 flex items-center gap-1.5 text-xs text-[var(--muted)] hover:text-[var(--soft)] transition-colors font-mono"
        >
          <svg
            className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-90" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          {expanded ? "Hide schedule" : "See full schedule"}
        </button>

        {expanded && (
          <div className="mt-3 space-y-1.5 pl-1">
            {DAY_ORDER.map((day) => {
              const dayHours = hours[day];
              const isToday = day === currentDay;

              return (
                <div
                  key={day}
                  className={`flex items-center justify-between text-xs font-mono py-1 ${
                    isToday ? "text-[var(--cream)]" : "text-[var(--muted)]"
                  }`}
                >
                  <span className={isToday ? "font-medium" : ""}>
                    {DAY_LABELS[day]}
                    {isToday && (
                      <span className="ml-1.5 text-[0.6rem] text-[var(--coral)]">
                        TODAY
                      </span>
                    )}
                  </span>
                  <span>
                    {dayHours ? (
                      `${formatTime(dayHours.open)} - ${formatTime(dayHours.close)}`
                    ) : (
                      <span className="text-[var(--muted)]/50">Closed</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Fallback to hours_display text
  if (hoursDisplay) {
    return (
      <div className={`${className}`}>
        <p className="font-mono text-sm text-[var(--muted)]">{hoursDisplay}</p>
      </div>
    );
  }

  return null;
}

// Compact open/closed indicator for destination cards
export function OpenStatusBadge({
  hours,
  is24Hours,
  className = "",
}: {
  hours: HoursData | null;
  is24Hours?: boolean;
  className?: string;
}) {
  // Calculate initial state synchronously
  const getOpenStatus = (): boolean | null => {
    if (is24Hours) return true;
    if (!hours) return null;
    return isOpenAt(hours, new Date(), is24Hours).isOpen;
  };

  const [isOpen, setIsOpen] = useState<boolean | null>(getOpenStatus);

  // Update every minute (only set up the interval, don't call setState synchronously)
  useEffect(() => {
    if (is24Hours || !hours) return;

    const interval = setInterval(() => {
      const status = isOpenAt(hours, new Date(), is24Hours);
      setIsOpen(status.isOpen);
    }, 60000);

    return () => clearInterval(interval);
  }, [hours, is24Hours]);

  if (isOpen === null) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[0.6rem] font-mono uppercase tracking-wider ${
        isOpen
          ? "bg-[var(--neon-green)]/15 text-[var(--neon-green)] border border-[var(--neon-green)]/25"
          : "bg-[var(--coral)]/15 text-[var(--coral)] border border-[var(--coral)]/25"
      } ${className}`}
    >
      <span
        className={`w-1 h-1 rounded-full ${
          isOpen ? "bg-[var(--neon-green)] animate-pulse" : "bg-[var(--coral)]"
        }`}
      />
      {isOpen ? "Open" : "Closed"}
    </span>
  );
}
