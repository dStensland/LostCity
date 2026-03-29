"use client";

import { memo } from "react";

interface TimeFlowMarkerProps {
  variant: "happening_now" | "tonight" | "on_the_horizon";
  label?: string; // Override default label
}

const VARIANT_CONFIG = {
  happening_now: {
    color: "var(--neon-green)",
    defaultLabel: "Happening Now",
    hasPulse: true,
  },
  tonight: {
    color: "var(--gold)",
    defaultLabel: "Tonight",
    hasPulse: false,
  },
  on_the_horizon: {
    color: "var(--gold)",
    defaultLabel: "On the Horizon",
    hasPulse: false,
  },
};

export const TimeFlowMarker = memo(function TimeFlowMarker({
  variant,
  label,
}: TimeFlowMarkerProps) {
  const config = VARIANT_CONFIG[variant];
  const displayLabel = label || config.defaultLabel;

  // Check if we're before 2pm (14:00) for "Tonight" → "This Afternoon"
  const effectiveLabel =
    variant === "tonight" && label === undefined
      ? new Date().getHours() < 14
        ? "This Afternoon"
        : "Tonight"
      : displayLabel;

  return (
    <div className="flex items-center gap-3 my-4">
      {/* Dot with optional pulse */}
      <div
        className={`flex-shrink-0 w-1.5 h-1.5 rounded-full ${
          config.hasPulse ? "animate-pulse" : ""
        }`}
        style={{
          backgroundColor: config.color,
          boxShadow: config.hasPulse
            ? `0 0 12px ${config.color}, 0 0 24px color-mix(in srgb, ${config.color} 40%, transparent)`
            : "none",
        }}
        aria-hidden="true"
      />

      {/* Label */}
      <span
        className="text-2xs uppercase tracking-wider font-semibold flex-shrink-0"
        style={{ color: config.color }}
      >
        {effectiveLabel}
      </span>

      {/* Horizontal line extending to right edge */}
      <div
        className="flex-1 h-px"
        style={{
          backgroundColor: `color-mix(in srgb, ${config.color} 15%, transparent)`,
        }}
      />
    </div>
  );
});

export type { TimeFlowMarkerProps };
