"use client";

/**
 * VenueIcon - Chunky map pin with personality
 * Bold, friendly location marker
 */

interface VenueIconProps {
  size?: number;
  color?: string;
  className?: string;
}

export function VenueIcon({
  size = 16,
  color = "#FF5722",
  className
}: VenueIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      className={className}
      aria-label="Location"
    >
      {/* Pin body - teardrop shape */}
      <path
        d="M8 1C4.5 1 2 3.5 2 6.5C2 10.5 8 15 8 15C8 15 14 10.5 14 6.5C14 3.5 11.5 1 8 1Z"
        fill={color}
        stroke="#1A1A1A"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Inner circle */}
      <circle
        cx="8"
        cy="6"
        r="2.5"
        fill="#FFF8E7"
        stroke="#1A1A1A"
        strokeWidth="1"
      />
      {/* Highlight */}
      <path
        d="M5 4C5.5 3 6.5 2.5 8 2.5"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.7"
      />
    </svg>
  );
}

export default VenueIcon;
