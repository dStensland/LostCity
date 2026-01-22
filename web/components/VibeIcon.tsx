import { CSSProperties, type ReactNode } from "react";

// Vibe configurations with colors
export const VIBE_CONFIG = {
  "late-night": { label: "Late Night", color: "#A78BFA" },
  "date-spot": { label: "Date Spot", color: "#F9A8D4" },
  "divey": { label: "Divey", color: "#FDBA74" },
  "intimate": { label: "Intimate", color: "#FCA5A5" },
  "upscale": { label: "Upscale", color: "#FCD34D" },
  "casual": { label: "Casual", color: "#6EE7B7" },
  "artsy": { label: "Artsy", color: "#C4B5FD" },
  "outdoor-seating": { label: "Outdoor", color: "#86EFAC" },
  "live-music": { label: "Live Music", color: "#F9A8D4" },
  "good-for-groups": { label: "Groups", color: "#7DD3FC" },
  "rooftop": { label: "Rooftop", color: "#F472B6" },
  "all-ages": { label: "All Ages", color: "#93C5FD" },
  "family-friendly": { label: "Family Friendly", color: "#A78BFA" },
  "dog-friendly": { label: "Dog Friendly", color: "#FDBA74" },
} as const;

export type VibeType = keyof typeof VIBE_CONFIG;

interface Props {
  type: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
}

