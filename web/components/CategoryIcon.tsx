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
  learning: { label: "Learning", color: "#A8E6CF" },
  dance: { label: "Dance", color: "#F9A8D4" },
  tours: { label: "Tours", color: "#7DD3FC" },
  meetup: { label: "Meetup", color: "#ED1C40" },
  words: { label: "Words", color: "#93C5FD" },
  religious: { label: "Religious", color: "#DDD6FE" },
  markets: { label: "Markets", color: "#FCA5A5" },
  wellness: { label: "Wellness", color: "#99F6E4" },
  gaming: { label: "Gaming", color: "#86EFAC" },
  outdoors: { label: "Outdoors", color: "#BEF264" },
  other: { label: "Other", color: "#8B8B94" },

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
  bookstore: { label: "Bookstore", color: "#93C5FD" },
  library: { label: "Library", color: "#60A5FA" },
  venue: { label: "Venue", color: "#A78BFA" },
  organization: { label: "Organization", color: "#6EE7B7" },
  festival: { label: "Festival", color: "#FBBF24" },
  cinema: { label: "Cinema", color: "#A5B4FC" },
  park: { label: "Park", color: "#86EFAC" },
  garden: { label: "Garden", color: "#4ADE80" },
  outdoor: { label: "Outdoor", color: "#BEF264" },
  food_hall: { label: "Food Hall", color: "#FB923C" },
  farmers_market: { label: "Farmers Market", color: "#FCA5A5" },

  // New categories for expanded crawlers
  haunted: { label: "Haunted", color: "#9333EA" },
  cooking: { label: "Cooking", color: "#F97316" },
  eatertainment: { label: "Eatertainment", color: "#22D3EE" },
  yoga: { label: "Yoga", color: "#A3E635" },
  coworking: { label: "Coworking", color: "#60A5FA" },
  record_store: { label: "Record Store", color: "#EC4899" },
  lgbtq: { label: "LGBTQ+", color: "#F472B6" },
  sports_bar: { label: "Sports Bar", color: "#38BDF8" },
  attraction: { label: "Attraction", color: "#FBBF24" },
  studio: { label: "Studio", color: "#A3E635" },
  cooking_school: { label: "Cooking School", color: "#F97316" },
  community_center: { label: "Community Center", color: "#6EE7B7" },

  // New spot types
  college: { label: "College", color: "#60A5FA" },
  university: { label: "University", color: "#60A5FA" },
  healthcare: { label: "Healthcare", color: "#34D399" },
  hospital: { label: "Hospital", color: "#34D399" },
  hotel: { label: "Hotel", color: "#FBBF24" },
  rooftop: { label: "Rooftop", color: "#F472B6" },
  distillery: { label: "Distillery", color: "#D97706" },
  winery: { label: "Winery", color: "#A855F7" },
  church: { label: "Church", color: "#DDD6FE" },
  event_space: { label: "Event Space", color: "#A78BFA" },
  fitness_center: { label: "Fitness Center", color: "#5EEAD4" },
} as const;

export type CategoryType = keyof typeof CATEGORY_CONFIG;

type GlowIntensity = "none" | "subtle" | "default" | "intense" | "pulse" | "flicker";

interface Props {
  type: string;
  size?: number;
  className?: string;
  showLabel?: boolean;
  style?: CSSProperties;
  /** Neon glow intensity: "none", "subtle", "default", "intense", "pulse", or "flicker" */
  glow?: GlowIntensity;
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

