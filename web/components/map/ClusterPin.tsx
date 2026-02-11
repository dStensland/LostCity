"use client";

import { memo, useId } from "react";

interface ClusterPinProps {
  count: number;
}

// Slightly larger than MapPin to improve legibility.
const PIN_W = 40;
const PIN_H = 48;

function getClusterColor(count: number): string {
  if (count >= 80) return "#0284C7";
  if (count >= 40) return "#0891B2";
  if (count >= 16) return "#06B6D4";
  return "#0EA5E9";
}

const ClusterPin = memo(function ClusterPin({ count }: ClusterPinProps) {
  const gradientId = `cluster-dark-${useId().replace(/:/g, "")}`;
  const color = getClusterColor(count);
  const displayCount = count > 999 ? "999+" : String(count);
  const fontSize = displayCount.length > 2 ? 10 : 12.5;

  return (
    <div
      className="relative cursor-pointer group"
      style={{ width: PIN_W, height: PIN_H }}
    >
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 rounded-full pointer-events-none"
        style={{
          width: PIN_W + 14,
          height: PIN_W + 14,
          background: `radial-gradient(circle, ${color}44 0%, transparent 70%)`,
        }}
      />
      <svg
        width={PIN_W}
        height={PIN_H}
        viewBox={`0 0 ${PIN_W} ${PIN_H}`}
        fill="none"
        className="transition-transform duration-200 ease-out group-hover:scale-[1.06]"
        style={{
          filter: `drop-shadow(0 0 5px ${color}3D) drop-shadow(0 3px 8px rgba(0,0,0,0.58))`,
        }}
      >
        <defs>
          <linearGradient id={gradientId} x1="20" y1="4" x2="20" y2="47" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#232734" />
            <stop offset="64%" stopColor="#121622" />
            <stop offset="100%" stopColor="#0B0F17" />
          </linearGradient>
        </defs>

        {/* Pin body */}
        <path
          d="M20 46C20 46 6.2 31.1 6.2 17.3C6.2 9.8 12.1 3.7 20 3.7C27.9 3.7 33.8 9.8 33.8 17.3C33.8 31.1 20 46 20 46Z"
          fill={`url(#${gradientId})`}
          stroke={color}
          strokeOpacity="0.94"
          strokeWidth="2"
        />
        <path
          d="M12 10.4C14.2 8.5 16.8 7.7 20 7.7C23.1 7.7 25.8 8.5 28 10.4"
          stroke="rgba(255,255,255,0.22)"
          strokeWidth="1"
          strokeLinecap="round"
        />
        {/* Count */}
        <text
          x="20"
          y="17.7"
          textAnchor="middle"
          dominantBaseline="central"
          fill={color}
          stroke="rgba(5,8,15,0.32)"
          strokeWidth="1.15"
          paintOrder="stroke"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
          fontWeight="800"
          letterSpacing="0.2"
          fontSize={fontSize}
        >
          {displayCount}
        </text>

        <ellipse cx="20" cy="45.2" rx="3.4" ry="1.2" fill="rgba(0,0,0,0.22)" />
      </svg>
    </div>
  );
});

export default ClusterPin;
