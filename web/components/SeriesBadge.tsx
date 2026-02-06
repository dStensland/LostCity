"use client";

import { memo } from "react";
import { formatRecurrence, type Frequency, type DayOfWeek } from "@/lib/recurrence";
import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClass } from "@/lib/css-utils";

// Inline helpers to avoid importing from server-only lib/series.ts
function getSeriesTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    film: "Film",
    recurring_show: "Recurring Show",
    class_series: "Class Series",
    festival_program: "Program",
    tour: "Tour",
    other: "Series",
  };
  return labels[type] || "Series";
}

function getSeriesTypeColor(type: string): string {
  const colors: Record<string, string> = {
    film: "#A5B4FC", // indigo
    recurring_show: "#F9A8D4", // pink
    class_series: "#6EE7B7", // green
    festival_program: "#FBBF24", // amber
    tour: "#C4B5FD", // purple
    other: "#94A3B8", // slate
  };
  return colors[type] || "#94A3B8";
}

interface SeriesBadgeProps {
  seriesType: string;
  frequency?: Frequency;
  dayOfWeek?: DayOfWeek;
  /** Compact mode for use in event cards */
  compact?: boolean;
}

function SeriesBadge({ seriesType, frequency, dayOfWeek, compact = true }: SeriesBadgeProps) {
  const recurrenceText = formatRecurrence(frequency || null, dayOfWeek || null);
  const typeLabel = getSeriesTypeLabel(seriesType);
  const typeColor = getSeriesTypeColor(seriesType);
  const seriesClass = createCssVarClass("--series-color", typeColor, "series-color");

  if (compact) {
    // Compact version: show recurrence if available, otherwise type
    const displayText = recurrenceText || typeLabel;

    return (
      <>
        <ScopedStyles css={seriesClass?.css} />
        <span
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[0.6rem] font-mono font-medium series-bg-20 series-accent ${seriesClass?.className ?? ""}`}
        >
        {/* Repeat icon for recurring events */}
        {recurrenceText && (
          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        )}
        {displayText}
        </span>
      </>
    );
  }

  // Full version: show both type and recurrence
  return (
    <div className={`inline-flex items-center gap-2 ${seriesClass?.className ?? ""}`}>
      <ScopedStyles css={seriesClass?.css} />
      <span
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-mono font-medium series-bg-15 series-accent series-border-30"
      >
        {/* Series type icon based on type */}
        {seriesType === "film" && (
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
          </svg>
        )}
        {seriesType === "recurring_show" && (
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        )}
        {seriesType === "tour" && (
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          </svg>
        )}
        {typeLabel}
      </span>
      {recurrenceText && (
        <span className="text-xs text-[var(--muted)]">
          {recurrenceText}
        </span>
      )}
    </div>
  );
}

export default memo(SeriesBadge);
