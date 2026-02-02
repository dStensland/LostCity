"use client";

/**
 * SearchIcon - Retro magnifying glass with Nickelodeon energy
 * Chunky, hand-drawn feel with slight wobble
 */

interface SearchIconProps {
  size?: number;
  className?: string;
}

export function SearchIcon({ size = 24, className }: SearchIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-label="Search"
    >
      {/* Glass lens - slightly wonky circle */}
      <circle
        cx="13"
        cy="13"
        r="9"
        fill="#FFF8E7"
        stroke="#1A1A1A"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {/* Lens shine - curved highlight */}
      <path
        d="M8 10C9 7 11 5.5 14 6"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Handle outline - renders behind (must come first in SVG) */}
      <path
        d="M20 20L28 28"
        stroke="#1A1A1A"
        strokeWidth="7"
        strokeLinecap="round"
      />
      {/* Handle - chunky with slight angle */}
      <path
        d="M20 20L28 28"
        stroke="#FF5722"
        strokeWidth="5"
        strokeLinecap="round"
      />
      {/* Handle grip lines */}
      <path
        d="M22 24L23.5 22.5M25 27L26.5 25.5"
        stroke="#1A1A1A"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default SearchIcon;
