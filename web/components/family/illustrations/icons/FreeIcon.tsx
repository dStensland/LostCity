"use client";

/**
 * FreeIcon - Vintage price tag with hand-lettered FREE
 * Retro sale tag energy
 */

interface FreeIconProps {
  size?: number;
  className?: string;
}

export function FreeIcon({ size = 24, className }: FreeIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-label="Free for Families"
    >
      {/* Tag shape with notch */}
      <path
        d="M6 8L16 4L26 8L26 26C26 27 25 28 24 28H8C7 28 6 27 6 26V8Z"
        fill="#4CAF50"
        stroke="#1A1A1A"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* String hole */}
      <circle cx="16" cy="8" r="2.5" fill="#FFF8E7" stroke="#1A1A1A" strokeWidth="2" />
      {/* String */}
      <path
        d="M16 5.5C16 3 18 1 20 2"
        stroke="#1A1A1A"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* FREE text - hand-drawn style */}
      <text
        x="16"
        y="20"
        textAnchor="middle"
        fill="white"
        fontFamily="system-ui"
        fontWeight="900"
        fontSize="8"
        className="tracking-[-0.5px]"
      >
        FREE
      </text>
      {/* Exclamation burst */}
      <circle cx="25" cy="14" r="1.5" fill="#FFC107" />
      <circle cx="7" cy="16" r="1" fill="#FFC107" />
      {/* Starburst behind */}
      <path
        d="M3 20L5 18M28 24L30 22M4 26L6 25"
        stroke="#4CAF50"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default FreeIcon;
