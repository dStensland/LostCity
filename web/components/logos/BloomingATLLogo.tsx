"use client";

import { memo, useState } from "react";

interface BloomingATLLogoProps {
  size?: number;
  animated?: boolean;
  className?: string;
}

export const BloomingATLLogo = memo(function BloomingATLLogo({
  size = 64,
  animated = true,
  className = "",
}: BloomingATLLogoProps) {
  const [isHovered, setIsHovered] = useState(false);
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
      aria-label="Atlanta Families Blooming ATL Logo"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <defs>
        <linearGradient id="leafGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#059669" />
          <stop offset="100%" stopColor="#0891b2" />
        </linearGradient>
        <linearGradient id="branchGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#eab308" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
      </defs>

      {/* "A" formed by 3 leaf/petal shapes meeting at a point */}
      <g>
        {/* Left leaf */}
        <ellipse
          cx="30"
          cy="55"
          rx="12"
          ry="25"
          fill="url(#leafGradient)"
          transform="rotate(-25 30 55)"
          className={shouldAnimate ? "animate-[sway_3s_ease-in-out_infinite]" : ""}
          style={shouldAnimate ? {
            transformOrigin: "50px 30px",
            animation: "sway 3s ease-in-out infinite",
          } : undefined}
        />

        {/* Right leaf */}
        <ellipse
          cx="70"
          cy="55"
          rx="12"
          ry="25"
          fill="url(#leafGradient)"
          transform="rotate(25 70 55)"
          className={shouldAnimate ? "animate-[sway_3s_ease-in-out_infinite]" : ""}
          style={shouldAnimate ? {
            transformOrigin: "50px 30px",
            animation: "sway 3s ease-in-out infinite 0.3s",
          } : undefined}
        />

        {/* Center leaf (forms the point of A) */}
        <ellipse
          cx="50"
          cy="35"
          rx="12"
          ry="28"
          fill="url(#leafGradient)"
          className={shouldAnimate ? "animate-[sway_3s_ease-in-out_infinite]" : ""}
          style={shouldAnimate ? {
            transformOrigin: "50px 30px",
            animation: "sway 3s ease-in-out infinite 0.15s",
          } : undefined}
        />

        {/* Crossbar of A (becomes curved branch) */}
        <path
          d="M 35 55 Q 45 52 55 55 Q 65 58 75 55"
          stroke="url(#branchGradient)"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />

        {/* Buds on branch */}
        {[
          { x: 45, y: 52 },
          { x: 55, y: 55 },
          { x: 65, y: 56 },
        ].map((bud, index) => (
          <circle
            key={index}
            cx={bud.x}
            cy={bud.y}
            r={shouldAnimate && isHovered ? 4 : 2.5}
            fill="#f59e0b"
            className={shouldAnimate && isHovered ? "transition-all duration-500" : ""}
            style={shouldAnimate && isHovered ? {
              transitionDelay: `${index * 150}ms`,
            } : undefined}
          />
        ))}
      </g>

      <style jsx>{`
        @keyframes sway {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(2deg); }
        }
      `}</style>
    </svg>
  );
});

export type { BloomingATLLogoProps };
