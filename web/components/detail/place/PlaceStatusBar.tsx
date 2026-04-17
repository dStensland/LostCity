"use client";

import { memo } from "react";
import type { PlaceHoursStatus } from "@/lib/place-hours-status";

// ─── Props ────────────────────────────────────────────────────────────────────

interface PlaceStatusBarProps {
  status: PlaceHoursStatus;
  /** No-op stub for now — opens hours modal/expand in future */
  onSeeHours?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const PlaceStatusBar = memo(function PlaceStatusBar({
  status,
  onSeeHours,
}: PlaceStatusBarProps) {
  // When no hours data, render nothing — the bar is omitted entirely
  if (status.kind === "unknown") return null;

  const isOpen = status.kind === "open" || status.kind === "closing_soon";
  const isClosingSoon = status.kind === "closing_soon";

  // Dot color: green when open/closing-soon, amber when closed
  const dotColor = isOpen
    ? isClosingSoon
      ? "bg-[var(--gold)]"
      : "bg-[var(--neon-green)]"
    : "bg-[var(--coral)]";

  // Status label
  const statusLabel = isOpen ? "Open now" : "Closed";

  // Sub-text (closes / opens info)
  let subText: string | null = null;
  if (status.kind === "open") {
    subText = `Closes ${status.closesAt}`;
  } else if (status.kind === "closing_soon") {
    subText = `Closes ${status.closesAt}`;
  } else if (status.kind === "closed") {
    if (status.opensAt && status.opensDayLabel) {
      const label =
        status.opensDayLabel === "tomorrow"
          ? `Opens ${status.opensAt} tomorrow`
          : `Opens ${status.opensAt} ${status.opensDayLabel}`;
      subText = label;
    }
  }

  return (
    <div className="bg-[var(--night)] px-4 py-2.5 lg:px-8 lg:py-3 flex items-center justify-between">
      {/* Left: status pill + close/open sub-text */}
      <div className="flex items-center gap-2.5">
        {/* Open/Closed pill */}
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
            isOpen
              ? isClosingSoon
                ? "bg-[var(--gold)]/10 text-[var(--gold)]"
                : "bg-[var(--neon-green)]/10 text-[var(--neon-green)]"
              : "bg-[var(--coral)]/10 text-[var(--coral)]"
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`} />
          {statusLabel}
        </span>

        {/* Sub-text */}
        {subText && (
          <span className="text-xs text-[var(--soft)]">{subText}</span>
        )}
      </div>

      {/* Right: See hours stub */}
      <button
        type="button"
        onClick={onSeeHours}
        className="font-mono text-xs text-[var(--coral)] hover:opacity-80 transition-opacity"
        aria-label="See full hours"
      >
        See hours
      </button>
    </div>
  );
});

export type { PlaceStatusBarProps };
