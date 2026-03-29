"use client";

/**
 * TimeFlowMarker — visual divider that separates time sections in the Lineup.
 *
 * Variants:
 *   - happening_now: "Happening Now" (neon-green pulse dot)
 *   - tonight / this_afternoon: "Tonight" or "This Afternoon" (gold)
 *   - on_the_horizon: "On the Horizon" (gold — temporal concept)
 */

import { memo } from "react";

type TimeFlowVariant = "happening_now" | "tonight" | "this_afternoon" | "on_the_horizon";

interface TimeFlowMarkerProps {
  variant: TimeFlowVariant;
  label?: string; // Override default label
}

const VARIANT_CONFIG: Record<
  TimeFlowVariant,
  { label: string; color: string; pulse?: boolean }
> = {
  happening_now: {
    label: "Happening Now",
    color: "var(--neon-green)",
    pulse: true,
  },
  tonight: {
    label: "Tonight",
    color: "var(--gold)",
  },
  this_afternoon: {
    label: "This Afternoon",
    color: "var(--gold)",
  },
  on_the_horizon: {
    label: "On the Horizon",
    color: "var(--gold)",
  },
};

export const TimeFlowMarker = memo(function TimeFlowMarker({
  variant,
  label,
}: TimeFlowMarkerProps) {
  const config = VARIANT_CONFIG[variant];
  const displayLabel = label ?? config.label;

  return (
    <div className="flex items-center gap-2.5 py-3">
      {/* Dot indicator */}
      <span
        className={[
          "w-2 h-2 rounded-full shrink-0",
          config.pulse ? "animate-pulse" : "",
        ].join(" ")}
        style={{
          backgroundColor: config.color,
          boxShadow: config.pulse
            ? `0 0 6px color-mix(in srgb, ${config.color} 40%, transparent)`
            : undefined,
        }}
        aria-hidden="true"
      />

      {/* Label */}
      <span
        className="font-mono text-2xs font-bold uppercase tracking-[0.14em]"
        style={{ color: config.color }}
      >
        {displayLabel}
      </span>

      {/* Fading line */}
      <div
        className="flex-1 h-px"
        style={{
          background: `linear-gradient(90deg, ${config.color}, transparent)`,
          opacity: 0.25,
        }}
      />
    </div>
  );
});

export type { TimeFlowMarkerProps, TimeFlowVariant };
