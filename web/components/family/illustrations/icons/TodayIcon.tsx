"use client";

/**
 * TodayIcon - Electric lightning bolt with spark energy
 * 90s cartoon electricity vibes
 */

interface TodayIconProps {
  size?: number;
  className?: string;
}

export function TodayIcon({ size = 24, className }: TodayIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-label="Happening Today"
    >
      {/* Main lightning bolt - chunky zig-zag */}
      <path
        d="M18 2L8 14H15L12 30L24 16H16L18 2Z"
        fill="#FFC107"
        stroke="#1A1A1A"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Inner highlight */}
      <path
        d="M16 6L10 14H14L12 22"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.6"
      />
      {/* Spark particles */}
      <circle cx="6" cy="8" r="1.5" fill="#FFC107" />
      <circle cx="26" cy="12" r="2" fill="#FFC107" />
      <circle cx="4" cy="18" r="1" fill="#FFC107" />
      <circle cx="28" cy="22" r="1.5" fill="#FFC107" />
      {/* Speed lines */}
      <path
        d="M3 12L6 12M26 8L29 8M2 22L5 22"
        stroke="#FFC107"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default TodayIcon;
