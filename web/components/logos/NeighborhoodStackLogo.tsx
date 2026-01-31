"use client";

import { memo, useEffect, useState } from "react";

interface NeighborhoodStackLogoProps {
  size?: number;
  animated?: boolean;
  className?: string;
}

export const NeighborhoodStackLogo = memo(function NeighborhoodStackLogo({
  size = 64,
  animated = true,
  className = "",
}: NeighborhoodStackLogoProps) {
  const [stackState, setStackState] = useState(0);
  const shouldAnimate = animated && typeof window !== "undefined" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (!shouldAnimate) return;

    const interval = setInterval(() => {
      setStackState((prev) => (prev + 1) % 3);
    }, 3000);

    return () => clearInterval(interval);
  }, [shouldAnimate]);

  const blocks = [
    { color: "#059669", baseX: 15, baseY: 20 }, // Green
    { color: "#0891b2", baseX: 25, baseY: 35 }, // Blue
    { color: "#f59e0b", baseX: 20, baseY: 50 }, // Amber
    { color: "#f97316", baseX: 30, baseY: 65 }, // Coral
  ];

  const getBlockPosition = (index: number) => {
    if (!shouldAnimate) {
      return { x: blocks[index].baseX, y: blocks[index].baseY };
    }

    const offsets = [
      // State 0: Original
      [
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: 0 },
      ],
      // State 1: Shifted
      [
        { x: 10, y: 0 },
        { x: -5, y: 0 },
        { x: 15, y: 0 },
        { x: 0, y: 0 },
      ],
      // State 2: Return
      [
        { x: 5, y: 0 },
        { x: 10, y: 0 },
        { x: -5, y: 0 },
        { x: 10, y: 0 },
      ],
    ];

    return {
      x: blocks[index].baseX + offsets[stackState][index].x,
      y: blocks[index].baseY + offsets[stackState][index].y,
    };
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Atlanta Families Neighborhood Stack Logo"
    >
      {blocks.map((block, index) => {
        const pos = getBlockPosition(index);
        return (
          <rect
            key={index}
            x={pos.x}
            y={pos.y}
            width="50"
            height="14"
            rx="7"
            fill={block.color}
            opacity="0.9"
            className={shouldAnimate ? "transition-all duration-1000 ease-in-out" : ""}
          />
        );
      })}
    </svg>
  );
});

export type { NeighborhoodStackLogoProps };
