"use client";

import { memo, useEffect, useState } from "react";

interface FamilyConstellationLogoProps {
  size?: number;
  animated?: boolean;
  className?: string;
}

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
              className={shouldAnimate ? "transition-all duration-1000 ease-out" : ""}
              style={shouldAnimate ? {
                transitionDelay: `${index * 150}ms`,
              } : undefined}
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
            className={shouldAnimate ? "animate-[pulse_3s_ease-in-out_infinite]" : ""}
            style={shouldAnimate ? {
              animationDelay: `${dot.delay}s`,
            } : undefined}
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
  );
});

export type { FamilyConstellationLogoProps };
