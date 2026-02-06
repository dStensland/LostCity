"use client";

import { memo, useEffect, useState } from "react";
import ScopedStyles from "@/components/ScopedStyles";

interface FamilyConstellationLogoProps {
  size?: number;
  animated?: boolean;
  className?: string;
}

const constellationStyles = `
  @keyframes constellation-pulse {
    0%, 100% { opacity: 0.6; }
    50% { opacity: 1; }
  }
  .constellation-dot {
    animation: constellation-pulse 3s ease-in-out infinite;
    transform-origin: center;
  }
  .constellation-dot-delay-0 { animation-delay: 0s; }
  .constellation-dot-delay-1 { animation-delay: 0.2s; }
  .constellation-dot-delay-2 { animation-delay: 0.4s; }
  .constellation-dot-delay-3 { animation-delay: 0.6s; }
  .constellation-dot-delay-4 { animation-delay: 0.8s; }

  .constellation-line-delay-0 { transition-delay: 0ms; }
  .constellation-line-delay-1 { transition-delay: 150ms; }
  .constellation-line-delay-2 { transition-delay: 300ms; }
  .constellation-line-delay-3 { transition-delay: 450ms; }
  .constellation-line-delay-4 { transition-delay: 600ms; }
`;

export const FamilyConstellationLogo = memo(function FamilyConstellationLogo({
  size = 64,
  animated = true,
  className = "",
}: FamilyConstellationLogoProps) {
  const shouldAnimate = animated && typeof window !== "undefined" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [linesDrawn, setLinesDrawn] = useState(!shouldAnimate);

  useEffect(() => {
    if (!shouldAnimate) {
      return;
    }

    const timeout = setTimeout(() => {
      setLinesDrawn(true);
    }, 100);

    return () => clearTimeout(timeout);
  }, [shouldAnimate]);

  // Constellation points: 2 larger (parents), 3 smaller (kids)
  const dots = [
    { x: 30, y: 35, r: 6, type: "parent", delay: 0 },    // Parent 1
    { x: 70, y: 35, r: 6, type: "parent", delay: 0.2 },  // Parent 2
    { x: 50, y: 60, r: 4, type: "child", delay: 0.4 },   // Child 1
    { x: 35, y: 70, r: 4, type: "child", delay: 0.6 },   // Child 2
    { x: 65, y: 70, r: 4, type: "child", delay: 0.8 },   // Child 3
  ];

  const connections = [
    { from: 0, to: 1 }, // Parent to parent
    { from: 0, to: 2 }, // Parent 1 to child 1
    { from: 1, to: 2 }, // Parent 2 to child 1
    { from: 2, to: 3 }, // Child 1 to child 2
    { from: 2, to: 4 }, // Child 1 to child 3
  ];

  return (
    <>
      <ScopedStyles css={constellationStyles} />
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        role="img"
        aria-label="Atlanta Families Constellation Logo"
      >
        <defs>
          <linearGradient id="dotGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#059669" />
            <stop offset="100%" stopColor="#0891b2" />
          </linearGradient>
          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#059669" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#0891b2" stopOpacity="0.4" />
          </linearGradient>
        </defs>

        {/* Connection lines */}
        <g>
          {connections.map((conn, index) => {
            const fromDot = dots[conn.from];
            const toDot = dots[conn.to];
            const pathLength = Math.sqrt(
              Math.pow(toDot.x - fromDot.x, 2) + Math.pow(toDot.y - fromDot.y, 2)
            );

            return (
              <line
                key={index}
                x1={fromDot.x}
                y1={fromDot.y}
                x2={toDot.x}
                y2={toDot.y}
                stroke="url(#lineGradient)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeDasharray={pathLength}
                strokeDashoffset={shouldAnimate && !linesDrawn ? pathLength : 0}
                className={shouldAnimate ? `transition-all duration-1000 ease-out constellation-line-delay-${index}` : ""}
              />
            );
          })}
        </g>

        {/* Dots */}
        <g>
          {dots.map((dot, index) => (
            <circle
              key={index}
              cx={dot.x}
              cy={dot.y}
              r={dot.r}
              fill="url(#dotGradient)"
              className={shouldAnimate ? `constellation-dot constellation-dot-delay-${index}` : ""}
            >
              {shouldAnimate && (
                <animate
                  attributeName="r"
                  values={`${dot.r};${dot.r + 1};${dot.r}`}
                  dur="3s"
                  begin={`${dot.delay}s`}
                  repeatCount="indefinite"
                />
              )}
            </circle>
          ))}
        </g>
      </svg>
    </>
  );
});

export type { FamilyConstellationLogoProps };
