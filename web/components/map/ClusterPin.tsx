"use client";

import { memo } from "react";

interface ClusterPinProps {
  count: number;
}

// Pin dimensions — slightly larger than MapPin for clusters
const PIN_W = 38;
const PIN_H = 46;

// Color tiers by cluster count — same coral → magenta → purple gradient
function getClusterColor(count: number): string {
  if (count >= 30) return "#C026D3"; // vivid purple
  if (count >= 10) return "#D946A8"; // magenta-pink
  return "#E8556A"; // warm coral
}

const ClusterPin = memo(function ClusterPin({ count }: ClusterPinProps) {
  const color = getClusterColor(count);
  const displayCount = count > 999 ? "999+" : String(count);
  const fontSize = displayCount.length > 2 ? 10 : 12;

  return (
    <div
      className="relative cursor-pointer"
      style={{ width: PIN_W, height: PIN_H }}
    >
      <svg
        width={PIN_W}
        height={PIN_H}
        viewBox={`0 0 ${PIN_W} ${PIN_H}`}
        fill="none"
        className="transition-transform duration-200 hover:scale-110"
        style={{
          filter: `drop-shadow(0 2px 5px rgba(0,0,0,0.6)) drop-shadow(0 0 4px ${color}66)`,
        }}
      >
        {/* Pin body — same path formula as MapPin */}
        <path
          d={`M${PIN_W / 2} ${PIN_H}L${PIN_W * 0.18} ${PIN_H * 0.58}A${PIN_W * 0.41} ${PIN_W * 0.41} 0 1 1 ${PIN_W * 0.82} ${PIN_H * 0.58}Z`}
          fill={color}
          stroke="white"
          strokeWidth="2.5"
        />

        {/* Dark inner disc for contrast */}
        <circle
          cx={PIN_W / 2}
          cy={PIN_H * 0.36}
          r={PIN_W * 0.26}
          fill="rgba(0,0,0,0.25)"
        />

        {/* Cluster count number */}
        <text
          x={PIN_W / 2}
          y={PIN_H * 0.36 + 1}
          textAnchor="middle"
          dominantBaseline="central"
          fill="white"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontWeight="700"
          fontSize={fontSize}
        >
          {displayCount}
        </text>
      </svg>
    </div>
  );
});

export default ClusterPin;
