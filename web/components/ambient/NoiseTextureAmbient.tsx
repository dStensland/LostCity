"use client";

import { useMemo } from "react";
import type { PortalAmbientConfig } from "@/lib/portal-context";

interface NoiseTextureAmbientProps {
  config: Partial<PortalAmbientConfig>;
}

/**
 * Noise Texture Ambient Effect
 * Subtle animated noise/grain texture overlay.
 * CSS-only for performance.
 */
export default function NoiseTextureAmbient({ config }: NoiseTextureAmbientProps) {
  const primaryColor = config.colors?.primary || "#E855A0";

  // Animation speed based on config
  const animationDuration = useMemo(() => {
    switch (config.animation_speed) {
      case "slow":
        return "3s";
      case "fast":
        return "0.5s";
      default:
        return "1s";
    }
  }, [config.animation_speed]);

  // Intensity affects opacity
  const opacity = useMemo(() => {
    switch (config.intensity) {
      case "subtle":
        return 0.03;
      case "bold":
        return 0.1;
      default:
        return 0.05;
    }
  }, [config.intensity]);

  // SVG noise filter as a data URL
  const noiseSvg = useMemo(() => {
    return `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`;
  }, []);

  return (
    <div
      className="fixed inset-0 pointer-events-none z-0"
      aria-hidden="true"
    >
      {/* Animated noise layer */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: noiseSvg,
          opacity: opacity,
          animation: `noise-shift ${animationDuration} steps(5) infinite`,
        }}
      />

      {/* Subtle color tint overlay */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at 50% 0%, ${primaryColor}10, transparent 60%)`,
        }}
      />

      {/* Keyframes */}
      <style>{`
        @keyframes noise-shift {
          0% {
            transform: translate(0, 0);
          }
          10% {
            transform: translate(-1%, -1%);
          }
          20% {
            transform: translate(1%, 1%);
          }
          30% {
            transform: translate(-1%, 1%);
          }
          40% {
            transform: translate(1%, -1%);
          }
          50% {
            transform: translate(-0.5%, 0.5%);
          }
          60% {
            transform: translate(0.5%, -0.5%);
          }
          70% {
            transform: translate(-1%, -0.5%);
          }
          80% {
            transform: translate(0.5%, 1%);
          }
          90% {
            transform: translate(-0.5%, -1%);
          }
          100% {
            transform: translate(0, 0);
          }
        }
      `}</style>
    </div>
  );
}