  // Film - film reel
  film: (
    <>
      {/* Outer reel circle */}
      <circle cx="12" cy="12" r="9" strokeWidth={2} fill="none" stroke="currentColor" />
      {/* Center hub */}
      <circle cx="12" cy="12" r="3" strokeWidth={2} fill="none" stroke="currentColor" />
      {/* Film holes around the reel */}
      <circle cx="12" cy="5.5" r="1.5" fill="currentColor" />
      <circle cx="17.5" cy="9" r="1.5" fill="currentColor" />
      <circle cx="17.5" cy="15" r="1.5" fill="currentColor" />
      <circle cx="12" cy="18.5" r="1.5" fill="currentColor" />
      <circle cx="6.5" cy="15" r="1.5" fill="currentColor" />
      <circle cx="6.5" cy="9" r="1.5" fill="currentColor" />
      {/* Film strip coming out */}
      <path d="M21 8v8" strokeWidth={2} strokeLinecap="round" stroke="currentColor" opacity={0.6} />
      <path d="M23 6v12" strokeWidth={1.5} strokeLinecap="round" stroke="currentColor" opacity={0.4} />
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

  // Food & Drink - cocktail glass with garnish
  food_drink: (
    <>
      {/* Cocktail glass */}
      <path d="M8 3h8l-3 9v6h-2v-6L8 3z" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor" />
      {/* Base */}
      <path d="M7 21h10" strokeWidth={2} strokeLinecap="round" stroke="currentColor" />
      <path d="M12 18v3" strokeWidth={2} stroke="currentColor" />
      {/* Liquid */}
      <path d="M9.5 6h5l-1.5 4.5h-2L9.5 6z" fill="currentColor" opacity={0.4} />
      {/* Garnish - citrus slice */}
      <circle cx="16" cy="5" r="2.5" strokeWidth={1.5} fill="none" stroke="currentColor" />
      <path d="M14.5 5h3M16 3.5v3" strokeWidth={1} stroke="currentColor" opacity={0.6} />
    </>
  ),
  restaurant: (
    <>
      {/* Plate */}
      <ellipse cx="12" cy="14" rx="9" ry="5" strokeWidth={2} fill="none" stroke="currentColor" />
      {/* Dome/cloche */}
      <path d="M5 14c0-5 3-9 7-9s7 4 7 9" strokeWidth={2} fill="none" stroke="currentColor" />
      {/* Handle */}
      <path d="M10 5h4" strokeWidth={2} strokeLinecap="round" stroke="currentColor" />
      <circle cx="12" cy="5" r="1" fill="currentColor" />
    </>
  ),

  // Bar - beer mug with foam, tilted for cheers
  bar: (
    <g transform="rotate(-15, 12, 12)">
      {/* Handle */}
      <path d="M18 10h1.5a2.5 2.5 0 010 5H18" strokeWidth={2} fill="none" stroke="currentColor" />
      {/* Mug body */}
      <path d="M5 7h12a1 1 0 011 1v11a2 2 0 01-2 2H6a2 2 0 01-2-2V8a1 1 0 011-1z" strokeWidth={2} fill="none" stroke="currentColor" />
      {/* Foam bubbles - glowy, overflowing */}
      <ellipse cx="7" cy="5.5" rx="2.5" ry="2" fill="currentColor" opacity={0.9} />
      <ellipse cx="11" cy="4.5" rx="3" ry="2.5" fill="currentColor" opacity={0.95} />
      <ellipse cx="15" cy="5.5" rx="2.5" ry="2" fill="currentColor" opacity={0.9} />
      <circle cx="9" cy="3.5" r="1.5" fill="currentColor" opacity={0.75} />
      <circle cx="13" cy="3" r="1.3" fill="currentColor" opacity={0.65} />
      <circle cx="16.5" cy="4" r="1" fill="currentColor" opacity={0.5} />
      {/* Bubbles in beer */}
      <circle cx="8" cy="13" r="0.7" fill="currentColor" opacity={0.3} />
      <circle cx="12" cy="15" r="0.5" fill="currentColor" opacity={0.25} />
      <circle cx="10" cy="11" r="0.6" fill="currentColor" opacity={0.2} />
    </g>
  ),

  // Coffee - cup
  coffee_shop: (
    <>
      <path d="M18 8h1a4 4 0 010 8h-1" strokeWidth={2} fill="none" stroke="currentColor" />
      <path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z" strokeWidth={2} fill="none" stroke="currentColor" />
      <path d="M6 1v3M10 1v3M14 1v3" strokeWidth={2} strokeLinecap="round" stroke="currentColor" />
    </>
  ),

  // Brewery - beer mug with foam (same as bar)
  brewery: (
    <>
      {/* Handle */}
      <path d="M17 11h1.5a3 3 0 010 6H17" strokeWidth={2} fill="none" stroke="currentColor" />
      {/* Mug body */}
      <path d="M4 8h12a1 1 0 011 1v10a2 2 0 01-2 2H5a2 2 0 01-2-2V9a1 1 0 011-1z" strokeWidth={2} fill="none" stroke="currentColor" />
      {/* Foam bubbles - glowy */}
      <ellipse cx="6" cy="6" rx="2.5" ry="2" fill="currentColor" opacity={0.9} />
      <ellipse cx="10" cy="5" rx="3" ry="2.5" fill="currentColor" opacity={0.95} />
      <ellipse cx="14" cy="6" rx="2.5" ry="2" fill="currentColor" opacity={0.9} />
      <circle cx="8" cy="4" r="1.5" fill="currentColor" opacity={0.7} />
      <circle cx="12" cy="3.5" r="1.2" fill="currentColor" opacity={0.6} />
      {/* Bubbles in beer */}
      <circle cx="7" cy="14" r="0.8" fill="currentColor" opacity={0.3} />
      <circle cx="11" cy="16" r="0.6" fill="currentColor" opacity={0.25} />
      <circle cx="9" cy="12" r="0.5" fill="currentColor" opacity={0.2} />
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

  // Meetup - group of people
  meetup: (
    <>
      <circle cx="9" cy="7" r="3" strokeWidth={2} fill="none" stroke="currentColor" />
      <circle cx="17" cy="7" r="3" strokeWidth={2} fill="none" stroke="currentColor" />
      <path d="M3 21v-2a4 4 0 014-4h4" strokeWidth={2} strokeLinecap="round" fill="none" stroke="currentColor" />
      <path d="M21 21v-2a4 4 0 00-4-4h-4" strokeWidth={2} strokeLinecap="round" fill="none" stroke="currentColor" />
    </>
  ),

  // Words - open book
  words: (
    <>
      <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2V3z" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor" />
      <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7V3z" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor" />
    </>
  ),

  // Bookstore - spot type
  bookstore: (
    <>
      <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2V3z" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor" />
      <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7V3z" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor" />
    </>
  ),

  // Library - building with book
  library: (
    <>
      <path d="M4 19V6a2 2 0 012-2h12a2 2 0 012 2v13" strokeWidth={2} fill="none" stroke="currentColor" />
      <path d="M2 19h20M2 22h20" strokeWidth={2} strokeLinecap="round" stroke="currentColor" />
      <path d="M9 4v15M15 4v15" strokeWidth={2} stroke="currentColor" opacity={0.5} />
    </>
  ),

  // Learning - graduation cap
  learning: (
    <>
      <path d="M22 10l-10-5L2 10l10 5 10-5z" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor" />
      <path d="M6 12v5c3 3 9 3 12 0v-5" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor" />
      <path d="M22 10v6" strokeWidth={2} strokeLinecap="round" stroke="currentColor" />
    </>
  ),

  // Dance - dancing figure
  dance: (
    <>
      <circle cx="12" cy="4" r="2" strokeWidth={2} fill="none" stroke="currentColor" />
      <path d="M12 6v6" strokeWidth={2} strokeLinecap="round" stroke="currentColor" />
      <path d="M12 12l4 4M12 12l-4 4" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor" />
      <path d="M8 8l4 4 4-4" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor" />
      <path d="M12 18v3" strokeWidth={2} strokeLinecap="round" stroke="currentColor" />
    </>
  ),

  // Tours - compass/map marker
  tours: (
    <>
      <circle cx="12" cy="12" r="10" strokeWidth={2} fill="none" stroke="currentColor" />
      <polygon points="12,2 15,10 12,8 9,10" fill="currentColor" />
      <polygon points="12,22 9,14 12,16 15,14" fill="currentColor" opacity={0.5} />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </>
  ),

  // Other - generic star
  other: (
    <>
      <polygon points="12,2 15,9 22,9 17,14 19,22 12,17 5,22 7,14 2,9 9,9" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor" />
    </>
  ),

  // Religious - church/hands in prayer
  religious: (
    <>
      <path d="M12 2v4M12 22v-6" strokeWidth={2} strokeLinecap="round" stroke="currentColor" />
      <path d="M4 10l8-4 8 4" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor" />
      <path d="M4 10v12h16V10" strokeWidth={2} fill="none" stroke="currentColor" />
      <path d="M9 22v-6h6v6" strokeWidth={2} fill="none" stroke="currentColor" />
    </>
  ),

  // Markets - shopping bag/stall
  markets: (
    <>
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor" />
      <path d="M3 6h18" strokeWidth={2} stroke="currentColor" />
      <path d="M16 10a4 4 0 01-8 0" strokeWidth={2} strokeLinecap="round" fill="none" stroke="currentColor" />
    </>
  ),

  // Wellness - lotus/meditation
  wellness: (
    <>
      <circle cx="12" cy="8" r="3" strokeWidth={2} fill="none" stroke="currentColor" />
      <path d="M12 11c-4 0-6 3-6 5s2 4 6 4 6-2 6-4-2-5-6-5z" strokeWidth={2} fill="none" stroke="currentColor" />
      <path d="M8 16c0-2 2-3 4-3s4 1 4 3" strokeWidth={2} strokeLinecap="round" fill="none" stroke="currentColor" />
    </>
  ),

  // Gaming - game controller
  gaming: (
    <>
      <path d="M6 11h4M8 9v4" strokeWidth={2} strokeLinecap="round" stroke="currentColor" />
      <circle cx="15" cy="10" r="1" fill="currentColor" />
      <circle cx="17" cy="12" r="1" fill="currentColor" />
      <path d="M2 10a4 4 0 014-4h12a4 4 0 014 4v4a4 4 0 01-4 4H6a4 4 0 01-4-4v-4z" strokeWidth={2} fill="none" stroke="currentColor" />
    </>
  ),

  // Outdoors - mountain/sun
  outdoors: (
    <>
      <path d="M8 21l4-10 4 10" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor" />
      <path d="M2 21h20" strokeWidth={2} strokeLinecap="round" stroke="currentColor" />
      <path d="M14 21l3-6 5 6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor" />
      <circle cx="18" cy="5" r="3" strokeWidth={2} fill="none" stroke="currentColor" />
    </>
  ),

  // Venue - generic building
  venue: (
    <>
      <rect x="3" y="8" width="18" height="13" rx="1" strokeWidth={2} fill="none" stroke="currentColor" />
      <path d="M3 12h18" strokeWidth={2} stroke="currentColor" />
      <path d="M12 3v5" strokeWidth={2} strokeLinecap="round" stroke="currentColor" />
      <path d="M8 3h8" strokeWidth={2} strokeLinecap="round" stroke="currentColor" />
    </>
  ),

  // Organization - building with people
  organization: (
    <>
      <rect x="4" y="4" width="16" height="17" rx="1" strokeWidth={2} fill="none" stroke="currentColor" />
      <path d="M9 21v-4h6v4" strokeWidth={2} fill="none" stroke="currentColor" />
      <circle cx="12" cy="10" r="2" strokeWidth={2} fill="none" stroke="currentColor" />
      <path d="M8 8h2M14 8h2" strokeWidth={2} strokeLinecap="round" stroke="currentColor" />
    </>
  ),

  // Festival - tent
  festival: (
    <>
      <path d="M12 2L2 12h20L12 2z" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor" />
      <path d="M12 2v10" strokeWidth={2} stroke="currentColor" />
      <path d="M4 22V12h16v10" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor" />
      <path d="M9 22v-5h6v5" strokeWidth={2} fill="none" stroke="currentColor" />
    </>
  ),

  // Cinema - film reel (same as film)
  cinema: (
    <>
      {/* Outer reel circle */}
      <circle cx="12" cy="12" r="9" strokeWidth={2} fill="none" stroke="currentColor" />
      {/* Center hub */}
      <circle cx="12" cy="12" r="3" strokeWidth={2} fill="none" stroke="currentColor" />
      {/* Film holes around the reel */}
      <circle cx="12" cy="5.5" r="1.5" fill="currentColor" />
      <circle cx="17.5" cy="9" r="1.5" fill="currentColor" />
      <circle cx="17.5" cy="15" r="1.5" fill="currentColor" />
      <circle cx="12" cy="18.5" r="1.5" fill="currentColor" />
      <circle cx="6.5" cy="15" r="1.5" fill="currentColor" />
      <circle cx="6.5" cy="9" r="1.5" fill="currentColor" />
      {/* Film strip coming out */}
      <path d="M21 8v8" strokeWidth={2} strokeLinecap="round" stroke="currentColor" opacity={0.6} />
      <path d="M23 6v12" strokeWidth={1.5} strokeLinecap="round" stroke="currentColor" opacity={0.4} />
    </>
  ),

  // Park - tree
  park: (
    <>
      <path d="M12 22v-6" strokeWidth={2} strokeLinecap="round" stroke="currentColor" />
      <path d="M12 2l-6 8h4l-4 6h12l-4-6h4L12 2z" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor" />
    </>
  ),

  // Garden - flower
  garden: (
    <>
      <circle cx="12" cy="8" r="3" strokeWidth={2} fill="none" stroke="currentColor" />
      <path d="M12 11v11" strokeWidth={2} strokeLinecap="round" stroke="currentColor" />
      <path d="M9 5c-2-2-5-1-5 2s3 4 5 2" strokeWidth={2} fill="none" stroke="currentColor" />
      <path d="M15 5c2-2 5-1 5 2s-3 4-5 2" strokeWidth={2} fill="none" stroke="currentColor" />
      <path d="M8 17c-2 0-3 2-2 4h12c1-2 0-4-2-4" strokeWidth={2} fill="none" stroke="currentColor" />
    </>
  ),

  // Outdoor - same as outdoors
  outdoor: (
    <>
      <path d="M8 21l4-10 4 10" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor" />
      <path d="M2 21h20" strokeWidth={2} strokeLinecap="round" stroke="currentColor" />
      <path d="M14 21l3-6 5 6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor" />
      <circle cx="18" cy="5" r="3" strokeWidth={2} fill="none" stroke="currentColor" />
    </>
  ),

  // Food Hall - multiple food items
  food_hall: (
    <>
      <rect x="2" y="6" width="20" height="14" rx="2" strokeWidth={2} fill="none" stroke="currentColor" />
      <path d="M2 10h20" strokeWidth={2} stroke="currentColor" />
      <path d="M8 6V4M12 6V4M16 6V4" strokeWidth={2} strokeLinecap="round" stroke="currentColor" />
      <circle cx="7" cy="14" r="2" fill="currentColor" opacity={0.5} />
      <circle cx="12" cy="14" r="2" fill="currentColor" opacity={0.5} />
      <circle cx="17" cy="14" r="2" fill="currentColor" opacity={0.5} />
    </>
  ),

  // Farmers Market - produce stand
  farmers_market: (
    <>
      <path d="M3 11l9-7 9 7" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor" />
      <path d="M5 9v12h14V9" strokeWidth={2} fill="none" stroke="currentColor" />
      <circle cx="9" cy="15" r="2" fill="currentColor" />
      <circle cx="15" cy="15" r="2" fill="currentColor" />
      <circle cx="12" cy="13" r="2" fill="currentColor" opacity={0.6} />
    </>
  ),

  // Haunted - ghost
  haunted: (
    <>
      <path d="M12 2C8 2 5 5.5 5 9.5V22l2.5-2 2 2 2.5-2 2.5 2 2-2 2.5 2V9.5C19 5.5 16 2 12 2z" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor" />
      <circle cx="9" cy="10" r="1.5" fill="currentColor" />
      <circle cx="15" cy="10" r="1.5" fill="currentColor" />
      <path d="M9 15c1.5 1 4.5 1 6 0" strokeWidth={2} strokeLinecap="round" fill="none" stroke="currentColor" />
    </>
  ),
  attraction: (
    <>
      <path d="M12 2C8 2 5 5.5 5 9.5V22l2.5-2 2 2 2.5-2 2.5 2 2-2 2.5 2V9.5C19 5.5 16 2 12 2z" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor" />
      <circle cx="9" cy="10" r="1.5" fill="currentColor" />
      <circle cx="15" cy="10" r="1.5" fill="currentColor" />
      <path d="M9 15c1.5 1 4.5 1 6 0" strokeWidth={2} strokeLinecap="round" fill="none" stroke="currentColor" />
    </>
  ),

  // Cooking - chef hat
  cooking: (
    <>
      <path d="M6 13c-1.7 0-3-1.3-3-3 0-1.4 1-2.6 2.3-2.9C5.6 4.6 7.6 3 10 3c1.4 0 2.6.6 3.5 1.5.5-.3 1-.5 1.5-.5 1.7 0 3 1.3 3 3 0 .3 0 .6-.1.9 1.4.5 2.1 1.6 2.1 3.1 0 1.7-1.3 3-3 3" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor" />
      <rect x="6" y="13" width="12" height="8" rx="1" strokeWidth={2} fill="none" stroke="currentColor" />
      <path d="M10 17h4" strokeWidth={2} strokeLinecap="round" stroke="currentColor" />
    </>
  ),
  cooking_school: (
    <>
      <path d="M6 13c-1.7 0-3-1.3-3-3 0-1.4 1-2.6 2.3-2.9C5.6 4.6 7.6 3 10 3c1.4 0 2.6.6 3.5 1.5.5-.3 1-.5 1.5-.5 1.7 0 3 1.3 3 3 0 .3 0 .6-.1.9 1.4.5 2.1 1.6 2.1 3.1 0 1.7-1.3 3-3 3" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor" />
      <rect x="6" y="13" width="12" height="8" rx="1" strokeWidth={2} fill="none" stroke="currentColor" />
      <path d="M10 17h4" strokeWidth={2} strokeLinecap="round" stroke="currentColor" />
    </>
  ),

  // Eatertainment - bowling pin + fork
  eatertainment: (
    <>
      <path d="M8 4c0-1 .5-2 2-2s2 1 2 2c0 2-1 3-1 5h-2c0-2-1-3-1-5z" strokeWidth={2} fill="none" stroke="currentColor" />
      <ellipse cx="10" cy="11" rx="2.5" ry="2" strokeWidth={2} fill="none" stroke="currentColor" />
      <path d="M7.5 13c-.5 1-.5 3 0 4 .5 1 2 2 2.5 2s2-1 2.5-2c.5-1 .5-3 0-4" strokeWidth={2} fill="none" stroke="currentColor" />
      <path d="M17 3v8M17 14v4M14 6h6" strokeWidth={2} strokeLinecap="round" stroke="currentColor" />
    </>
  ),

  // Yoga - person in lotus pose
  yoga: (
    <>
      <circle cx="12" cy="5" r="2.5" strokeWidth={2} fill="none" stroke="currentColor" />
      <path d="M12 8v4" strokeWidth={2} strokeLinecap="round" stroke="currentColor" />
      <path d="M8 10l4 2 4-2" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor" />
      <path d="M4 18c2-2 4-3 8-3s6 1 8 3" strokeWidth={2} strokeLinecap="round" fill="none" stroke="currentColor" />
      <path d="M8 15l-2 4M16 15l2 4" strokeWidth={2} strokeLinecap="round" stroke="currentColor" />
    </>
  ),
  studio: (
    <>
      <circle cx="12" cy="5" r="2.5" strokeWidth={2} fill="none" stroke="currentColor" />
      <path d="M12 8v4" strokeWidth={2} strokeLinecap="round" stroke="currentColor" />
      <path d="M8 10l4 2 4-2" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor" />
      <path d="M4 18c2-2 4-3 8-3s6 1 8 3" strokeWidth={2} strokeLinecap="round" fill="none" stroke="currentColor" />
      <path d="M8 15l-2 4M16 15l2 4" strokeWidth={2} strokeLinecap="round" stroke="currentColor" />
    </>
  ),

  // Coworking - laptop/desk
  coworking: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="2" strokeWidth={2} fill="none" stroke="currentColor" />
      <path d="M7 8h10" strokeWidth={2} strokeLinecap="round" stroke="currentColor" opacity={0.5} />
      <path d="M7 11h6" strokeWidth={2} strokeLinecap="round" stroke="currentColor" opacity={0.5} />
      <path d="M1 20h22" strokeWidth={2} strokeLinecap="round" stroke="currentColor" />
      <path d="M6 16l-1 4M18 16l1 4" strokeWidth={2} strokeLinecap="round" stroke="currentColor" />
    </>
  ),

  // Record Store - vinyl record
  record_store: (
    <>
      <circle cx="12" cy="12" r="9" strokeWidth={2} fill="none" stroke="currentColor" />
      <circle cx="12" cy="12" r="3" strokeWidth={2} fill="none" stroke="currentColor" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
      <path d="M12 3v2M12 19v2" strokeWidth={1.5} stroke="currentColor" opacity={0.3} />
      <path d="M3 12h2M19 12h2" strokeWidth={1.5} stroke="currentColor" opacity={0.3} />
    </>
  ),

  // LGBTQ+ - rainbow/pride flag
  lgbtq: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="1" strokeWidth={2} fill="none" stroke="currentColor" />
      <path d="M3 7h18" strokeWidth={2} stroke="currentColor" />
      <path d="M3 10h18" strokeWidth={2} stroke="currentColor" opacity={0.8} />
      <path d="M3 13h18" strokeWidth={2} stroke="currentColor" opacity={0.6} />
      <path d="M3 16h18" strokeWidth={2} stroke="currentColor" opacity={0.4} />
    </>
  ),

