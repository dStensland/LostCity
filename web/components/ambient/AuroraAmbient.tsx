"use client";

import { useMemo } from "react";
import type { PortalAmbientConfig } from "@/lib/portal-context";

interface AuroraAmbientProps {
  config: Partial<PortalAmbientConfig>;
}

/**
 * Aurora Ambient Effect
 * Northern lights-style animated gradients.
 * CSS-only for performance.
 */
export default function AuroraAmbient({ config }: AuroraAmbientProps) {
  const primaryColor = config.colors?.primary || "#00D9A0";
  const secondaryColor = config.colors?.secondary || "#00D4E8";

  // Animation speed based on config
  const animationDuration = useMemo(() => {
    switch (config.animation_speed) {
      case "slow":
        return "30s";
      case "fast":
        return "12s";
      default:
        return "20s";
    }
  }, [config.animation_speed]);

  // Intensity affects opacity
  const opacity = useMemo(() => {
    switch (config.intensity) {
      case "subtle":
        return 0.15;
      case "bold":
        return 0.4;
      default:
        return 0.25;
    }
  }, [config.intensity]);

  return (
    <div
      className="ambient-layer fixed inset-0 pointer-events-none z-0 overflow-hidden"
      aria-hidden="true"
    >
      {/* Aurora layer 1 */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 120% 50% at 20% -10%, ${primaryColor}${Math.round(opacity * 255).toString(16).padStart(2, "0")}, transparent 60%),
            radial-gradient(ellipse 100% 60% at 80% 0%, ${secondaryColor}${Math.round(opacity * 0.8 * 255).toString(16).padStart(2, "0")}, transparent 60%)
          `,
          animation: `aurora-shift-1 ${animationDuration} ease-in-out infinite`,
        }}
      />

      {/* Aurora layer 2 */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 140% 40% at 60% -5%, ${secondaryColor}${Math.round(opacity * 0.6 * 255).toString(16).padStart(2, "0")}, transparent 60%),
            radial-gradient(ellipse 80% 50% at 30% 5%, ${primaryColor}${Math.round(opacity * 0.7 * 255).toString(16).padStart(2, "0")}, transparent 60%)
          `,
          animation: `aurora-shift-2 ${animationDuration} ease-in-out infinite`,
          animationDelay: "-10s",
        }}
      />

      {/* Aurora layer 3 - subtle waves */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 110% 35% at 50% -10%, ${primaryColor}${Math.round(opacity * 0.4 * 255).toString(16).padStart(2, "0")}, transparent 70%)
          `,
          animation: `aurora-wave ${animationDuration} ease-in-out infinite`,
          animationDelay: "-5s",
        }}
      />

      {/* Keyframes - opacity only for subtle breathing effect */}
      <style>{`
        @keyframes aurora-shift-1 {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }

        @keyframes aurora-shift-2 {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }

        @keyframes aurora-wave {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}
