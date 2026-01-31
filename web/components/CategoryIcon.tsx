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
  activism: { label: "Activism", color: "#F87171" },
  other: { label: "Other", color: "#8B8B94" },

  // Spot types
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

  // Extended categories
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

  // Extended spot types
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
  glow?: GlowIntensity;
}

/*
 * LOST CITY ICON SYSTEM
 * =====================
 * Design principles:
 * - Minimal geometric forms that glow beautifully
 * - Consistent 1.5px stroke weight
 * - Open forms to let neon light bleed
 * - Distinctive silhouettes at small sizes
 * - Negative space embraces the void
 */

const iconPaths: Record<string, ReactNode> = {
  // ═══════════════════════════════════════════
  // MUSIC & AUDIO
  // ═══════════════════════════════════════════

  // Music - Sound waves emanating (like a speaker or sound)
  music: (
    <>
      <circle cx="8" cy="12" r="3" strokeWidth={1.5} fill="none" stroke="currentColor" />
      <path d="M14 6c3 2 5 4 5 6s-2 4-5 6" strokeWidth={1.5} strokeLinecap="round" fill="none" stroke="currentColor" />
      <path d="M17 3c4 3 6 6 6 9s-2 6-6 9" strokeWidth={1.5} strokeLinecap="round" fill="none" stroke="currentColor" opacity={0.6} />
    </>
  ),
  music_venue: (
    <>
      <circle cx="8" cy="12" r="3" strokeWidth={1.5} fill="none" stroke="currentColor" />
      <path d="M14 6c3 2 5 4 5 6s-2 4-5 6" strokeWidth={1.5} strokeLinecap="round" fill="none" stroke="currentColor" />
      <path d="M17 3c4 3 6 6 6 9s-2 6-6 9" strokeWidth={1.5} strokeLinecap="round" fill="none" stroke="currentColor" opacity={0.6} />
    </>
  ),

  // Record Store - Vinyl with spindle
  record_store: (
    <>
      <circle cx="12" cy="12" r="9" strokeWidth={1.5} fill="none" stroke="currentColor" />
      <circle cx="12" cy="12" r="4" strokeWidth={1.5} fill="none" stroke="currentColor" opacity={0.5} />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </>
  ),

  // ═══════════════════════════════════════════
  // FILM & VISUAL
  // ═══════════════════════════════════════════

  // Film - Play button in frame
  film: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" strokeWidth={1.5} fill="none" stroke="currentColor" />
      <polygon points="10,8 10,16 16,12" fill="currentColor" />
    </>
  ),
  cinema: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" strokeWidth={1.5} fill="none" stroke="currentColor" />
      <polygon points="10,8 10,16 16,12" fill="currentColor" />
    </>
  ),

  // ═══════════════════════════════════════════
  // COMEDY & THEATER
  // ═══════════════════════════════════════════

  // Comedy - Laughing mask with attitude (theatrical, not emoji)
  comedy: (
    <>
      <path d="M4 8c0-2 2-4 4-4h8c2 0 4 2 4 4v4c0 4-3 8-8 8s-8-4-8-8V8z" strokeWidth={1.5} fill="none" stroke="currentColor" />
      <path d="M8 12c0 3 2 5 4 5s4-2 4-5" strokeWidth={1.5} strokeLinecap="round" fill="none" stroke="currentColor" />
      <path d="M8 9l2 1M16 9l-2 1" strokeWidth={1.5} strokeLinecap="round" stroke="currentColor" />
      <circle cx="9" cy="10" r="0.5" fill="currentColor" />
      <circle cx="15" cy="10" r="0.5" fill="currentColor" />
    </>
  ),
  comedy_club: (
    <>
      <path d="M4 8c0-2 2-4 4-4h8c2 0 4 2 4 4v4c0 4-3 8-8 8s-8-4-8-8V8z" strokeWidth={1.5} fill="none" stroke="currentColor" />
      <path d="M8 12c0 3 2 5 4 5s4-2 4-5" strokeWidth={1.5} strokeLinecap="round" fill="none" stroke="currentColor" />
      <path d="M8 9l2 1M16 9l-2 1" strokeWidth={1.5} strokeLinecap="round" stroke="currentColor" />
      <circle cx="9" cy="10" r="0.5" fill="currentColor" />
      <circle cx="15" cy="10" r="0.5" fill="currentColor" />
    </>
  ),

  // Theater - Stage curtains
  theater: (
    <>
      <path d="M2 3h20v2c0 1-1 2-2 2H4c-1 0-2-1-2-2V3z" strokeWidth={1.5} fill="none" stroke="currentColor" />
      <path d="M4 7c1 2 1 6 0 14" strokeWidth={1.5} strokeLinecap="round" fill="none" stroke="currentColor" />
      <path d="M7 7c.5 3 0 8-2 14" strokeWidth={1.5} strokeLinecap="round" fill="none" stroke="currentColor" opacity={0.6} />
      <path d="M20 7c-1 2-1 6 0 14" strokeWidth={1.5} strokeLinecap="round" fill="none" stroke="currentColor" />
      <path d="M17 7c-.5 3 0 8 2 14" strokeWidth={1.5} strokeLinecap="round" fill="none" stroke="currentColor" opacity={0.6} />
      <circle cx="12" cy="14" r="2" fill="currentColor" opacity={0.4} />
    </>
  ),

  // ═══════════════════════════════════════════
  // ART & CREATIVITY
  // ═══════════════════════════════════════════

  // Art - Abstract brush stroke / splatter
  art: (
    <>
      <circle cx="7" cy="7" r="4" strokeWidth={1.5} fill="none" stroke="currentColor" />
      <circle cx="16" cy="9" r="3" strokeWidth={1.5} fill="none" stroke="currentColor" opacity={0.7} />
      <circle cx="10" cy="16" r="5" strokeWidth={1.5} fill="none" stroke="currentColor" opacity={0.5} />
    </>
  ),

  // Gallery - Frame with abstract
  gallery: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="1" strokeWidth={1.5} fill="none" stroke="currentColor" />
      <path d="M8 12l3-4 3 3 2-2 3 4" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor" />
      <circle cx="8" cy="8" r="1.5" fill="currentColor" />
    </>
  ),

  // Museum - Columns (classical, minimal)
  museum: (
    <>
      <path d="M12 2L3 7h18L12 2z" strokeWidth={1.5} strokeLinejoin="round" fill="none" stroke="currentColor" />
      <path d="M5 7v12M9.5 7v12M14.5 7v12M19 7v12" strokeWidth={1.5} stroke="currentColor" />
      <path d="M3 19h18" strokeWidth={1.5} stroke="currentColor" />
    </>
  ),

  // ═══════════════════════════════════════════
  // FOOD & DRINK
  // ═══════════════════════════════════════════

  // Food & Drink - Cocktail glass
  food_drink: (
    <>
      <path d="M6 3h12l-5 8v7h-2v-7L6 3z" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor" />
      <path d="M8 21h8" strokeWidth={1.5} strokeLinecap="round" stroke="currentColor" />
      <circle cx="17" cy="6" r="2" strokeWidth={1.5} fill="none" stroke="currentColor" opacity={0.6} />
    </>
  ),

  // Restaurant - Cloche / dome
  restaurant: (
    <>
      <ellipse cx="12" cy="17" rx="9" ry="4" strokeWidth={1.5} fill="none" stroke="currentColor" />
      <path d="M4 15c0-6 4-10 8-10s8 4 8 10" strokeWidth={1.5} fill="none" stroke="currentColor" />
      <circle cx="12" cy="5" r="1" fill="currentColor" />
    </>
  ),

  // Bar - Tilted glass with bubbles
  bar: (
    <>
      <path d="M6 4h10l-2 15H8L6 4z" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor" transform="rotate(-10, 12, 12)" />
      <ellipse cx="11" cy="6" rx="4" ry="1.5" strokeWidth={1.5} fill="none" stroke="currentColor" transform="rotate(-10, 12, 12)" />
      <circle cx="10" cy="11" r="0.8" fill="currentColor" opacity={0.5} />
      <circle cx="12" cy="14" r="0.6" fill="currentColor" opacity={0.4} />
    </>
  ),

  // Brewery - Beer mug
  brewery: (
    <>
      <path d="M4 6h11v13a2 2 0 01-2 2H6a2 2 0 01-2-2V6z" strokeWidth={1.5} fill="none" stroke="currentColor" />
      <path d="M15 9h2a3 3 0 010 6h-2" strokeWidth={1.5} fill="none" stroke="currentColor" />
      <ellipse cx="9.5" cy="4" rx="5" ry="2" fill="currentColor" opacity={0.6} />
    </>
  ),

  // Coffee - Steaming cup
  coffee_shop: (
    <>
      <path d="M5 9h11v8a3 3 0 01-3 3H8a3 3 0 01-3-3V9z" strokeWidth={1.5} fill="none" stroke="currentColor" />
      <path d="M16 11h1.5a2.5 2.5 0 010 5H16" strokeWidth={1.5} fill="none" stroke="currentColor" />
      <path d="M8 4c0 2 2 3 2 5M12 4c0 2 2 3 2 5" strokeWidth={1.5} strokeLinecap="round" stroke="currentColor" opacity={0.5} />
    </>
  ),

  // Winery - Wine glass
  winery: (
    <>
      <path d="M7 2h10l-.5 6a5 5 0 01-4 4.5V19h-1v-6.5A5 5 0 017.5 8L7 2z" strokeWidth={1.5} fill="none" stroke="currentColor" />
      <path d="M7 21h10" strokeWidth={1.5} strokeLinecap="round" stroke="currentColor" />
      <ellipse cx="12" cy="6" rx="3.5" ry="2" fill="currentColor" opacity={0.4} />
    </>
  ),

  // Distillery - Still / flask
  distillery: (
    <>
      <path d="M8 3h8v3c0 2-1 3-2 4l-.5.5V20a1 1 0 01-1 1h-1a1 1 0 01-1-1v-9.5L10 10c-1-1-2-2-2-4V3z" strokeWidth={1.5} fill="none" stroke="currentColor" />
      <path d="M8 3h8" strokeWidth={1.5} strokeLinecap="round" stroke="currentColor" />
    </>
  ),

  // Food Hall - Multiple dots (variety)
  food_hall: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" strokeWidth={1.5} fill="none" stroke="currentColor" />
      <circle cx="7" cy="12" r="2" fill="currentColor" />
      <circle cx="12" cy="12" r="2" fill="currentColor" opacity={0.7} />
      <circle cx="17" cy="12" r="2" fill="currentColor" opacity={0.5} />
    </>
  ),

  // Farmers Market - Produce/basket
  farmers_market: (
    <>
      <path d="M4 10c0-1 1-2 2-2h12c1 0 2 1 2 2l-2 10H6L4 10z" strokeWidth={1.5} fill="none" stroke="currentColor" />
      <circle cx="9" cy="13" r="2" fill="currentColor" />
      <circle cx="15" cy="14" r="1.5" fill="currentColor" opacity={0.6} />
      <path d="M4 10h16" strokeWidth={1.5} stroke="currentColor" />
    </>
  ),

  // Cooking - Flame
  cooking: (
    <>
      <path d="M12 2c-2 4-5 6-5 10a5 5 0 0010 0c0-4-3-6-5-10z" strokeWidth={1.5} fill="none" stroke="currentColor" />
      <path d="M12 8c-1 2-2 3-2 5a2 2 0 004 0c0-2-1-3-2-5z" fill="currentColor" opacity={0.5} />
    </>
  ),
  cooking_school: (
    <>
      <path d="M12 2c-2 4-5 6-5 10a5 5 0 0010 0c0-4-3-6-5-10z" strokeWidth={1.5} fill="none" stroke="currentColor" />
      <path d="M12 8c-1 2-2 3-2 5a2 2 0 004 0c0-2-1-3-2-5z" fill="currentColor" opacity={0.5} />
    </>
  ),

  // ═══════════════════════════════════════════
  // NIGHTLIFE & ENTERTAINMENT
  // ═══════════════════════════════════════════

  // Nightlife - Moon/crescent
  nightlife: (
    <>
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" strokeWidth={1.5} fill="none" stroke="currentColor" />
      <circle cx="8" cy="9" r="1" fill="currentColor" opacity={0.5} />
      <circle cx="12" cy="14" r="0.8" fill="currentColor" opacity={0.4} />
    </>
  ),

  // Club - Disco ball / sparkle
  club: (
    <>
      <circle cx="12" cy="12" r="7" strokeWidth={1.5} fill="none" stroke="currentColor" />
      <path d="M5 12h14M12 5v14" strokeWidth={1.5} stroke="currentColor" opacity={0.4} />
      <path d="M7 7l10 10M17 7L7 17" strokeWidth={1.5} stroke="currentColor" opacity={0.25} />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </>
  ),

  // Dance - Figure in motion
  dance: (
    <>
      <circle cx="12" cy="4" r="2.5" strokeWidth={1.5} fill="none" stroke="currentColor" />
      <path d="M12 7v5" strokeWidth={1.5} stroke="currentColor" />
      <path d="M8 10l4 2 4-2" strokeWidth={1.5} strokeLinecap="round" fill="none" stroke="currentColor" />
      <path d="M9 21l3-9 3 9" strokeWidth={1.5} strokeLinecap="round" fill="none" stroke="currentColor" />
    </>
  ),

  // Gaming - D-pad / controller
  gaming: (
    <>
      <rect x="3" y="7" width="18" height="10" rx="3" strokeWidth={1.5} fill="none" stroke="currentColor" />
      <path d="M7 10v4M5 12h4" strokeWidth={1.5} strokeLinecap="round" stroke="currentColor" />
      <circle cx="15" cy="11" r="1" fill="currentColor" />
      <circle cx="18" cy="13" r="1" fill="currentColor" opacity={0.6} />
    </>
  ),
  games: (
    <>
      <rect x="3" y="7" width="18" height="10" rx="3" strokeWidth={1.5} fill="none" stroke="currentColor" />
      <path d="M7 10v4M5 12h4" strokeWidth={1.5} strokeLinecap="round" stroke="currentColor" />
      <circle cx="15" cy="11" r="1" fill="currentColor" />
      <circle cx="18" cy="13" r="1" fill="currentColor" opacity={0.6} />
    </>
  ),

  // Eatertainment - Fork + play
  eatertainment: (
    <>
      <path d="M5 3v18M3 3v6a2 2 0 002 2M7 3v6a2 2 0 01-2 2" strokeWidth={1.5} strokeLinecap="round" stroke="currentColor" />
      <polygon points="15,6 15,18 21,12" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" />
    </>
  ),

  // ═══════════════════════════════════════════
  // SPORTS & FITNESS
  // ═══════════════════════════════════════════

  // Sports - Dynamic flame/victory burst (energy, not dusty trophy)
  sports: (
    <>
      <path d="M12 2c-2 3-4 5-4 8a4 4 0 008 0c0-3-2-5-4-8z" strokeWidth={1.5} fill="none" stroke="currentColor" />
      <path d="M12 6c-1 2-2 3-2 5a2 2 0 004 0c0-2-1-3-2-5z" fill="currentColor" opacity={0.4} />
      <path d="M8 16l-3 5M16 16l3 5M12 14v7" strokeWidth={1.5} strokeLinecap="round" stroke="currentColor" />
      <circle cx="5" cy="6" r="1" fill="currentColor" opacity={0.4} />
      <circle cx="19" cy="6" r="1" fill="currentColor" opacity={0.4} />
    </>
  ),

  // Arena - Stadium outline
  arena: (
    <>
      <ellipse cx="12" cy="16" rx="9" ry="4" strokeWidth={1.5} fill="none" stroke="currentColor" />
      <path d="M3 16V8a9 4 0 0118 0v8" strokeWidth={1.5} fill="none" stroke="currentColor" />
    </>
  ),

  // Fitness - Dumbbell (minimal)
  fitness: (
    <>
      <path d="M7 8v8M17 8v8M7 12h10" strokeWidth={2} strokeLinecap="round" stroke="currentColor" />
      <rect x="3" y="9" width="4" height="6" rx="1" strokeWidth={1.5} fill="none" stroke="currentColor" />
      <rect x="17" y="9" width="4" height="6" rx="1" strokeWidth={1.5} fill="none" stroke="currentColor" />
    </>
  ),
  fitness_center: (
    <>
      <path d="M7 8v8M17 8v8M7 12h10" strokeWidth={2} strokeLinecap="round" stroke="currentColor" />
      <rect x="3" y="9" width="4" height="6" rx="1" strokeWidth={1.5} fill="none" stroke="currentColor" />
      <rect x="17" y="9" width="4" height="6" rx="1" strokeWidth={1.5} fill="none" stroke="currentColor" />
    </>
  ),

  // Sports Bar - Screen + ball
  sports_bar: (
    <>
      <rect x="3" y="5" width="14" height="10" rx="1" strokeWidth={1.5} fill="none" stroke="currentColor" />
      <path d="M7 19h6M10 15v4" strokeWidth={1.5} strokeLinecap="round" stroke="currentColor" />
      <circle cx="19" cy="15" r="3" strokeWidth={1.5} fill="none" stroke="currentColor" />
      <path d="M17.5 13.5l3 3" strokeWidth={1.5} stroke="currentColor" opacity={0.5} />
    </>
  ),

  // Yoga / Studio - Lotus / balance
  yoga: (
    <>
      <circle cx="12" cy="6" r="3" strokeWidth={1.5} fill="none" stroke="currentColor" />
      <path d="M12 9v4" strokeWidth={1.5} stroke="currentColor" />
      <path d="M6 20c0-4 3-6 6-6s6 2 6 6" strokeWidth={1.5} strokeLinecap="round" fill="none" stroke="currentColor" />
      <path d="M8 17l-2 3M16 17l2 3" strokeWidth={1.5} strokeLinecap="round" stroke="currentColor" opacity={0.6} />
    </>
  ),
  studio: (
    <>
      <circle cx="12" cy="6" r="3" strokeWidth={1.5} fill="none" stroke="currentColor" />
      <path d="M12 9v4" strokeWidth={1.5} stroke="currentColor" />
      <path d="M6 20c0-4 3-6 6-6s6 2 6 6" strokeWidth={1.5} strokeLinecap="round" fill="none" stroke="currentColor" />
      <path d="M8 17l-2 3M16 17l2 3" strokeWidth={1.5} strokeLinecap="round" stroke="currentColor" opacity={0.6} />
    </>
  ),

  // Wellness - Leaf / organic
  wellness: (
    <>
      <path d="M12 22c-4-4-8-8-8-14C8 4 12 2 12 2s4 2 8 6c0 6-4 10-8 14z" strokeWidth={1.5} fill="none" stroke="currentColor" />
      <path d="M12 22V10" strokeWidth={1.5} stroke="currentColor" />
      <path d="M8 14c2-1 4-1 4 0" strokeWidth={1.5} strokeLinecap="round" fill="none" stroke="currentColor" opacity={0.5} />
    </>
  ),

  // ═══════════════════════════════════════════
  // COMMUNITY & SOCIAL
  // ═══════════════════════════════════════════

  // Community - Connected dots
  community: (
    <>
      <circle cx="12" cy="5" r="3" strokeWidth={1.5} fill="none" stroke="currentColor" />
      <circle cx="5" cy="18" r="3" strokeWidth={1.5} fill="none" stroke="currentColor" />
      <circle cx="19" cy="18" r="3" strokeWidth={1.5} fill="none" stroke="currentColor" />
      <path d="M12 8v4M9 16l-2-2M15 16l2-2" strokeWidth={1.5} stroke="currentColor" opacity={0.5} />
    </>
  ),

  // Meetup - Two people
  meetup: (
    <>
      <circle cx="8" cy="6" r="3" strokeWidth={1.5} fill="none" stroke="currentColor" />
      <circle cx="16" cy="6" r="3" strokeWidth={1.5} fill="none" stroke="currentColor" />
      <path d="M2 20c0-4 3-6 6-6M22 20c0-4-3-6-6-6" strokeWidth={1.5} strokeLinecap="round" fill="none" stroke="currentColor" />
      <path d="M8 14h8" strokeWidth={1.5} stroke="currentColor" opacity={0.4} />
    </>
  ),

  // Family - Connected figures (warmth through connection, not clipart house)
  family: (
    <>
      <circle cx="12" cy="5" r="2.5" strokeWidth={1.5} fill="none" stroke="currentColor" />
      <circle cx="6" cy="9" r="2" strokeWidth={1.5} fill="none" stroke="currentColor" />
      <circle cx="18" cy="9" r="2" strokeWidth={1.5} fill="none" stroke="currentColor" />
      <path d="M12 8v3M6 11v2M18 11v2" strokeWidth={1.5} stroke="currentColor" />
      <path d="M4 21c0-3 2-5 4-5h2c1 0 2 .5 2 1.5S11 19 12 19s1-.5 1-1.5.5-1.5 2-1.5h2c2 0 4 2 4 5" strokeWidth={1.5} strokeLinecap="round" fill="none" stroke="currentColor" />
    </>
  ),

  // Community Center - Building with people
  community_center: (
    <>
      <path d="M4 21V8l8-5 8 5v13" strokeWidth={1.5} strokeLinejoin="round" fill="none" stroke="currentColor" />
      <circle cx="12" cy="11" r="2" strokeWidth={1.5} fill="none" stroke="currentColor" />
      <path d="M9 21v-4h6v4" strokeWidth={1.5} fill="none" stroke="currentColor" />
    </>
  ),

  // LGBTQ+ - Rainbow arc
  lgbtq: (
    <>
      <path d="M4 18A8 8 0 0120 18" strokeWidth={2} strokeLinecap="round" fill="none" stroke="currentColor" />
      <path d="M6 18A6 6 0 0118 18" strokeWidth={2} strokeLinecap="round" fill="none" stroke="currentColor" opacity={0.7} />
      <path d="M8 18A4 4 0 0116 18" strokeWidth={2} strokeLinecap="round" fill="none" stroke="currentColor" opacity={0.4} />
    </>
  ),

  // Activism - Raised fist
  activism: (
    <>
      <path d="M12 21v-4" strokeWidth={1.5} stroke="currentColor" />
      <path d="M8 21h8" strokeWidth={1.5} strokeLinecap="round" stroke="currentColor" />
      <path d="M9 17V9a1 1 0 012 0v3M11 9V6a1 1 0 012 0v6M13 7V5a1 1 0 012 0v7M15 9V8a1 1 0 012 0v5c0 2.5-1.5 4-4 4h-2c-2.5 0-4-1.5-4-4v-2a1 1 0 012 0v1" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor" />
    </>
  ),

  // ═══════════════════════════════════════════
  // LEARNING & WORDS
  // ═══════════════════════════════════════════

  // Learning - Graduation cap
  learning: (
    <>
      <path d="M2 10l10-5 10 5-10 5-10-5z" strokeWidth={1.5} strokeLinejoin="round" fill="none" stroke="currentColor" />
      <path d="M6 12v5c0 2 3 4 6 4s6-2 6-4v-5" strokeWidth={1.5} fill="none" stroke="currentColor" />
      <path d="M22 10v6" strokeWidth={1.5} strokeLinecap="round" stroke="currentColor" />
    </>
  ),
  college: (
    <>
      <path d="M2 10l10-5 10 5-10 5-10-5z" strokeWidth={1.5} strokeLinejoin="round" fill="none" stroke="currentColor" />
      <path d="M6 12v5c0 2 3 4 6 4s6-2 6-4v-5" strokeWidth={1.5} fill="none" stroke="currentColor" />
      <path d="M22 10v6" strokeWidth={1.5} strokeLinecap="round" stroke="currentColor" />
    </>
  ),
  university: (
    <>
      <path d="M2 10l10-5 10 5-10 5-10-5z" strokeWidth={1.5} strokeLinejoin="round" fill="none" stroke="currentColor" />
      <path d="M6 12v5c0 2 3 4 6 4s6-2 6-4v-5" strokeWidth={1.5} fill="none" stroke="currentColor" />
      <path d="M22 10v6" strokeWidth={1.5} strokeLinecap="round" stroke="currentColor" />
    </>
  ),

  // Words / Bookstore - Open book
  words: (
    <>
      <path d="M2 4h7c2 0 3 1 3 2v15c-1-1-2-1-3-1H2V4z" strokeWidth={1.5} strokeLinejoin="round" fill="none" stroke="currentColor" />
      <path d="M22 4h-7c-2 0-3 1-3 2v15c1-1 2-1 3-1h7V4z" strokeWidth={1.5} strokeLinejoin="round" fill="none" stroke="currentColor" />
    </>
  ),
  bookstore: (
    <>
      <path d="M2 4h7c2 0 3 1 3 2v15c-1-1-2-1-3-1H2V4z" strokeWidth={1.5} strokeLinejoin="round" fill="none" stroke="currentColor" />
      <path d="M22 4h-7c-2 0-3 1-3 2v15c1-1 2-1 3-1h7V4z" strokeWidth={1.5} strokeLinejoin="round" fill="none" stroke="currentColor" />
    </>
  ),

  // Library - Books on shelf
  library: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="1" strokeWidth={1.5} fill="none" stroke="currentColor" />
      <path d="M7 3v18M11 3v18M16 3v18" strokeWidth={1.5} stroke="currentColor" />
      <path d="M3 14h18" strokeWidth={1.5} stroke="currentColor" opacity={0.4} />
    </>
  ),

  // Coworking - Laptop
  coworking: (
    <>
      <rect x="4" y="5" width="16" height="11" rx="1" strokeWidth={1.5} fill="none" stroke="currentColor" />
      <path d="M2 19h20" strokeWidth={1.5} strokeLinecap="round" stroke="currentColor" />
      <path d="M4 16l-1 3M20 16l1 3" strokeWidth={1.5} strokeLinecap="round" stroke="currentColor" />
    </>
  ),

  // ═══════════════════════════════════════════
  // OUTDOORS & NATURE
  // ═══════════════════════════════════════════

  // Outdoors - Mountain peak
  outdoors: (
    <>
      <path d="M3 20L10 6l4 8 4-4 4 10H3z" strokeWidth={1.5} strokeLinejoin="round" fill="none" stroke="currentColor" />
      <circle cx="18" cy="5" r="2" strokeWidth={1.5} fill="none" stroke="currentColor" />
    </>
  ),
  outdoor: (
    <>
      <path d="M3 20L10 6l4 8 4-4 4 10H3z" strokeWidth={1.5} strokeLinejoin="round" fill="none" stroke="currentColor" />
      <circle cx="18" cy="5" r="2" strokeWidth={1.5} fill="none" stroke="currentColor" />
    </>
  ),

  // Park - Tree (minimal)
  park: (
    <>
      <path d="M12 22v-8" strokeWidth={1.5} stroke="currentColor" />
      <path d="M12 2L6 10h3L5 16h14l-4-6h3L12 2z" strokeWidth={1.5} strokeLinejoin="round" fill="none" stroke="currentColor" />
    </>
  ),

  // Garden - Flower
  garden: (
    <>
      <circle cx="12" cy="8" r="4" strokeWidth={1.5} fill="none" stroke="currentColor" />
      <path d="M12 12v10" strokeWidth={1.5} stroke="currentColor" />
      <path d="M8 6c-2-1-4 0-4 2s2 3 4 2" strokeWidth={1.5} fill="none" stroke="currentColor" opacity={0.6} />
      <path d="M16 6c2-1 4 0 4 2s-2 3-4 2" strokeWidth={1.5} fill="none" stroke="currentColor" opacity={0.6} />
    </>
  ),

  // ═══════════════════════════════════════════
  // TOURS & TRAVEL
  // ═══════════════════════════════════════════

  // Tours - Compass
  tours: (
    <>
      <circle cx="12" cy="12" r="9" strokeWidth={1.5} fill="none" stroke="currentColor" />
      <polygon points="12,3 14,12 12,10 10,12" fill="currentColor" />
      <polygon points="12,21 10,12 12,14 14,12" fill="currentColor" opacity={0.4} />
    </>
  ),

  // Hotel - Bed
  hotel: (
    <>
      <path d="M3 18v-5a2 2 0 012-2h14a2 2 0 012 2v5" strokeWidth={1.5} fill="none" stroke="currentColor" />
      <path d="M3 18h18v2H3v-2z" strokeWidth={1.5} fill="none" stroke="currentColor" />
      <circle cx="7" cy="8" r="2" strokeWidth={1.5} fill="none" stroke="currentColor" />
      <path d="M3 11V7" strokeWidth={1.5} strokeLinecap="round" stroke="currentColor" />
    </>
  ),

  // Rooftop - Building with star
  rooftop: (
    <>
      <path d="M4 21V9l8-6 8 6v12" strokeWidth={1.5} strokeLinejoin="round" fill="none" stroke="currentColor" />
      <path d="M9 21v-6h6v6" strokeWidth={1.5} fill="none" stroke="currentColor" />
      <circle cx="12" cy="3" r="1.5" fill="currentColor" />
      <circle cx="6" cy="5" r="1" fill="currentColor" opacity={0.5} />
      <circle cx="18" cy="5" r="1" fill="currentColor" opacity={0.5} />
    </>
  ),

  // ═══════════════════════════════════════════
  // VENUES & SPACES
  // ═══════════════════════════════════════════

  // Venue - Neon sign / destination beacon (not generic map pin)
  venue: (
    <>
      <rect x="5" y="3" width="14" height="14" rx="2" strokeWidth={1.5} fill="none" stroke="currentColor" />
      <path d="M5 9h14" strokeWidth={1.5} stroke="currentColor" opacity={0.4} />
      <circle cx="12" cy="13" r="2" fill="currentColor" />
      <path d="M12 17v4M9 21h6" strokeWidth={1.5} strokeLinecap="round" stroke="currentColor" />
      <path d="M8 6h.01M12 6h.01M16 6h.01" strokeWidth={2} strokeLinecap="round" stroke="currentColor" opacity={0.6} />
    </>
  ),

  // Event Space - Sparkle
  event_space: (
    <>
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" strokeWidth={1.5} strokeLinecap="round" stroke="currentColor" />
      <path d="M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" strokeWidth={1.5} strokeLinecap="round" stroke="currentColor" opacity={0.6} />
      <circle cx="12" cy="12" r="3" fill="currentColor" />
    </>
  ),

  // Convention Center - Grid building
  convention_center: (
    <>
      <rect x="3" y="6" width="18" height="14" rx="1" strokeWidth={1.5} fill="none" stroke="currentColor" />
      <path d="M9 3v3M15 3v3" strokeWidth={1.5} strokeLinecap="round" stroke="currentColor" />
      <path d="M3 11h18M9 6v14M15 6v14" strokeWidth={1.5} stroke="currentColor" opacity={0.4} />
    </>
  ),

  // Organization - Building with window
  organization: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="1" strokeWidth={1.5} fill="none" stroke="currentColor" />
      <rect x="8" y="7" width="3" height="3" strokeWidth={1.5} fill="none" stroke="currentColor" />
      <rect x="13" y="7" width="3" height="3" strokeWidth={1.5} fill="none" stroke="currentColor" />
      <path d="M10 21v-6h4v6" strokeWidth={1.5} fill="none" stroke="currentColor" />
    </>
  ),

  // Festival - Tent / flag
  festival: (
    <>
      <path d="M3 20l9-16 9 16H3z" strokeWidth={1.5} strokeLinejoin="round" fill="none" stroke="currentColor" />
      <path d="M12 4v16" strokeWidth={1.5} stroke="currentColor" />
      <path d="M7 12h10" strokeWidth={1.5} stroke="currentColor" opacity={0.4} />
    </>
  ),

  // Markets - Shopping bag
  markets: (
    <>
      <path d="M5 7l2-4h10l2 4v12a2 2 0 01-2 2H7a2 2 0 01-2-2V7z" strokeWidth={1.5} fill="none" stroke="currentColor" />
      <path d="M5 7h14" strokeWidth={1.5} stroke="currentColor" />
      <path d="M9 10v3a3 3 0 006 0v-3" strokeWidth={1.5} strokeLinecap="round" fill="none" stroke="currentColor" />
    </>
  ),

  // ═══════════════════════════════════════════
  // RELIGIOUS & SPIRITUAL
  // ═══════════════════════════════════════════

  // Religious - Cross / steeple
  religious: (
    <>
      <path d="M12 2v6M9 5h6" strokeWidth={1.5} strokeLinecap="round" stroke="currentColor" />
      <path d="M5 21V10l7-2 7 2v11" strokeWidth={1.5} strokeLinejoin="round" fill="none" stroke="currentColor" />
      <path d="M9 21v-5h6v5" strokeWidth={1.5} fill="none" stroke="currentColor" />
    </>
  ),
  church: (
    <>
      <path d="M12 2v6M9 5h6" strokeWidth={1.5} strokeLinecap="round" stroke="currentColor" />
      <path d="M5 21V10l7-2 7 2v11" strokeWidth={1.5} strokeLinejoin="round" fill="none" stroke="currentColor" />
      <path d="M9 21v-5h6v5" strokeWidth={1.5} fill="none" stroke="currentColor" />
    </>
  ),

  // ═══════════════════════════════════════════
  // SPECIAL
  // ═══════════════════════════════════════════

  // Haunted / Attraction - Ghost
  haunted: (
    <>
      <path d="M12 2C8 2 5 5 5 9v11l2.5-2 2 2 2.5-2 2.5 2 2-2 2.5 2V9c0-4-3-7-7-7z" strokeWidth={1.5} strokeLinejoin="round" fill="none" stroke="currentColor" />
      <circle cx="9" cy="10" r="1.5" fill="currentColor" />
      <circle cx="15" cy="10" r="1.5" fill="currentColor" />
    </>
  ),
  attraction: (
    <>
      <path d="M12 2C8 2 5 5 5 9v11l2.5-2 2 2 2.5-2 2.5 2 2-2 2.5 2V9c0-4-3-7-7-7z" strokeWidth={1.5} strokeLinejoin="round" fill="none" stroke="currentColor" />
      <circle cx="9" cy="10" r="1.5" fill="currentColor" />
      <circle cx="15" cy="10" r="1.5" fill="currentColor" />
    </>
  ),

  // Healthcare / Hospital - Plus / medical
  healthcare: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" strokeWidth={1.5} fill="none" stroke="currentColor" />
      <path d="M12 8v8M8 12h8" strokeWidth={2} strokeLinecap="round" stroke="currentColor" />
    </>
  ),
  hospital: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" strokeWidth={1.5} fill="none" stroke="currentColor" />
      <path d="M12 8v8M8 12h8" strokeWidth={2} strokeLinecap="round" stroke="currentColor" />
    </>
  ),

  // Other - Abstract intersection (mysterious, not generic star)
  other: (
    <>
      <circle cx="12" cy="12" r="8" strokeWidth={1.5} fill="none" stroke="currentColor" opacity={0.4} />
      <path d="M12 4v16M4 12h16" strokeWidth={1.5} stroke="currentColor" opacity={0.6} />
      <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" strokeWidth={1.5} stroke="currentColor" opacity={0.3} />
      <circle cx="12" cy="12" r="3" strokeWidth={1.5} fill="none" stroke="currentColor" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </>
  ),
};

// Default icon for unknown types - abstract pulse point
const defaultIcon = (
  <>
    <circle cx="12" cy="12" r="8" strokeWidth={1.5} fill="none" stroke="currentColor" opacity={0.5} />
    <circle cx="12" cy="12" r="4" strokeWidth={1.5} fill="none" stroke="currentColor" opacity={0.7} />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    <path d="M12 4v2M12 18v2M4 12h2M18 12h2" strokeWidth={1.5} strokeLinecap="round" stroke="currentColor" opacity={0.4} />
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
