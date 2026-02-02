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
  // Intensity affects opacity
  const opacity = (() => {
    switch (config.intensity) {
      case "subtle":
        return 0.5;
      case "bold":
        return 1.2;
      default:
        return 1;
    }
  })();

  return (
    <div
      className="ambient-layer rain-overlay"
      aria-hidden="true"
      style={{
        opacity,
        // Rain overlay is at z-10 in CSS, but we want it consistent with other ambients
        zIndex: 0
      }}
    />
  );
}
