"use client";

import { useMemo, useId } from "react";
import ScopedStyles from "@/components/ScopedStyles";
import { sanitizeCssColor } from "@/lib/css-utils";
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
  const primaryColor = sanitizeCssColor(config.colors?.primary || "#E855A0") || "#E855A0";
  const secondaryColor = sanitizeCssColor(config.colors?.secondary || "#00D4E8") || "#00D4E8";

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

  const opacityPct = Math.round(opacity * 1000) / 10;
  const softOpacityPct = Math.round(opacity * 0.7 * 1000) / 10;
  const rawId = useId();
  const instanceClass = `gradient-wave-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const css = `
    .${instanceClass} .gradient-wave-layer-1 {
      background: linear-gradient(
        45deg,
        transparent,
        color-mix(in srgb, ${primaryColor} ${opacityPct}%, transparent),
        transparent,
        color-mix(in srgb, ${secondaryColor} ${opacityPct}%, transparent),
        transparent
      );
      background-size: 400% 400%;
      animation: gradient-wave ${animationDuration} ease-in-out infinite;
    }
    .${instanceClass} .gradient-wave-layer-2 {
      background: linear-gradient(
        -45deg,
        transparent,
        color-mix(in srgb, ${secondaryColor} ${softOpacityPct}%, transparent),
        transparent,
        color-mix(in srgb, ${primaryColor} ${softOpacityPct}%, transparent),
        transparent
      );
      background-size: 400% 400%;
      animation: gradient-wave ${animationDuration} ease-in-out infinite reverse;
      animation-delay: -6s;
    }
    @keyframes gradient-wave {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }
  `;

  return (
    <div
      className={`ambient-layer fixed inset-0 pointer-events-none z-0 overflow-hidden ${instanceClass}`}
      aria-hidden="true"
    >
      <ScopedStyles css={css} />
      {/* Wave 1 */}
      <div className="absolute inset-0 gradient-wave-layer-1" />

      {/* Wave 2 (offset) */}
      <div className="absolute inset-0 gradient-wave-layer-2" />
    </div>
  );
}
