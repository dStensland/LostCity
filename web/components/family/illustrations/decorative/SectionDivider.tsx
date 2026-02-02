"use client";

/**
 * SectionDivider - Decorative break between content sections
 * Adventure trail with stars and sparkle energy
 */

interface SectionDividerProps {
  className?: string;
}

export function SectionDivider({ className }: SectionDividerProps) {
  return (
    <svg
      width="200"
      height="32"
      viewBox="0 0 200 32"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {/* Left trail dots */}
      <circle cx="20" cy="16" r="3" fill="#FFC107" opacity="0.4" />
      <circle cx="35" cy="16" r="3" fill="#FFC107" opacity="0.5" />
      <circle cx="50" cy="16" r="4" fill="#FFC107" opacity="0.6" />
      <circle cx="68" cy="16" r="4" fill="#FFC107" opacity="0.8" />

      {/* Center star */}
      <path
        d="M100 4L104 12L113 13L107 19L108 28L100 24L92 28L93 19L87 13L96 12Z"
        fill="#FF5722"
        stroke="#1A1A1A"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Star highlight */}
      <path
        d="M100 8L102 13L107 14"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.5"
      />

      {/* Right trail dots */}
      <circle cx="132" cy="16" r="4" fill="#FFC107" opacity="0.8" />
      <circle cx="150" cy="16" r="4" fill="#FFC107" opacity="0.6" />
      <circle cx="165" cy="16" r="3" fill="#FFC107" opacity="0.5" />
      <circle cx="180" cy="16" r="3" fill="#FFC107" opacity="0.4" />

      {/* Tiny sparkle accents */}
      <circle cx="85" cy="8" r="2" fill="#FFC107" />
      <circle cx="115" cy="8" r="2" fill="#FFC107" />
      <circle cx="85" cy="24" r="1.5" fill="#E91E63" />
      <circle cx="115" cy="24" r="1.5" fill="#E91E63" />
    </svg>
  );
}

export default SectionDivider;
