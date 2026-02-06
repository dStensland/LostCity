"use client";

import { useMemo, useId } from "react";
import ScopedStyles from "@/components/ScopedStyles";
import { sanitizeCssColor } from "@/lib/css-utils";
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
  const primaryColor = sanitizeCssColor(config.colors?.primary || "#E855A0") || "#E855A0";

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

  const rawId = useId();
  const instanceClass = `noise-texture-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const css = `
    .${instanceClass} .noise-layer {
      background-image: ${noiseSvg};
      opacity: ${opacity};
      animation: noise-shift ${animationDuration} steps(5) infinite;
    }
    .${instanceClass} .noise-tint {
      background: radial-gradient(
        ellipse at 50% 0%,
        color-mix(in srgb, ${primaryColor} 6%, transparent),
        transparent 60%
      );
    }
    @keyframes noise-shift {
      0% { transform: translate(0, 0); }
      10% { transform: translate(-1%, -1%); }
      20% { transform: translate(1%, 1%); }
      30% { transform: translate(-1%, 1%); }
      40% { transform: translate(1%, -1%); }
      50% { transform: translate(-0.5%, 0.5%); }
      60% { transform: translate(0.5%, -0.5%); }
      70% { transform: translate(-1%, -0.5%); }
      80% { transform: translate(0.5%, 1%); }
      90% { transform: translate(-0.5%, -1%); }
      100% { transform: translate(0, 0); }
    }
  `;

  return (
    <div
      className={`ambient-layer fixed inset-0 pointer-events-none z-0 ${instanceClass}`}
      aria-hidden="true"
    >
      <ScopedStyles css={css} />
      {/* Animated noise layer */}
      <div className="absolute inset-0 noise-layer" />

      {/* Subtle color tint overlay */}
      <div className="absolute inset-0 noise-tint" />
    </div>
  );
}
