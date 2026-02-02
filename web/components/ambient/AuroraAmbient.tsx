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
            radial-gradient(ellipse 100% 40% at 20% 0%, ${primaryColor}${Math.round(opacity * 255).toString(16).padStart(2, "0")}, transparent 50%),
            radial-gradient(ellipse 80% 50% at 80% 10%, ${secondaryColor}${Math.round(opacity * 0.8 * 255).toString(16).padStart(2, "0")}, transparent 50%)
          `,
          animation: `aurora-shift-1 ${animationDuration} ease-in-out infinite`,
        }}
      />

      {/* Aurora layer 2 */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 120% 30% at 60% 5%, ${secondaryColor}${Math.round(opacity * 0.6 * 255).toString(16).padStart(2, "0")}, transparent 50%),
            radial-gradient(ellipse 60% 40% at 30% 15%, ${primaryColor}${Math.round(opacity * 0.7 * 255).toString(16).padStart(2, "0")}, transparent 50%)
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
            radial-gradient(ellipse 90% 25% at 50% 0%, ${primaryColor}${Math.round(opacity * 0.4 * 255).toString(16).padStart(2, "0")}, transparent 60%)
          `,
          animation: `aurora-wave ${animationDuration} ease-in-out infinite`,
          animationDelay: "-5s",
        }}
      />

      {/* Keyframes */}
      <style>{`
        @keyframes aurora-shift-1 {
          0%, 100% {
            transform: translateX(0) scaleY(1);
            opacity: 1;
          }
          33% {
            transform: translateX(10%) scaleY(1.2);
            opacity: 0.8;
          }
          66% {
            transform: translateX(-5%) scaleY(0.9);
            opacity: 1.1;
          }
        }

        @keyframes aurora-shift-2 {
          0%, 100% {
            transform: translateX(0) scaleY(1) rotate(0deg);
            opacity: 1;
          }
          33% {
            transform: translateX(-15%) scaleY(1.3) rotate(-2deg);
            opacity: 0.7;
          }
          66% {
            transform: translateX(10%) scaleY(0.8) rotate(2deg);
            opacity: 1.2;
          }
        }

        @keyframes aurora-wave {
          0%, 100% {
            transform: translateY(0) scaleX(1);
          }
          50% {
            transform: translateY(5%) scaleX(1.1);
          }
        }
      `}</style>
    </div>
  );
}