  // Sports Bar - TV with ball
  sports_bar: (
    <>
      <rect x="2" y="4" width="16" height="10" rx="1" strokeWidth={2} fill="none" stroke="currentColor" />
      <path d="M6 18h8M10 14v4" strokeWidth={2} strokeLinecap="round" stroke="currentColor" />
      <circle cx="18" cy="14" r="4" strokeWidth={2} fill="none" stroke="currentColor" />
      <path d="M16 14c0-1.1.9-2 2-2M18 12v4" strokeWidth={1.5} stroke="currentColor" />
    </>
  ),

  // Community Center - building with people
  community_center: (
    <>
      <path d="M3 21h18" strokeWidth={2} strokeLinecap="round" stroke="currentColor" />
      <path d="M5 21V7l7-4 7 4v14" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor" />
      <rect x="9" y="13" width="6" height="8" strokeWidth={2} fill="none" stroke="currentColor" />
      <path d="M9 9h6" strokeWidth={2} strokeLinecap="round" stroke="currentColor" />
    </>
  ),

  // College/University - graduation cap
  college: (
    <>
      <path d="M22 10l-10-5L2 10l10 5 10-5z" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor" />
      <path d="M6 12v5c3 3 9 3 12 0v-5" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor" />
      <path d="M22 10v6" strokeWidth={2} strokeLinecap="round" stroke="currentColor" />
      <circle cx="22" cy="17" r="1" fill="currentColor" />
    </>
  ),
  university: (
    <>
      <path d="M22 10l-10-5L2 10l10 5 10-5z" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor" />
      <path d="M6 12v5c3 3 9 3 12 0v-5" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor" />
      <path d="M22 10v6" strokeWidth={2} strokeLinecap="round" stroke="currentColor" />
      <circle cx="22" cy="17" r="1" fill="currentColor" />
    </>
  ),

