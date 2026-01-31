"use client";

import { useMemo } from "react";
import type { PortalAmbientConfig } from "@/lib/portal-context";

interface GradientWaveAmbientProps {
  config: Partial<PortalAmbientConfig>;
}

/**
 * Gradient Wave Ambient Effect
 * Animated gradient waves that flow across the background.
 * CSS-only for performance.
 */
export default function GradientWaveAmbient({ config }: GradientWaveAmbientProps) {
  const primaryColor = config.colors?.primary || "#E855A0";
  const secondaryColor = config.colors?.secondary || "#00D4E8";

  // Animation speed based on config
  const animationDuration = useMemo(() => {
    switch (config.animation_speed) {
      case "slow":
        return "20s";
      case "fast":
        return "8s";
      default:
        return "12s";
    }
  }, [config.animation_speed]);

  // Intensity affects opacity
  const opacity = useMemo(() => {
    switch (config.intensity) {
      case "subtle":
        return 0.08;
      case "bold":
        return 0.2;
      default:
        return 0.12;
    }
  }, [config.intensity]);

  return (
    <div
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
      aria-hidden="true"
    >
      {/* Wave 1 */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(45deg, ${primaryColor}00, ${primaryColor}${Math.round(opacity * 255).toString(16).padStart(2, "0")}, ${primaryColor}00, ${secondaryColor}${Math.round(opacity * 255).toString(16).padStart(2, "0")}, ${secondaryColor}00)`,
          backgroundSize: "400% 400%",
          animation: `gradient-wave ${animationDuration} ease-in-out infinite`,
        }}
      />

      {/* Wave 2 (offset) */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(-45deg, ${secondaryColor}00, ${secondaryColor}${Math.round(opacity * 0.7 * 255).toString(16).padStart(2, "0")}, ${primaryColor}00, ${primaryColor}${Math.round(opacity * 0.7 * 255).toString(16).padStart(2, "0")}, ${primaryColor}00)`,
          backgroundSize: "400% 400%",
          animation: `gradient-wave ${animationDuration} ease-in-out infinite reverse`,
          animationDelay: "-6s",
        }}
      />

      {/* Keyframes injected via style tag */}
      <style>{`
        @keyframes gradient-wave {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }
      `}</style>
    </div>
  );
}
