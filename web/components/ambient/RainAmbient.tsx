"use client";

import type { PortalAmbientConfig } from "@/lib/portal-context";

interface RainAmbientProps {
  config: Partial<PortalAmbientConfig>;
}

/**
 * Rain Ambient Effect
 * Neon streaks overlay that creates an atmospheric rainy night feel.
 * Uses the existing .rain-overlay CSS class from globals.css.
 */
export default function RainAmbient({ config }: RainAmbientProps) {
  const intensityClass = (() => {
    switch (config.intensity) {
      case "subtle":
        return "rain-intensity-subtle";
      case "bold":
        return "rain-intensity-bold";
      default:
        return "rain-intensity-default";
    }
  })();

  return (
    <div
      className={`ambient-layer rain-overlay rain-z-0 ${intensityClass}`}
      aria-hidden="true"
    />
  );
}
