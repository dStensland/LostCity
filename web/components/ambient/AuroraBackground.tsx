"use client";

import { useId, useMemo } from "react";
import ScopedStyles from "@/components/ScopedStyles";

interface AuroraBackgroundProps {
  /** Primary blob color (CSS color value) */
  color1?: string;
  /** Secondary blob color (CSS color value) */
  color2?: string;
  /** Third blob color (optional) */
  color3?: string;
  /** Opacity of the blobs (default 0.12) */
  opacity?: number;
  /** Animation duration in seconds (default 20) */
  duration?: number;
  className?: string;
}

export default function AuroraBackground({
  color1 = "var(--coral)",
  color2 = "var(--neon-cyan)",
  color3,
  opacity = 0.12,
  duration = 20,
  className = "absolute inset-0 -z-10 overflow-hidden",
}: AuroraBackgroundProps) {
  const rawId = useId();
  const id = rawId.replace(/[^a-zA-Z0-9]/g, "");

  const css = useMemo(() => `
    .aurora-${id} .aurora-blob {
      position: absolute;
      width: 60vmax;
      height: 60vmax;
      border-radius: 50%;
      filter: blur(80px);
      opacity: ${opacity};
      will-change: transform;
    }

    .aurora-${id} .aurora-blob-1 {
      background: ${color1};
      top: -30%;
      left: -15%;
      animation: aurora-drift-${id}-1 ${duration}s ease-in-out infinite alternate;
    }

    .aurora-${id} .aurora-blob-2 {
      background: ${color2};
      bottom: -30%;
      right: -15%;
      animation: aurora-drift-${id}-2 ${duration}s ease-in-out infinite alternate;
      animation-delay: ${-duration / 2}s;
    }

    ${color3 ? `
    .aurora-${id} .aurora-blob-3 {
      background: ${color3};
      top: 20%;
      right: 30%;
      width: 40vmax;
      height: 40vmax;
      animation: aurora-drift-${id}-3 ${duration * 1.3}s ease-in-out infinite alternate;
      animation-delay: ${-duration / 3}s;
    }
    ` : ""}

    @keyframes aurora-drift-${id}-1 {
      from { transform: translate(0, 0) rotate(0deg); }
      to { transform: translate(5vw, 3vh) rotate(15deg); }
    }

    @keyframes aurora-drift-${id}-2 {
      from { transform: translate(0, 0) rotate(0deg); }
      to { transform: translate(-4vw, -2vh) rotate(-10deg); }
    }

    @keyframes aurora-drift-${id}-3 {
      from { transform: translate(0, 0) rotate(0deg) scale(1); }
      to { transform: translate(3vw, -4vh) rotate(20deg) scale(1.1); }
    }

    @media (prefers-reduced-motion: reduce) {
      .aurora-${id} .aurora-blob {
        animation: none !important;
      }
    }
  `, [id, color1, color2, color3, opacity, duration]);

  return (
    <div className={`aurora-${id} ${className}`} aria-hidden="true">
      <ScopedStyles css={css} />
      <div className="aurora-blob aurora-blob-1" />
      <div className="aurora-blob aurora-blob-2" />
      {color3 && <div className="aurora-blob aurora-blob-3" />}
    </div>
  );
}
