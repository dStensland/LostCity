"use client";

/**
 * Hero Decorative Elements
 * Floating illustrated elements for the ATLittle hero section
 * 90s Nickelodeon vibes - bold, playful, slightly chaotic
 */

interface DecorProps {
  className?: string;
}

/**
 * Balloon cluster - bouncy party balloons with strings
 */
export function BalloonCluster({ className }: DecorProps) {
  return (
    <svg
      width="80"
      height="100"
      viewBox="0 0 80 100"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {/* Strings */}
      <path
        d="M30 55C28 65 32 80 30 95"
        stroke="#1A1A1A"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M45 50C48 62 44 78 48 95"
        stroke="#1A1A1A"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M58 58C60 70 56 82 60 95"
        stroke="#1A1A1A"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />

      {/* Orange balloon */}
      <ellipse
        cx="30"
        cy="30"
        rx="22"
        ry="26"
        fill="#FF5722"
        stroke="#1A1A1A"
        strokeWidth="3"
      />
      <path
        d="M30 54L28 58L32 58Z"
        fill="#FF5722"
        stroke="#1A1A1A"
        strokeWidth="2"
      />
      <path
        d="M18 20C22 14 28 12 36 16"
        stroke="white"
        strokeWidth="4"
        strokeLinecap="round"
        opacity="0.5"
      />

      {/* Yellow balloon */}
      <ellipse
        cx="48"
        cy="25"
        rx="20"
        ry="24"
        fill="#FFC107"
        stroke="#1A1A1A"
        strokeWidth="3"
      />
      <path
        d="M48 48L46 52L50 52Z"
        fill="#FFC107"
        stroke="#1A1A1A"
        strokeWidth="2"
      />
      <path
        d="M38 16C42 10 48 9 54 12"
        stroke="white"
        strokeWidth="4"
        strokeLinecap="round"
        opacity="0.5"
      />

      {/* Pink balloon */}
      <ellipse
        cx="60"
        cy="35"
        rx="18"
        ry="22"
        fill="#E91E63"
        stroke="#1A1A1A"
        strokeWidth="3"
      />
      <path
        d="M60 56L58 60L62 60Z"
        fill="#E91E63"
        stroke="#1A1A1A"
        strokeWidth="2"
      />
      <path
        d="M50 26C54 21 60 20 66 24"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.5"
      />

      {/* Tiny star sparkles */}
      <circle cx="10" cy="15" r="3" fill="#FFC107" />
      <circle cx="72" cy="50" r="2" fill="#FFC107" />
    </svg>
  );
}

/**
 * Starburst - geometric star with motion lines
 */
export function Starburst({ className }: DecorProps) {
  return (
    <svg
      width="60"
      height="60"
      viewBox="0 0 60 60"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {/* Main star */}
      <path
        d="M30 5L34 22L50 18L38 30L50 42L34 38L30 55L26 38L10 42L22 30L10 18L26 22Z"
        fill="#FFC107"
        stroke="#1A1A1A"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      {/* Inner highlight */}
      <path
        d="M30 15L32 25L40 23L34 30"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.6"
      />
      {/* Motion lines */}
      <path
        d="M2 20L8 22M2 40L8 38M52 20L58 18M52 40L58 42"
        stroke="#FFC107"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Tiny sparkles */}
      <circle cx="5" cy="30" r="2" fill="#FF5722" />
      <circle cx="55" cy="30" r="2" fill="#FF5722" />
    </svg>
  );
}

/**
 * Circus Tent - mini big top with flag
 */
export function CircusTent({ className }: DecorProps) {
  return (
    <svg
      width="70"
      height="80"
      viewBox="0 0 70 80"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {/* Tent body - striped */}
      <path
        d="M10 70L35 20L60 70H10Z"
        fill="#FF5722"
        stroke="#1A1A1A"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      {/* Cream stripes */}
      <path
        d="M18 70L30 35M30 70L35 30M42 70L40 35M54 70L50 40"
        stroke="#FFF8E7"
        strokeWidth="5"
        strokeLinecap="round"
      />
      {/* Tent peak/top */}
      <circle
        cx="35"
        cy="18"
        r="6"
        fill="#FFC107"
        stroke="#1A1A1A"
        strokeWidth="2.5"
      />
      {/* Flag pole */}
      <path
        d="M35 12V2"
        stroke="#1A1A1A"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Flag */}
      <path
        d="M35 2L48 7L35 12"
        fill="#E91E63"
        stroke="#1A1A1A"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Entrance */}
      <path
        d="M28 70C28 60 30 55 35 55C40 55 42 60 42 70"
        fill="#1A1A1A"
        stroke="#1A1A1A"
        strokeWidth="2"
      />
      {/* Bunting decorations */}
      <path
        d="M15 50L20 55L25 50L30 55L35 50L40 55L45 50L50 55L55 50"
        stroke="#FFC107"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

/**
 * Combined export for easy importing
 */
export const HeroDecor = {
  BalloonCluster,
  Starburst,
  CircusTent,
};

export default HeroDecor;
