"use client";

import { memo } from "react";

interface FamilyCompassLogoProps {
  size?: number;
  animated?: boolean;
  className?: string;
}

export const FamilyCompassLogo = memo(function FamilyCompassLogo({
  size = 64,
  animated = true,
  className = "",
}: FamilyCompassLogoProps) {
  const shouldAnimate = animated && typeof window !== "undefined" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Atlanta Families Compass Logo"
    >
      {/* Outer compass ring with 8 divisions */}
      <g className={`${shouldAnimate ? "animate-[spin_20s_linear_infinite]" : ""} compass-origin`}>
        <circle
          cx="50"
          cy="50"
          r="45"
          stroke="#059669"
          strokeWidth="2"
          fill="none"
          opacity="0.3"
        />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
          <line
            key={angle}
            x1="50"
            y1="50"
            x2={50 + 45 * Math.cos((angle - 90) * Math.PI / 180)}
            y2={50 + 45 * Math.sin((angle - 90) * Math.PI / 180)}
            stroke="#059669"
            strokeWidth="1"
            opacity="0.2"
          />
        ))}
      </g>

      {/* Inner "A" shape that doubles as tent/house/roof */}
      <g>
        {/* Left side of A */}
        <path
          d="M 35 65 L 50 25 L 50 65 Z"
          fill="#059669"
          opacity="0.9"
        />
        {/* Right side of A */}
        <path
          d="M 50 25 L 65 65 L 50 65 Z"
          fill="#059669"
          opacity="0.9"
        />
        {/* Crossbar of A */}
        <rect
          x="40"
          y="47"
          width="20"
          height="4"
          fill="#059669"
        />
      </g>

      {/* Cardinal points with pulsing dots */}
      {[
        { x: 50, y: 5, delayClass: "pulse-delay-0" },    // North
        { x: 95, y: 50, delayClass: "pulse-delay-75" }, // East
        { x: 50, y: 95, delayClass: "pulse-delay-150" },  // South
        { x: 5, y: 50, delayClass: "pulse-delay-225" },  // West
      ].map((point, index) => (
        <circle
          key={index}
          cx={point.x}
          cy={point.y}
          r="4"
          fill="#f59e0b"
          className={shouldAnimate ? `animate-[pulse_3s_ease-in-out_infinite] ${point.delayClass}` : ""}
        />
      ))}
    </svg>
  );
});

export type { FamilyCompassLogoProps };