  // Healthcare/Hospital - medical cross with heart
  healthcare: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={2} fill="none" stroke="currentColor" />
      <path d="M12 8v8M8 12h8" strokeWidth={2.5} strokeLinecap="round" stroke="currentColor" />
      <circle cx="12" cy="12" r="1" fill="currentColor" opacity={0.5} />
    </>
  ),
  hospital: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={2} fill="none" stroke="currentColor" />
      <path d="M12 8v8M8 12h8" strokeWidth={2.5} strokeLinecap="round" stroke="currentColor" />
      <circle cx="12" cy="12" r="1" fill="currentColor" opacity={0.5} />
    </>
  ),

  // Hotel - bed
  hotel: (
    <>
      <path d="M2 17v-5a3 3 0 013-3h14a3 3 0 013 3v5" strokeWidth={2} strokeLinecap="round" fill="none" stroke="currentColor" />
      <path d="M2 17h20v3H2v-3z" strokeWidth={2} fill="none" stroke="currentColor" />
      <path d="M6 9V6a2 2 0 012-2h2a2 2 0 012 2v3" strokeWidth={2} fill="none" stroke="currentColor" />
      <circle cx="8" cy="7" r="1.5" fill="currentColor" opacity={0.5} />
    </>
  ),

  // Rooftop - building with view
  rooftop: (
    <>
      <path d="M3 21h18" strokeWidth={2} strokeLinecap="round" stroke="currentColor" />
      <path d="M5 21V10l7-7 7 7v11" strokeWidth={2} fill="none" stroke="currentColor" />
      <path d="M9 21v-6h6v6" strokeWidth={2} fill="none" stroke="currentColor" />
      {/* Stars/lights at top */}
      <circle cx="8" cy="5" r="1" fill="currentColor" opacity={0.7} />
      <circle cx="16" cy="5" r="1" fill="currentColor" opacity={0.7} />
      <circle cx="12" cy="2" r="1.2" fill="currentColor" opacity={0.9} />
    </>
  ),

  // Distillery - still/bottle
  distillery: (
    <>
      <path d="M8 2h8v4c0 2-1 3-2 4l-1 1v9a2 2 0 01-2 2h0a2 2 0 01-2-2v-9l-1-1c-1-1-2-2-2-4V2z" strokeWidth={2} fill="none" stroke="currentColor" />
      <path d="M8 2h8" strokeWidth={2} strokeLinecap="round" stroke="currentColor" />
      <ellipse cx="12" cy="17" rx="2" ry="1" fill="currentColor" opacity={0.3} />
      <path d="M10 10h4" strokeWidth={1.5} stroke="currentColor" opacity={0.5} />
    </>
  ),

  // Winery - wine glass
  winery: (
    <>
      <path d="M8 2h8l-1 7a4 4 0 01-3 3.5V20h-1v-7.5A4 4 0 018.5 9L8 2z" strokeWidth={2} fill="none" stroke="currentColor" />
      <path d="M7 22h10" strokeWidth={2} strokeLinecap="round" stroke="currentColor" />
      <ellipse cx="12" cy="7" rx="3" ry="2" fill="currentColor" opacity={0.4} />
    </>
  ),

  // Church - steeple with cross
  church: (
    <>
      <path d="M12 2v4M10 4h4" strokeWidth={2} strokeLinecap="round" stroke="currentColor" />
      <path d="M6 22V12l6-6 6 6v10" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor" />
      <path d="M6 22h12" strokeWidth={2} strokeLinecap="round" stroke="currentColor" />
      <rect x="9" y="14" width="6" height="8" strokeWidth={2} fill="none" stroke="currentColor" />
      <path d="M12 14v4" strokeWidth={1.5} stroke="currentColor" opacity={0.5} />
    </>
  ),

  // Event Space - star/sparkle venue
  event_space: (
    <>
      <rect x="3" y="6" width="18" height="14" rx="2" strokeWidth={2} fill="none" stroke="currentColor" />
      <path d="M3 10h18" strokeWidth={2} stroke="currentColor" />
      <path d="M12 13l1 2 2 .5-1.5 1.5.5 2-2-1-2 1 .5-2L9 15.5l2-.5 1-2z" fill="currentColor" opacity={0.8} />
    </>
  ),

  // Fitness Center - dumbbell
  fitness_center: (
    <>
      <path d="M6.5 6.5v11M17.5 6.5v11M6.5 12h11" strokeWidth={2.5} strokeLinecap="round" stroke="currentColor" />
      <rect x="3" y="8" width="3.5" height="8" rx="1" strokeWidth={2} fill="none" stroke="currentColor" />
      <rect x="17.5" y="8" width="3.5" height="8" rx="1" strokeWidth={2} fill="none" stroke="currentColor" />
      <rect x="1" y="10" width="2" height="4" rx="0.5" fill="currentColor" opacity={0.7} />
      <rect x="21" y="10" width="2" height="4" rx="0.5" fill="currentColor" opacity={0.7} />
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

// Map glow intensity to CSS class
const GLOW_CLASSES: Record<GlowIntensity, string> = {
  none: "",
  subtle: "icon-neon-subtle",
  default: "icon-neon",
  intense: "icon-neon-intense",
  pulse: "icon-neon icon-neon-pulse",
  flicker: "icon-neon icon-neon-flicker",
};

export default function CategoryIcon({
  type,
  size = 20,
  className = "",
  showLabel = false,
  style,
  glow = "default",
}: Props) {
  const config = CATEGORY_CONFIG[type as CategoryType];
  const color = config?.color || "#8B8B94";
  const label = config?.label || type;
  const glowClass = GLOW_CLASSES[glow];

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
        className={`flex-shrink-0 ${glowClass}`}
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
