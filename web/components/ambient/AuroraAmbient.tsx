"use client";

import { useMemo, useId } from "react";
import ScopedStyles from "@/components/ScopedStyles";
import { sanitizeCssColor } from "@/lib/css-utils";
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
  const primaryColor = sanitizeCssColor(config.colors?.primary || "#00D9A0") || "#00D9A0";
  const secondaryColor = sanitizeCssColor(config.colors?.secondary || "#00D4E8") || "#00D4E8";

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

  const opacityPct = Math.round(opacity * 1000) / 10;
  const opacityPct80 = Math.round(opacity * 0.8 * 1000) / 10;
  const opacityPct70 = Math.round(opacity * 0.7 * 1000) / 10;
  const opacityPct60 = Math.round(opacity * 0.6 * 1000) / 10;
  const opacityPct40 = Math.round(opacity * 0.4 * 1000) / 10;
  const rawId = useId();
  const instanceClass = `aurora-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const css = `
    .${instanceClass} .aurora-layer-1 {
      background:
        radial-gradient(ellipse 120% 50% at 20% -10%, color-mix(in srgb, ${primaryColor} ${opacityPct}%, transparent), transparent 60%),
        radial-gradient(ellipse 100% 60% at 80% 0%, color-mix(in srgb, ${secondaryColor} ${opacityPct80}%, transparent), transparent 60%);
      animation: aurora-shift-1 ${animationDuration} ease-in-out infinite;
    }
    .${instanceClass} .aurora-layer-2 {
      background:
        radial-gradient(ellipse 140% 40% at 60% -5%, color-mix(in srgb, ${secondaryColor} ${opacityPct60}%, transparent), transparent 60%),
        radial-gradient(ellipse 80% 50% at 30% 5%, color-mix(in srgb, ${primaryColor} ${opacityPct70}%, transparent), transparent 60%);
      animation: aurora-shift-2 ${animationDuration} ease-in-out infinite;
      animation-delay: -10s;
    }
    .${instanceClass} .aurora-layer-3 {
      background:
        radial-gradient(ellipse 110% 35% at 50% -10%, color-mix(in srgb, ${primaryColor} ${opacityPct40}%, transparent), transparent 70%);
      animation: aurora-wave ${animationDuration} ease-in-out infinite;
      animation-delay: -5s;
    }
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
  `;

  return (
    <div
      className={`ambient-layer fixed inset-0 pointer-events-none z-0 overflow-hidden ${instanceClass}`}
      aria-hidden="true"
    >
      <ScopedStyles css={css} />
      {/* Aurora layer 1 */}
      <div className="absolute inset-0 aurora-layer-1" />

      {/* Aurora layer 2 */}
      <div className="absolute inset-0 aurora-layer-2" />

      {/* Aurora layer 3 - subtle waves */}
      <div className="absolute inset-0 aurora-layer-3" />
    </div>
  );
}
