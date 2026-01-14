import { CSSProperties, type ReactNode } from "react";

// Unified category/type definitions with colors
export const CATEGORY_CONFIG = {
  // Event categories
  music: { label: "Music", color: "#F9A8D4" },
  film: { label: "Film", color: "#A5B4FC" },
  comedy: { label: "Comedy", color: "#FCD34D" },
  theater: { label: "Theater", color: "#F0ABFC" },
  art: { label: "Art", color: "#C4B5FD" },
  community: { label: "Community", color: "#6EE7B7" },
  food_drink: { label: "Food & Drink", color: "#FDBA74" },
  sports: { label: "Sports", color: "#7DD3FC" },
  fitness: { label: "Fitness", color: "#5EEAD4" },
  nightlife: { label: "Nightlife", color: "#E879F9" },
  family: { label: "Family", color: "#A78BFA" },

  // Spot types (reuse some colors, add new ones)
  music_venue: { label: "Music Venue", color: "#F9A8D4" },
  bar: { label: "Bar", color: "#FDBA74" },
  restaurant: { label: "Restaurant", color: "#FB923C" },
  coffee_shop: { label: "Coffee", color: "#D4A574" },
  brewery: { label: "Brewery", color: "#FCD34D" },
  gallery: { label: "Gallery", color: "#C4B5FD" },
  club: { label: "Club", color: "#E879F9" },
  arena: { label: "Arena", color: "#7DD3FC" },
  comedy_club: { label: "Comedy Club", color: "#FCD34D" },
  museum: { label: "Museum", color: "#94A3B8" },
  convention_center: { label: "Convention", color: "#38BDF8" },
  games: { label: "Games", color: "#4ADE80" },
} as const;

export type CategoryType = keyof typeof CATEGORY_CONFIG;

interface Props {
  type: string;
  size?: number;
  className?: string;
  showLabel?: boolean;
  style?: CSSProperties;
}

