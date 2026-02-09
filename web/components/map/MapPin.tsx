"use client";

import { memo } from "react";
import { getMapPinColor } from "@/lib/category-config";
import { ICON_PATHS, DEFAULT_ICON_PATH } from "./icon-paths";

interface MapPinProps {
  category: string | null;
  isLive?: boolean;
  isSelected?: boolean;
  isHovered?: boolean;
}

const PIN_W = 34;
const PIN_H = 42;

const MapPin = memo(function MapPin({ category, isLive, isSelected, isHovered }: MapPinProps) {
  const normalizedType = category?.toLowerCase().replace(/-/g, "_") || null;
  const iconPath =
    normalizedType && ICON_PATHS[normalizedType]
      ? ICON_PATHS[normalizedType]
      : DEFAULT_ICON_PATH;
  const color = normalizedType ? getMapPinColor(normalizedType) : "#F87171";

  const scale = isSelected ? "scale-[1.4]" : isHovered ? "scale-110" : "";

  return (
    <div
      className="relative cursor-pointer group"
      style={
        {
          width: PIN_W,
          height: PIN_H,
          "--pin-color": color,
        } as React.CSSProperties
      }
    >
      {/* Pin shape — SVG for pixel-perfect rendering */}
      <svg
        width={PIN_W}
        height={PIN_H}
        viewBox={`0 0 ${PIN_W} ${PIN_H}`}
        fill="none"
        className={`transition-transform duration-200 motion-reduce:transition-none group-hover:scale-110 ${scale}`}
        style={{
          filter: isLive
            ? `drop-shadow(0 0 12px ${color}) drop-shadow(0 0 4px ${color}AA) drop-shadow(0 2px 4px rgba(0,0,0,0.6))`
            : isSelected
              ? `drop-shadow(0 0 8px ${color}AA) drop-shadow(0 2px 6px rgba(0,0,0,0.6))`
              : isHovered
                ? `drop-shadow(0 0 6px ${color}88) drop-shadow(0 2px 4px rgba(0,0,0,0.5))`
                : `drop-shadow(0 2px 5px rgba(0,0,0,0.6)) drop-shadow(0 0 3px ${color}55)`,
          ...(isLive ? { animation: "mapPinPulse 1.2s ease-in-out infinite" } : {}),
        }}
      >
        {/* Pin body — rounded top, pointed bottom */}
        <path
          d={`M${PIN_W / 2} ${PIN_H}L${PIN_W * 0.18} ${PIN_H * 0.58}A${PIN_W * 0.41} ${PIN_W * 0.41} 0 1 1 ${PIN_W * 0.82} ${PIN_H * 0.58}Z`}
          fill={color}
          stroke="white"
          strokeWidth="2.5"
        />

        {/* Dark inner disc — provides contrast behind icon */}
        <circle
          cx={PIN_W / 2}
          cy={PIN_H * 0.36}
          r={PIN_W * 0.26}
          fill="rgba(0,0,0,0.25)"
        />

        {/* Category icon — white on dark disc */}
        <g transform={`translate(${PIN_W / 2 - 10}, ${PIN_H * 0.36 - 10})`}>
          <svg viewBox="0 0 256 256" width="20" height="20">
            <path d={iconPath} fill="white" />
          </svg>
        </g>
      </svg>

      {/* Selected / hovered ring glow */}
      {(isSelected || isHovered) && (
        <div
          className="absolute top-[2px] left-1/2 -translate-x-1/2 rounded-full pointer-events-none motion-reduce:hidden"
          style={{
            width: PIN_W + 8,
            height: PIN_W + 8,
            background: `radial-gradient(circle, ${color}${isSelected ? "50" : "30"} 0%, transparent 70%)`,
          }}
        />
      )}

      {/* LIVE badge */}
      {isLive && (
        <div className="absolute -top-1 -right-1 motion-reduce:animate-none" aria-label="Live now">
          <span className="flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75 animate-ping motion-reduce:animate-none" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border border-white" />
          </span>
        </div>
      )}
    </div>
  );
});

export default MapPin;
