"use client";

import { memo, useId } from "react";
import CategoryIcon from "@/components/CategoryIcon";
import { getCategoryColor, normalizeCategoryType } from "@/lib/category-config";

interface MapPinProps {
  category: string | null;
  isLive?: boolean;
  isSelected?: boolean;
  isHovered?: boolean;
}

const PIN_W = 36;
const PIN_H = 44;

const MapPin = memo(function MapPin({ category, isLive, isSelected, isHovered }: MapPinProps) {
  const gradientId = `pin-dark-${useId().replace(/:/g, "")}`;
  const normalizedType = normalizeCategoryType(category);
  const iconType = normalizedType === "markets" ? "farmers_market" : normalizedType;
  const color = getCategoryColor(normalizedType);
  const scale = isSelected ? "scale-[1.18]" : isHovered ? "scale-[1.07]" : "";

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
      {/* Pin shape */}
      <svg
        width={PIN_W}
        height={PIN_H}
        viewBox={`0 0 ${PIN_W} ${PIN_H}`}
        fill="none"
        className={`transition-transform duration-200 ease-out motion-reduce:transition-none group-hover:scale-[1.05] ${scale}`}
        style={{
          filter: isLive
            ? `drop-shadow(0 0 8px ${color}7A) drop-shadow(0 3px 8px rgba(0,0,0,0.58))`
            : isSelected
              ? `drop-shadow(0 0 6px ${color}66) drop-shadow(0 3px 8px rgba(0,0,0,0.56))`
              : isHovered
                ? `drop-shadow(0 0 4px ${color}4D) drop-shadow(0 3px 7px rgba(0,0,0,0.52))`
                : `drop-shadow(0 3px 7px rgba(0,0,0,0.56))`,
          ...(isLive ? { animation: "mapPinPulse 1.2s ease-in-out infinite" } : {}),
        }}
      >
        <defs>
          <linearGradient id={gradientId} x1="18" y1="4" x2="18" y2="42" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#232734" />
            <stop offset="64%" stopColor="#121622" />
            <stop offset="100%" stopColor="#0B0F17" />
          </linearGradient>
        </defs>

        {/* Body + tip */}
        <path
          d="M18 42C18 42 6.2 29.2 6.2 16.9C6.2 9.9 11.55 4.4 18 4.4C24.45 4.4 29.8 9.9 29.8 16.9C29.8 29.2 18 42 18 42Z"
          fill={`url(#${gradientId})`}
          stroke={color}
          strokeOpacity="0.94"
          strokeWidth="2"
        />
        <path
          d="M10.2 10.3C12.4 8.4 15 7.5 18 7.5C21 7.5 23.6 8.4 25.8 10.3"
          stroke="rgba(255,255,255,0.22)"
          strokeWidth="1"
          strokeLinecap="round"
        />
        {/* Base shadow at tip */}
        <ellipse cx="18" cy="41.4" rx="3.2" ry="1.2" fill="rgba(0,0,0,0.22)" />
      </svg>

      {/* Shared category icon set for consistency with the rest of the app */}
      <div
        className="absolute left-1/2 top-[8.2px] -translate-x-1/2 pointer-events-none"
        style={{ color }}
      >
        <CategoryIcon
          type={iconType}
          size={14.5}
          glow="none"
          weight="light"
          className="drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]"
        />
      </div>

      {/* Selection halo */}
      {(isSelected || isHovered) && (
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 rounded-full pointer-events-none motion-reduce:hidden"
          style={{
            width: PIN_W + (isSelected ? 18 : 12),
            height: PIN_W + (isSelected ? 18 : 12),
            background: `radial-gradient(circle, ${color}${isSelected ? "42" : "28"} 0%, transparent 72%)`,
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
