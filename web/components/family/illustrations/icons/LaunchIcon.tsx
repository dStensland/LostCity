"use client";

/**
 * LaunchIcon - Retro toy rocket blasting off
 * Classic 90s space adventure energy
 */

interface LaunchIconProps {
  size?: number;
  className?: string;
}

export function LaunchIcon({ size = 24, className }: LaunchIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-label="Explore"
    >
      {/* Rocket body */}
      <path
        d="M16 2C16 2 10 8 10 16C10 20 12 24 16 24C20 24 22 20 22 16C22 8 16 2 16 2Z"
        fill="#FFF8E7"
        stroke="#1A1A1A"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* Rocket nose cone */}
      <path
        d="M16 2C14 6 14 8 16 8C18 8 18 6 16 2Z"
        fill="#FF5722"
        stroke="#1A1A1A"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Window */}
      <circle
        cx="16"
        cy="12"
        r="3"
        fill="#2196F3"
        stroke="#1A1A1A"
        strokeWidth="2"
      />
      {/* Window shine */}
      <path
        d="M14 11C14.5 10 15.5 9.5 17 10"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.8"
      />
      {/* Left fin */}
      <path
        d="M10 18L6 24L10 22"
        fill="#FF5722"
        stroke="#1A1A1A"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Right fin */}
      <path
        d="M22 18L26 24L22 22"
        fill="#FF5722"
        stroke="#1A1A1A"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Flame - center */}
      <path
        d="M16 24C16 24 14 28 16 30C18 28 16 24 16 24Z"
        fill="#FFC107"
        stroke="#FF5722"
        strokeWidth="1"
      />
      {/* Flame - left */}
      <path
        d="M13 24C13 24 11 27 13 28C14 27 13 24 13 24Z"
        fill="#FFC107"
        opacity="0.8"
      />
      {/* Flame - right */}
      <path
        d="M19 24C19 24 21 27 19 28C18 27 19 24 19 24Z"
        fill="#FFC107"
        opacity="0.8"
      />
      {/* Speed stars */}
      <circle cx="4" cy="10" r="1.5" fill="#FFC107" />
      <circle cx="28" cy="14" r="1" fill="#FFC107" />
      <circle cx="6" cy="20" r="1" fill="#FFC107" />
    </svg>
  );
}

export default LaunchIcon;
