"use client";

/**
 * Splat & Melty Decorative Elements
 * Inspired by fffuel's ssspill and sssplatter generators
 * Organic, gooey, playful shapes for ATLittle
 */

interface SplatProps {
  className?: string;
  color?: string;
}

/**
 * Melty drip shape - like paint dripping down
 */
export function MeltyDrip({ className, color = "#FF5722" }: SplatProps) {
  return (
    <svg
      width="60"
      height="100"
      viewBox="0 0 60 100"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M5 0C5 0 0 20 8 35C16 50 5 55 10 70C15 85 8 95 30 100C52 95 45 85 50 70C55 55 44 50 52 35C60 20 55 0 55 0H5Z"
        fill={color}
      />
      {/* Highlight blob */}
      <ellipse cx="20" cy="30" rx="8" ry="12" fill="white" opacity="0.3" />
    </svg>
  );
}

/**
 * Splatter blob - organic paint splat
 */
export function SplatBlob({ className, color = "#FFC107" }: SplatProps) {
  return (
    <svg
      width="80"
      height="80"
      viewBox="0 0 80 80"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M40 5C25 5 15 15 10 25C5 35 8 45 15 50C8 55 5 65 15 72C25 79 35 75 40 75C45 75 55 79 65 72C75 65 72 55 65 50C72 45 75 35 70 25C65 15 55 5 40 5Z"
        fill={color}
      />
      {/* Drip extensions */}
      <path
        d="M10 50C5 55 3 65 8 70"
        stroke={color}
        strokeWidth="8"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M70 45C75 52 78 60 73 68"
        stroke={color}
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
      />
      {/* Shine */}
      <ellipse cx="30" cy="30" rx="10" ry="8" fill="white" opacity="0.35" />
    </svg>
  );
}

/**
 * Gooey star - star with melty edges
 */
export function GooeyS({ className, color = "#E91E63" }: SplatProps) {
  return (
    <svg
      width="70"
      height="70"
      viewBox="0 0 70 70"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M35 5C37 15 42 18 50 15C48 25 52 30 60 35C52 40 48 45 50 55C42 52 37 55 35 65C33 55 28 52 20 55C22 45 18 40 10 35C18 30 22 25 20 15C28 18 33 15 35 5Z"
        fill={color}
      />
      {/* Drip from bottom point */}
      <path
        d="M35 65C35 65 33 72 35 78C37 72 35 65 35 65Z"
        fill={color}
      />
      {/* Shine */}
      <circle cx="28" cy="28" r="6" fill="white" opacity="0.3" />
    </svg>
  );
}

/**
 * Wobbly circle - imperfect organic circle
 */
export function WobblyCircle({ className, color = "#4CAF50" }: SplatProps) {
  return (
    <svg
      width="60"
      height="60"
      viewBox="0 0 60 60"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M30 5C40 3 50 10 55 20C58 30 55 42 48 50C40 58 25 60 15 52C5 44 3 30 8 18C13 8 22 5 30 5Z"
        fill={color}
      />
      <ellipse cx="22" cy="22" rx="8" ry="6" fill="white" opacity="0.3" />
    </svg>
  );
}

/**
 * Squiggle line - hand-drawn wavy line
 */
export function Squiggle({ className, color = "#9C27B0" }: SplatProps) {
  return (
    <svg
      width="120"
      height="30"
      viewBox="0 0 120 30"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M5 15C15 5 25 25 35 15C45 5 55 25 65 15C75 5 85 25 95 15C105 5 115 20 115 15"
        stroke={color}
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

/**
 * Confetti burst - scattered celebration shapes
 */
export function ConfettiBurst({ className }: { className?: string }) {
  return (
    <svg
      width="100"
      height="100"
      viewBox="0 0 100 100"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {/* Scattered shapes */}
      <rect x="10" y="20" width="8" height="8" rx="1" fill="#FF5722" transform="rotate(15 14 24)" />
      <rect x="80" y="15" width="6" height="12" rx="1" fill="#FFC107" transform="rotate(-20 83 21)" />
      <circle cx="50" cy="10" r="5" fill="#E91E63" />
      <rect x="25" y="70" width="10" height="5" rx="1" fill="#4CAF50" transform="rotate(30 30 72)" />
      <circle cx="75" cy="65" r="4" fill="#2196F3" />
      <rect x="60" y="40" width="6" height="6" rx="1" fill="#9C27B0" transform="rotate(-10 63 43)" />
      <circle cx="20" cy="45" r="3" fill="#FFC107" />
      <rect x="85" y="50" width="8" height="4" rx="1" fill="#FF5722" transform="rotate(25 89 52)" />
      <circle cx="40" cy="85" r="4" fill="#E91E63" />
      <rect x="5" y="80" width="5" height="10" rx="1" fill="#2196F3" transform="rotate(-15 7 85)" />
    </svg>
  );
}

/**
 * Drippy underline - melting line decoration
 */
export function DrippyUnderline({ className, color = "#FF5722" }: SplatProps) {
  return (
    <svg
      width="150"
      height="40"
      viewBox="0 0 150 40"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {/* Main wavy line */}
      <path
        d="M5 8C25 5 45 10 65 8C85 6 105 12 125 8C135 6 145 8 145 8"
        stroke={color}
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
      />
      {/* Drips */}
      <path d="M30 11C30 11 28 20 30 28C32 20 30 11 30 11Z" fill={color} />
      <path d="M70 10C70 10 68 22 70 35C72 22 70 10 70 10Z" fill={color} />
      <path d="M110 12C110 12 108 18 110 24C112 18 110 12 110 12Z" fill={color} />
    </svg>
  );
}

/**
 * Scribble cloud - messy hand-drawn cloud shape
 */
export function ScribbleCloud({ className, color = "#FFC107" }: SplatProps) {
  return (
    <svg
      width="90"
      height="60"
      viewBox="0 0 90 60"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M20 45C10 45 5 38 8 30C5 25 8 15 18 15C20 8 30 5 40 8C48 3 60 5 65 12C75 10 85 18 82 28C88 35 85 48 72 48C65 55 50 55 45 50C35 55 25 52 20 45Z"
        fill={color}
        opacity="0.9"
      />
      <ellipse cx="35" cy="25" rx="12" ry="8" fill="white" opacity="0.3" />
    </svg>
  );
}

export const SplatElements = {
  MeltyDrip,
  SplatBlob,
  GooeyS,
  WobblyCircle,
  Squiggle,
  ConfettiBurst,
  DrippyUnderline,
  ScribbleCloud,
};

export default SplatElements;