// SVG icon paths for each vibe
const iconPaths: Record<string, ReactNode> = {
  // Late Night - moon and stars
  "late-night": (
    <>
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor" />
      <circle cx="18" cy="5" r="1" fill="currentColor" />
      <circle cx="20" cy="8" r="0.5" fill="currentColor" opacity={0.7} />
    </>
  ),

  // Date Spot - heart
  "date-spot": (
    <>
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor" />
    </>
  ),

  // Divey - beer mug
  "divey": (
    <>
      <path d="M17 11h1a3 3 0 010 6h-1" strokeWidth={2} fill="none" stroke="currentColor" />
      <path d="M4 8h12a1 1 0 011 1v10a2 2 0 01-2 2H5a2 2 0 01-2-2V9a1 1 0 011-1z" strokeWidth={2} fill="none" stroke="currentColor" />
      <ellipse cx="6" cy="6" rx="2" ry="1.5" fill="currentColor" opacity={0.8} />
      <ellipse cx="10" cy="5.5" rx="2.5" ry="2" fill="currentColor" opacity={0.9} />
      <ellipse cx="14" cy="6" rx="2" ry="1.5" fill="currentColor" opacity={0.8} />
    </>
  ),

  // Intimate - candle
  "intimate": (
    <>
      <rect x="9" y="10" width="6" height="11" rx="1" strokeWidth={2} fill="none" stroke="currentColor" />
      <path d="M12 10V7" strokeWidth={2} strokeLinecap="round" stroke="currentColor" />
      <path d="M12 2c1.5 1.5 1.5 3 0 5-1.5-2-1.5-3.5 0-5z" fill="currentColor" />
      <ellipse cx="12" cy="4" rx="1.5" ry="2" fill="currentColor" opacity={0.6} />
    </>
  ),

  // Upscale - diamond/gem
  "upscale": (
    <>
      <path d="M6 3h12l3 6-9 12-9-12 3-6z" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor" />
      <path d="M3 9h18" strokeWidth={2} stroke="currentColor" />
      <path d="M12 21L8 9l4-6 4 6-4 12z" strokeWidth={1.5} fill="none" stroke="currentColor" opacity={0.5} />
    </>
  ),

  // Casual - smile face
  "casual": (
    <>
      <circle cx="12" cy="12" r="10" strokeWidth={2} fill="none" stroke="currentColor" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" strokeWidth={2} strokeLinecap="round" fill="none" stroke="currentColor" />
      <circle cx="9" cy="9" r="1.5" fill="currentColor" />
      <circle cx="15" cy="9" r="1.5" fill="currentColor" />
    </>
  ),

  // Artsy - palette
  "artsy": (
    <>
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.6-.7 1.6-1.6 0-.4-.1-.8-.4-1.1-.3-.3-.4-.7-.4-1.1 0-.9.7-1.6 1.6-1.6H16c3.3 0 6-2.7 6-6 0-5-4-9-10-9z" strokeWidth={2} fill="none" stroke="currentColor" />
      <circle cx="7" cy="10" r="1.5" fill="currentColor" />
      <circle cx="10" cy="6" r="1.5" fill="currentColor" />
      <circle cx="15" cy="6" r="1.5" fill="currentColor" />
      <circle cx="17" cy="10" r="1.5" fill="currentColor" />
    </>
  ),

  // Outdoor Seating - sun/tree
  "outdoor-seating": (
    <>
      <circle cx="12" cy="6" r="4" strokeWidth={2} fill="none" stroke="currentColor" />
      <path d="M12 1v1M12 10v1M4.22 4.22l.7.7M18.36 4.93l.7-.7M1 10h1M22 10h1M4.22 15.78l.7-.7M18.36 15.07l.7.7" strokeWidth={2} strokeLinecap="round" stroke="currentColor" />
      <path d="M8 21h8M12 14v7" strokeWidth={2} strokeLinecap="round" stroke="currentColor" />
    </>
  ),

  // Live Music - guitar
  "live-music": (
    <>
      <path d="M11.5 8.5L9 11l-5.5 5.5a2.12 2.12 0 103 3L12 14l2.5-2.5" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor" />
      <path d="M20 4l-8.5 8.5" strokeWidth={2} strokeLinecap="round" stroke="currentColor" />
      <path d="M18 2l4 4-2 2-4-4 2-2z" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor" />
      <circle cx="7" cy="17" r="1" fill="currentColor" />
    </>
  ),

  // Good for Groups - multiple people
  "good-for-groups": (
    <>
      <circle cx="9" cy="7" r="3" strokeWidth={2} fill="none" stroke="currentColor" />
      <circle cx="17" cy="7" r="3" strokeWidth={2} fill="none" stroke="currentColor" />
      <path d="M3 21v-2a4 4 0 014-4h4" strokeWidth={2} strokeLinecap="round" fill="none" stroke="currentColor" />
      <path d="M21 21v-2a4 4 0 00-4-4h-4" strokeWidth={2} strokeLinecap="round" fill="none" stroke="currentColor" />
    </>
  ),

  // Rooftop - city skyline
  "rooftop": (
    <>
      <path d="M3 21h18" strokeWidth={2} strokeLinecap="round" stroke="currentColor" />
      <rect x="3" y="13" width="4" height="8" strokeWidth={2} fill="none" stroke="currentColor" />
      <rect x="9" y="8" width="5" height="13" strokeWidth={2} fill="none" stroke="currentColor" />
      <rect x="16" y="11" width="5" height="10" strokeWidth={2} fill="none" stroke="currentColor" />
      <circle cx="18" cy="5" r="1.5" fill="currentColor" opacity={0.8} />
      <circle cx="20" cy="7" r="1" fill="currentColor" opacity={0.5} />
    </>
  ),

  // All Ages - ticket
  "all-ages": (
    <>
      <path d="M2 9a3 3 0 013-3h14a3 3 0 013 3v6a3 3 0 01-3 3H5a3 3 0 01-3-3V9z" strokeWidth={2} fill="none" stroke="currentColor" />
      <path d="M13 6v12" strokeWidth={2} strokeDasharray="2 2" stroke="currentColor" />
      <circle cx="8" cy="12" r="2" fill="currentColor" opacity={0.6} />
    </>
  ),

  // Family Friendly - house with heart
  "family-friendly": (
    <>
      <path d="M3 10.5L12 3l9 7.5" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor" />
      <path d="M5 9v10a2 2 0 002 2h10a2 2 0 002-2V9" strokeWidth={2} fill="none" stroke="currentColor" />
      <path d="M12 12l1.5 1.5 1.5-1.5a1.5 1.5 0 00-2.12-2.12L12 10.76l-.88-.88a1.5 1.5 0 00-2.12 2.12L12 15l3-3" strokeWidth={1.5} fill="none" stroke="currentColor" />
    </>
  ),

  // Dog Friendly - dog face
  "dog-friendly": (
    <>
      <circle cx="12" cy="12" r="9" strokeWidth={2} fill="none" stroke="currentColor" />
      <ellipse cx="9" cy="10" rx="1.5" ry="2" fill="currentColor" />
      <ellipse cx="15" cy="10" rx="1.5" ry="2" fill="currentColor" />
      <ellipse cx="12" cy="14" rx="2" ry="1.5" fill="currentColor" />
      <path d="M10 17c1 1 3 1 4 0" strokeWidth={2} strokeLinecap="round" fill="none" stroke="currentColor" />
      <path d="M5 7c-1-2 0-4 2-4" strokeWidth={2} strokeLinecap="round" fill="none" stroke="currentColor" />
      <path d="M19 7c1-2 0-4-2-4" strokeWidth={2} strokeLinecap="round" fill="none" stroke="currentColor" />
    </>
  ),
};

// Default icon
const defaultIcon = (
  <>
    <circle cx="12" cy="12" r="10" strokeWidth={2} fill="none" stroke="currentColor" />
    <circle cx="12" cy="12" r="3" fill="currentColor" />
  </>
);

export default function VibeIcon({
  type,
  size = 20,
  className = "",
  style,
}: Props) {
  const config = VIBE_CONFIG[type as VibeType];
  const color = config?.color || "#8B8B94";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`flex-shrink-0 ${className}`}
      style={{ color, ...style }}
    >
      {iconPaths[type] || defaultIcon}
    </svg>
  );
}

// Export helper to get color for a vibe
export function getVibeColor(type: string): string {
  return VIBE_CONFIG[type as VibeType]?.color || "#8B8B94";
}
