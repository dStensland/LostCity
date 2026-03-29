"use client";

/**
 * RegularsNudge — discoverability nudge for the Regulars toggle.
 *
 * Shows at the bottom of the Lineup section when:
 * - ENABLE_LINEUP_RECURRING is true
 * - There are no recurring events to display
 * - User hasn't dismissed or seen it 3+ times
 *
 * Tracking:
 * - regulars_nudge_dismissed: boolean (localStorage)
 * - regulars_nudge_count: number (localStorage) — max 3 impressions
 *
 * Returns null when dismissed or after 3 impressions.
 */

import { useState, useEffect } from "react";

interface RegularsNudgeProps {
  onActivateToggle: () => void;
}

export const RegularsNudge = function RegularsNudge({
  onActivateToggle,
}: RegularsNudgeProps) {
  const [isDismissed, setIsDismissed] = useState(true);

  useEffect(() => {
    // Check if already dismissed
    const dismissed = localStorage.getItem("regulars_nudge_dismissed");
    if (dismissed === "true") {
      return;
    }

    // Check impression count
    const countStr = localStorage.getItem("regulars_nudge_count");
    const count = countStr ? parseInt(countStr, 10) : 0;

    if (count >= 3) {
      localStorage.setItem("regulars_nudge_dismissed", "true");
      return;
    }

    // First impression or still under limit
    setIsDismissed(false);

    // Increment impression count
    localStorage.setItem("regulars_nudge_count", String(count + 1));
  }, []);

  if (isDismissed) {
    return null;
  }

  const handleToggleClick = () => {
    localStorage.setItem("regulars_nudge_dismissed", "true");
    setIsDismissed(true);
    onActivateToggle();
  };

  return (
    <div className="mx-4 mt-2 mb-4 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-[var(--cream)]/60">
          Looking for weekly trivia, karaoke, comedy?
        </p>
        <button
          onClick={handleToggleClick}
          className="flex-shrink-0 text-xs text-[var(--vibe)] font-medium hover:opacity-80 transition-opacity active:scale-95"
          aria-label="Toggle Regulars view"
        >
          Toggle Regulars →
        </button>
      </div>
    </div>
  );
};

export type { RegularsNudgeProps };
