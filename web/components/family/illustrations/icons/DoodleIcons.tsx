"use client";

/**
 * Doodle-Style Icons for ATLittle
 * Hand-drawn, sketchy, imperfect - like a kid drew them
 * Inspired by fffuel dddoodle aesthetic
 */

interface IconProps {
  size?: number;
  className?: string;
  color?: string;
}

/**
 * Sketchy magnifying glass - wobbly search icon
 */
export function DoodleSearch({ size = 24, className, color = "#1A1A1A" }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-label="Search"
    >
      {/* Wobbly circle */}
      <path
        d="M14 6C18 5 23 8 24 14C25 20 21 25 15 26C9 27 5 22 5 15C5 9 9 6 14 6Z"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      {/* Handle - slightly curved */}
      <path
        d="M22 22C24 24 27 28 28 29"
        stroke={color}
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      {/* Little shine scribble */}
      <path
        d="M10 11C11 10 13 10 14 11"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.4"
      />
    </svg>
  );
}

/**
 * Scribble lightning bolt - energetic today icon
 */
export function DoodleBolt({ size = 24, className, color = "#FFC107" }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-label="Today"
    >
      <path
        d="M18 3L17 5L8 16H15L13 29L14 27L24 14H16L18 3Z"
        fill={color}
        stroke="#1A1A1A"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Spark lines */}
      <path d="M5 10L8 12" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <path d="M25 18L28 20" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <circle cx="6" cy="20" r="2" fill={color} />
    </svg>
  );
}

/**
 * Messy confetti/party icon - weekend vibes
 */
export function DoodleParty({ size = 24, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-label="Weekend"
    >
      {/* Party popper cone */}
      <path
        d="M6 26L14 6L22 26H6Z"
        fill="#E91E63"
        stroke="#1A1A1A"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Stripes on cone */}
      <path d="M9 20L11 12" stroke="#FFF" strokeWidth="2" opacity="0.5" />
      <path d="M14 22L14 10" stroke="#FFF" strokeWidth="2" opacity="0.5" />

      {/* Confetti bursting out */}
      <circle cx="18" cy="8" r="2.5" fill="#FFC107" />
      <rect x="22" y="5" width="4" height="4" rx="0.5" fill="#4CAF50" transform="rotate(20 24 7)" />
      <circle cx="26" cy="12" r="2" fill="#2196F3" />
      <rect x="20" y="14" width="3" height="5" rx="0.5" fill="#FF5722" transform="rotate(-15 21 16)" />
      <circle cx="8" cy="5" r="1.5" fill="#9C27B0" />
      <rect x="3" y="10" width="3" height="3" rx="0.5" fill="#FFC107" transform="rotate(30 4 11)" />
    </svg>
  );
}

/**
 * Hand-drawn price tag - free icon
 */
export function DoodleTag({ size = 24, className, color = "#4CAF50" }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-label="Free"
    >
      {/* Tag shape - wobbly */}
      <path
        d="M5 5L17 4L28 15L16 28L4 16L5 5Z"
        fill={color}
        stroke="#1A1A1A"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* Hole */}
      <circle cx="10" cy="10" r="3" fill="white" stroke="#1A1A1A" strokeWidth="2" />
      {/* FREE text scribbled */}
      <path
        d="M12 17L14 17M12 17L12 22M12 19L14 19"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M16 17L16 22M16 17L18 17"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Sketchy map pin - venue location
 */
export function DoodlePin({ size = 24, className, color = "#FF5722" }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-label="Location"
    >
      {/* Pin body - wobbly teardrop */}
      <path
        d="M16 3C10 3 5 8 5 14C5 22 16 30 16 30C16 30 27 22 27 14C27 8 22 3 16 3Z"
        fill={color}
        stroke="#1A1A1A"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* Inner circle */}
      <circle cx="16" cy="13" r="5" fill="white" stroke="#1A1A1A" strokeWidth="2" />
      {/* Shine */}
      <path
        d="M10 10C12 7 14 6 17 7"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.5"
      />
    </svg>
  );
}

/**
 * Scribble rocket - explore/launch icon
 */
export function DoodleRocket({ size = 24, className }: IconProps) {
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
        d="M16 2C16 2 10 8 10 16C10 22 13 26 16 26C19 26 22 22 22 16C22 8 16 2 16 2Z"
        fill="#FFF8E7"
        stroke="#1A1A1A"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* Nose cone */}
      <path
        d="M16 2C14 5 14 8 16 8C18 8 18 5 16 2Z"
        fill="#FF5722"
        stroke="#1A1A1A"
        strokeWidth="2"
      />
      {/* Window */}
      <circle cx="16" cy="13" r="3" fill="#2196F3" stroke="#1A1A1A" strokeWidth="1.5" />
      {/* Fins */}
      <path d="M10 20L6 26L10 24" fill="#FF5722" stroke="#1A1A1A" strokeWidth="2" strokeLinejoin="round" />
      <path d="M22 20L26 26L22 24" fill="#FF5722" stroke="#1A1A1A" strokeWidth="2" strokeLinejoin="round" />
      {/* Flame squiggles */}
      <path d="M14 26C14 28 15 30 16 30C17 30 18 28 18 26" stroke="#FFC107" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M12 26C12 27 13 29 13 29" stroke="#FFC107" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
      <path d="M20 26C20 27 19 29 19 29" stroke="#FFC107" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

/**
 * Scribble ticket stub
 */
export function DoodleTicket({ size = 64, className, color = "#FF5722" }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {/* Ticket body - hand drawn rectangle */}
      <path
        d="M8 18C8 16 10 15 12 15L52 16C54 16 56 18 56 20L55 44C55 46 53 48 51 48L11 47C9 47 8 45 8 43L8 18Z"
        fill="white"
        stroke="#1A1A1A"
        strokeWidth="3"
      />
      {/* Perforated line - dots */}
      <path
        d="M20 15L20 48"
        stroke="#1A1A1A"
        strokeWidth="2"
        strokeDasharray="4 4"
      />
      {/* Star decoration */}
      <path
        d="M12 32L14 28L16 32L12 30L16 30Z"
        fill={color}
        stroke="#1A1A1A"
        strokeWidth="1"
      />
      {/* Scribble lines representing text */}
      <path d="M26 24L48 24" stroke={color} strokeWidth="4" strokeLinecap="round" />
      <path d="M26 32L42 32" stroke="#CCC" strokeWidth="3" strokeLinecap="round" />
      <path d="M26 39L38 39" stroke="#CCC" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Wobbly star
 */
export function DoodleStar({ size = 24, className, color = "#FFC107" }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M16 3L19 12L29 12L21 18L24 28L16 22L8 28L11 18L3 12L13 12L16 3Z"
        fill={color}
        stroke="#1A1A1A"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Shine */}
      <path
        d="M12 10L14 12L18 11"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.5"
      />
    </svg>
  );
}

export const DoodleIcons = {
  DoodleSearch,
  DoodleBolt,
  DoodleParty,
  DoodleTag,
  DoodlePin,
  DoodleRocket,
  DoodleTicket,
  DoodleStar,
};

export default DoodleIcons;