// SVG icon paths for each category/type
const iconPaths: Record<string, ReactNode> = {
  // Music - sound wave
  music: (
    <>
      <path d="M9 18V5l12-2v13" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor" />
      <circle cx="6" cy="18" r="3" fill="currentColor" />
      <circle cx="18" cy="16" r="3" fill="currentColor" />
    </>
  ),
  music_venue: (
    <>
      <path d="M9 18V5l12-2v13" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor" />
      <circle cx="6" cy="18" r="3" fill="currentColor" />
      <circle cx="18" cy="16" r="3" fill="currentColor" />
    </>
  ),

  // Film - clapperboard
  film: (
    <>
      <rect x="2" y="8" width="20" height="14" rx="2" strokeWidth={2} fill="none" stroke="currentColor" />
      <path d="M2 12h20" strokeWidth={2} stroke="currentColor" />
      <path d="M7 8L5 4h14l-2 4" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor" />
      <path d="M10 4l-1 4M15 4l-1 4" strokeWidth={2} strokeLinecap="round" stroke="currentColor" />
    </>
  ),

  // Comedy - masks/smile
  comedy: (
    <>
      <circle cx="12" cy="12" r="10" strokeWidth={2} fill="none" stroke="currentColor" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" strokeWidth={2} strokeLinecap="round" fill="none" stroke="currentColor" />
      <circle cx="9" cy="10" r="1" fill="currentColor" />
      <circle cx="15" cy="10" r="1" fill="currentColor" />
    </>
  ),
  comedy_club: (
    <>
      <circle cx="12" cy="12" r="10" strokeWidth={2} fill="none" stroke="currentColor" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" strokeWidth={2} strokeLinecap="round" fill="none" stroke="currentColor" />
      <circle cx="9" cy="10" r="1" fill="currentColor" />
      <circle cx="15" cy="10" r="1" fill="currentColor" />
    </>
  ),

  // Theater - curtains/masks
  theater: (
    <>
      <path d="M4 3h16v4c0 4-3.5 7-8 7S4 11 4 7V3z" strokeWidth={2} fill="none" stroke="currentColor" />
      <path d="M4 3c0 2 2 4 4 4s4-2 4-4" strokeWidth={2} fill="none" stroke="currentColor" />
      <path d="M12 3c0 2 2 4 4 4s4-2 4-4" strokeWidth={2} fill="none" stroke="currentColor" />
      <path d="M12 14v4M8 21h8" strokeWidth={2} strokeLinecap="round" stroke="currentColor" />
    </>
  ),

  // Art - palette
  art: (
    <>
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.8-.1 2.6-.3.5-.1.8-.6.7-1.1-.1-.4-.4-.7-.8-.8-2-.5-3.5-2.3-3.5-4.5 0-2.5 2-4.5 4.5-4.5 1 0 2 .3 2.8.9.4.3 1 .2 1.3-.2.3-.4.3-.9 0-1.3C17.3 5.5 14.9 2 12 2z" strokeWidth={2} fill="none" stroke="currentColor" />
      <circle cx="8" cy="9" r="1.5" fill="currentColor" />
      <circle cx="12" cy="7" r="1.5" fill="currentColor" />
      <circle cx="16" cy="9" r="1.5" fill="currentColor" />
      <circle cx="7" cy="13" r="1.5" fill="currentColor" />
    </>
  ),
  gallery: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={2} fill="none" stroke="currentColor" />
      <path d="M3 15l5-5 4 4 5-5 4 4" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor" />
      <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
    </>
  ),

  // Community - people
  community: (
    <>
      <circle cx="12" cy="7" r="4" strokeWidth={2} fill="none" stroke="currentColor" />
      <path d="M5.5 21v-2a6.5 6.5 0 0113 0v2" strokeWidth={2} strokeLinecap="round" fill="none" stroke="currentColor" />
    </>
  ),

  // Food & Drink - utensils
  food_drink: (
    <>
      <path d="M3 3v18M3 9h4a4 4 0 000-8H3" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor" />
      <path d="M15 3v6c0 2.2 1.8 4 4 4h2V3h-2M15 13v8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor" />
    </>
  ),
  restaurant: (
    <>
      <path d="M3 3v18M3 9h4a4 4 0 000-8H3" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor" />
      <path d="M15 3v6c0 2.2 1.8 4 4 4h2V3h-2M15 13v8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor" />
    </>
  ),

  // Bar - cocktail glass
  bar: (
    <>
      <path d="M8 2h8l-4 9v11M6 22h12" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor" />
      <path d="M5 2l7 7 7-7" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor" />
    </>
  ),

  // Coffee - cup
  coffee_shop: (
    <>
      <path d="M18 8h1a4 4 0 010 8h-1" strokeWidth={2} fill="none" stroke="currentColor" />
      <path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z" strokeWidth={2} fill="none" stroke="currentColor" />
      <path d="M6 1v3M10 1v3M14 1v3" strokeWidth={2} strokeLinecap="round" stroke="currentColor" />
    </>
  ),

  // Brewery - beer mug
  brewery: (
    <>
      <path d="M17 8h1a4 4 0 010 8h-1" strokeWidth={2} fill="none" stroke="currentColor" />
      <rect x="3" y="4" width="14" height="16" rx="2" strokeWidth={2} fill="none" stroke="currentColor" />
      <path d="M7 8v8M11 8v8" strokeWidth={2} strokeLinecap="round" stroke="currentColor" opacity={0.5} />
    </>
  ),

  // Sports - trophy
  sports: (
    <>
      <path d="M6 4h12v6a6 6 0 01-12 0V4z" strokeWidth={2} fill="none" stroke="currentColor" />
      <path d="M6 8H4a2 2 0 010-4h2M18 8h2a2 2 0 000-4h-2" strokeWidth={2} fill="none" stroke="currentColor" />
      <path d="M12 16v4M8 22h8" strokeWidth={2} strokeLinecap="round" stroke="currentColor" />
    </>
  ),
  arena: (
    <>
      <ellipse cx="12" cy="12" rx="10" ry="6" strokeWidth={2} fill="none" stroke="currentColor" />
      <ellipse cx="12" cy="12" rx="6" ry="3" strokeWidth={2} fill="none" stroke="currentColor" />
      <path d="M12 6v-4M12 18v4" strokeWidth={2} strokeLinecap="round" stroke="currentColor" />
    </>
  ),

  // Fitness - dumbbell
  fitness: (
    <>
      <path d="M6 5v14M18 5v14M6 12h12" strokeWidth={2} stroke="currentColor" />
      <rect x="3" y="7" width="3" height="10" rx="1" strokeWidth={2} fill="none" stroke="currentColor" />
      <rect x="18" y="7" width="3" height="10" rx="1" strokeWidth={2} fill="none" stroke="currentColor" />
    </>
  ),

  // Nightlife - disco ball / moon
  nightlife: (
    <>
      <circle cx="12" cy="12" r="8" strokeWidth={2} fill="none" stroke="currentColor" />
      <ellipse cx="12" cy="12" rx="8" ry="3" strokeWidth={2} fill="none" stroke="currentColor" />
      <path d="M12 4v16" strokeWidth={2} stroke="currentColor" />
      <path d="M4.93 7.5h14.14M4.93 16.5h14.14" strokeWidth={1.5} stroke="currentColor" opacity={0.5} />
    </>
  ),
  club: (
    <>
      <circle cx="12" cy="12" r="8" strokeWidth={2} fill="none" stroke="currentColor" />
      <ellipse cx="12" cy="12" rx="8" ry="3" strokeWidth={2} fill="none" stroke="currentColor" />
      <path d="M12 4v16" strokeWidth={2} stroke="currentColor" />
      <path d="M4.93 7.5h14.14M4.93 16.5h14.14" strokeWidth={1.5} stroke="currentColor" opacity={0.5} />
    </>
  ),

  // Family - house/heart
  family: (
    <>
      <path d="M3 10.5L12 3l9 7.5" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor" />
      <path d="M5 9v10a2 2 0 002 2h10a2 2 0 002-2V9" strokeWidth={2} fill="none" stroke="currentColor" />
      <path d="M12 12.5l2.5 2.5L12 17.5 9.5 15l2.5-2.5z" fill="currentColor" />
    </>
  ),

  // Museum - classical building with columns
  museum: (
    <>
      <path d="M3 21h18M4 21V10M20 21V10M12 3L2 9h20L12 3z" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor" />
      <path d="M7 21v-8M12 21v-8M17 21v-8" strokeWidth={2} strokeLinecap="round" stroke="currentColor" />
    </>
  ),

  // Convention Center - large building
  convention_center: (
    <>
      <rect x="3" y="8" width="18" height="13" rx="1" strokeWidth={2} fill="none" stroke="currentColor" />
      <path d="M3 12h18" strokeWidth={2} stroke="currentColor" />
      <path d="M8 3h8l2 5H6l2-5z" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor" />
      <rect x="7" y="15" width="3" height="6" fill="currentColor" opacity={0.5} />
      <rect x="14" y="15" width="3" height="6" fill="currentColor" opacity={0.5} />
    </>
  ),

  // Games - game controller
  games: (
    <>
      <path d="M6 11h4M8 9v4" strokeWidth={2} strokeLinecap="round" stroke="currentColor" />
      <circle cx="15" cy="10" r="1" fill="currentColor" />
      <circle cx="17" cy="12" r="1" fill="currentColor" />
      <path d="M2 10a4 4 0 014-4h12a4 4 0 014 4v4a4 4 0 01-4 4H6a4 4 0 01-4-4v-4z" strokeWidth={2} fill="none" stroke="currentColor" />
    </>
  ),
};

// Default icon for unknown types
const defaultIcon = (
  <>
    <circle cx="12" cy="12" r="10" strokeWidth={2} fill="none" stroke="currentColor" />
    <circle cx="12" cy="12" r="3" fill="currentColor" />
  </>
);

export default function CategoryIcon({
  type,
  size = 20,
  className = "",
  showLabel = false,
  style,
}: Props) {
  const config = CATEGORY_CONFIG[type as CategoryType];
  const color = config?.color || "#8B8B94";
  const label = config?.label || type;

  return (
    <span
      className={`inline-flex items-center gap-1.5 ${className}`}
      style={{ color, ...style }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0"
      >
        {iconPaths[type] || defaultIcon}
      </svg>
      {showLabel && (
        <span className="font-mono text-xs font-medium uppercase tracking-wide">
          {label}
        </span>
      )}
    </span>
  );
}

// Export helper to get color for a category
export function getCategoryColor(type: string): string {
  return CATEGORY_CONFIG[type as CategoryType]?.color || "#8B8B94";
}

// Export helper to get label for a category
export function getCategoryLabel(type: string): string {
  return CATEGORY_CONFIG[type as CategoryType]?.label || type;
}
