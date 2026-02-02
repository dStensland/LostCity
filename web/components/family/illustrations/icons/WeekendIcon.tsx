"use client";

/**
 * WeekendIcon - Exploding party popper with confetti chaos
 * Maximum celebration energy
 */

interface WeekendIconProps {
  size?: number;
  className?: string;
}

export function WeekendIcon({ size = 24, className }: WeekendIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-label="This Weekend"
    >
      {/* Party popper cone */}
      <path
        d="M6 28L12 16L18 28H6Z"
        fill="#9C27B0"
        stroke="#1A1A1A"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* Popper stripes */}
      <path
        d="M8 26L10 20M12 26L12 18M14 25L13 21"
        stroke="#E1BEE7"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Explosion burst */}
      <path
        d="M12 16L8 6M12 16L16 4M12 16L22 8M12 16L26 14"
        stroke="#FFC107"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Confetti pieces - various shapes */}
      <rect x="5" y="4" width="4" height="4" rx="0.5" fill="#FF5722" transform="rotate(15 5 4)" />
      <rect x="18" y="2" width="3" height="3" rx="0.5" fill="#4CAF50" transform="rotate(-20 18 2)" />
      <circle cx="24" cy="6" r="2" fill="#E91E63" />
      <circle cx="28" cy="12" r="1.5" fill="#2196F3" />
      <rect x="22" y="16" width="4" height="2" rx="0.5" fill="#FFC107" transform="rotate(30 22 16)" />
      {/* Streamers */}
      <path
        d="M8 8C6 6 4 7 3 5"
        stroke="#E91E63"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M20 6C22 4 24 5 26 3"
        stroke="#4CAF50"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      {/* Small stars */}
      <path
        d="M26 20L27 18L28 20L30 21L28 22L27 24L26 22L24 21Z"
        fill="#FFC107"
      />
    </svg>
  );
}

export default WeekendIcon;
