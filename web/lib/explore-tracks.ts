// ============================================================================
// Explore City Tracks - Types and Constants
// Server-safe module (no supabase imports)
// ============================================================================

/** Featured event surfaced on a track banner */
export type ExploreTrackFeaturedEvent = {
  title: string;
  date: string;
  time: string | null;
  venueName: string;
  isFree: boolean;
};

/** Upcoming event row for a venue in track detail */
export type ExploreVenueEvent = {
  id: number;
  title: string;
  startDate: string;
  startTime: string | null;
  endTime: string | null;
  category: string | null;
  isFree: boolean;
  priceMin: number | null;
  priceMax: number | null;
  isTonight: boolean;
};

/** Track definition as stored in DB */
export type ExploreTrack = {
  id: string;
  slug: string;
  name: string;
  quote: string;
  quoteSource: string;
  quotePortraitUrl: string | null;
  description: string | null;
  bannerImageUrl: string | null;
  sortOrder: number;
  venueCount: number;
  previewVenues: ExploreTrackVenuePreview[];
  // Enriched activity data for Comp D2
  tonightCount: number;
  weekendCount: number;
  freeCount: number;
  featuredEvent: ExploreTrackFeaturedEvent | null;
  accentColor: string;
};

/** Venue preview shown on track cards */
export type ExploreTrackVenuePreview = {
  id: number;
  name: string;
  slug: string | null;
  neighborhood: string | null;
  imageUrl: string | null;
  upvoteCount: number;
  upcomingEventCount: number;
};

/** Venue highlight surfaced on track venue cards */
export type ExploreVenueHighlight = {
  id: number;
  highlightType: string;
  title: string;
  description: string | null;
};

/** Full venue within a track detail */
export type ExploreTrackVenue = {
  id: string; // track_venue join ID
  venueId: number;
  name: string;
  slug: string | null;
  neighborhood: string | null;
  imageUrl: string | null;
  editorialBlurb: string | null;
  sourceUrl: string | null;
  sourceLabel: string | null;
  upvoteCount: number;
  hasUpvoted: boolean;
  isFeatured: boolean;
  aliveBadge: AliveBadge | null;
  topTip: ExploreTipPreview | null;
  upcomingEvents: ExploreVenueEvent[];
  venueType: string | null;
  highlights: ExploreVenueHighlight[];
};

/** Alive badge for venue cards */
export type AliveBadge = {
  type: "now" | "upcoming" | "seasonal";
  label: string;
  detail: string | null;
};

/** Tip preview shown on venue cards */
export type ExploreTipPreview = {
  id: string;
  content: string;
  author: TipAuthor;
  upvoteCount: number;
  hasUpvoted: boolean;
};

/** Full tip in tips sheet */
export type ExploreTip = {
  id: string;
  content: string;
  author: TipAuthor;
  upvoteCount: number;
  hasUpvoted: boolean;
  createdAt: string;
};

export type TipAuthor = {
  id: string;
  username: string;
  isVerifiedVisitor: boolean;
};

/** Track detail response */
export type ExploreTrackDetail = {
  id: string;
  slug: string;
  name: string;
  quote: string;
  quoteSource: string;
  quotePortraitUrl: string | null;
  description: string | null;
  venues: ExploreTrackVenue[];
};

/** Suggestion payload */
export type ExploreSuggestion = {
  trackId: string;
  venueId?: number;
  venueName: string;
  reason: string;
};

// ============================================================================
// Track slug constants
// ============================================================================

export const TRACK_SLUGS = [
  "welcome-to-atlanta",
  "good-trouble",
  "the-south-got-something-to-say",
  "keep-moving-forward",
  "the-itis",
  "city-in-a-forest",
  "hard-in-da-paint",
  "a-beautiful-mosaic",
  "too-busy-to-hate",
  "the-midnight-train",
  "keep-swinging",
  "lifes-like-a-movie",
  "say-less",
  "yallywood",
  "spelhouse-spirit",
  "resurgens",
  "up-on-the-roof",
  "artefacts-of-the-lost-city",
  "not-from-around-here",
  "as-seen-on-tv",
  "comedy-live",
  "native-heritage",
  "hell-of-an-engineer",
] as const;

export type TrackSlug = (typeof TRACK_SLUGS)[number];

// ============================================================================
// Design tokens for the Explore dark theme
// ============================================================================

export const EXPLORE_THEME = {
  bg: "#0E0E0E",
  primary: "#C1D32F", // Hawks Volt Green
  secondary: "#E03A3E", // Torch Red
  neon: "#39FF14", // Pure neon highlight
  text: "#FFFFFF",
  muted: "#A0A0A0",
  card: "#1A1A1A",
  cardBorder: "#2A2A2A",
} as const;

// ============================================================================
// Flag reasons
// ============================================================================

export const FLAG_REASONS = ["spam", "offensive", "irrelevant", "other"] as const;
export type FlagReason = (typeof FLAG_REASONS)[number];

// ============================================================================
// Tip status values
// ============================================================================

export const TIP_STATUSES = ["pending", "approved", "rejected", "flagged"] as const;
export type TipStatus = (typeof TIP_STATUSES)[number];

// ============================================================================
// Track accent colors — per-track identity for cinematic banners
// ============================================================================

export const TRACK_ACCENT_COLORS: Record<string, string> = {
  "welcome-to-atlanta": "#C1D32F",       // Hawks Volt Green — classic Atlanta
  "good-trouble": "#E03A3E",             // Civil rights red
  "the-south-got-something-to-say": "#D4A574", // Warm brown — music heritage
  "keep-moving-forward": "#10B981",      // BeltLine green
  "the-itis": "#FB923C",                 // Food orange
  "city-in-a-forest": "#34D399",         // Forest emerald
  "hard-in-da-paint": "#14B8A6",         // Teal — street art & local art
  "a-beautiful-mosaic": "#8B5CF6",       // Diverse violet
  "too-busy-to-hate": "#EAB308",         // Progress gold
  "the-midnight-train": "#A78BFA",       // Purple — quirky & hidden gems
  "keep-swinging": "#F472B6",            // Pink — sports & game day
  "lifes-like-a-movie": "#F59E0B",       // Warm amber — family & kids
  "say-less": "#D97706",                 // Deep amber — speakeasy warmth
  "yallywood": "#EF4444",                // Cinema red
  "spelhouse-spirit": "#9F1239",         // Morehouse maroon
  "resurgens": "#D4AF37",               // Architectural gold — BoA Plaza spire
  "up-on-the-roof": "#38BDF8",          // Sky blue — rooftop views
  "artefacts-of-the-lost-city": "#FB923C",       // Warm orange — curiosities & artifacts
  "not-from-around-here": "#E07C4F",             // Warm terracotta — global spice
  "as-seen-on-tv": "#60A5FA",                    // Screen blue — TV/film locations
  "comedy-live": "#FBBF24",                      // Spotlight gold — stage lights
  "native-heritage": "#92400E",                  // Earth brown — ancient land
  "hell-of-an-engineer": "#B89B5E",              // Old gold — GT colors
} as const;

export function getTrackAccentColor(slug: string): string {
  return TRACK_ACCENT_COLORS[slug] ?? EXPLORE_THEME.primary;
}

// ============================================================================
// Track category labels — descriptive subtitle shown on banners
// ============================================================================

export const TRACK_CATEGORIES: Record<string, string> = {
  "welcome-to-atlanta": "Classic Atlanta",
  "good-trouble": "Civil Rights Heritage",
  "the-south-got-something-to-say": "Dirty South",
  "keep-moving-forward": "The BeltLine",
  "the-itis": "Food Scene",
  "city-in-a-forest": "Great Outdoors",
  "hard-in-da-paint": "Street Art & Local Art",
  "a-beautiful-mosaic": "Global Atlanta",
  "too-busy-to-hate": "LGBTQ+ Culture",
  "the-midnight-train": "Weird Spots for Freaks",
  "keep-swinging": "Sports & Game Day",
  "lifes-like-a-movie": "Family & Kids",
  "say-less": "Speakeasy & Cocktails",
  "yallywood": "Cinema",
  "spelhouse-spirit": "HBCU Culture",
  "resurgens": "Skyline & Architecture",
  "up-on-the-roof": "Rooftop & Skyline Views",
  "artefacts-of-the-lost-city": "Artefacts & Curiosities",
  "not-from-around-here": "International & Regional Eats",
  "as-seen-on-tv": "Filming Locations",
  "comedy-live": "Comedy & Live Performance",
  "native-heritage": "Creek & Cherokee Heritage",
  "hell-of-an-engineer": "Georgia Tech",
} as const;

export function getTrackCategory(slug: string): string {
  return TRACK_CATEGORIES[slug] ?? "Explore";
}

// ============================================================================
// Semantic pill colors — distinct from track accent, tied to pill meaning
// ============================================================================

export const PILL_COLORS = {
  tonight: { bg: "rgba(224,58,62,0.15)", border: "rgba(224,58,62,0.3)", text: "#E03A3E" },
  weekend: { bg: "rgba(193,211,47,0.1)", border: "rgba(193,211,47,0.2)", text: "#C1D32F" },
  free: { bg: "rgba(52,211,153,0.1)", border: "rgba(52,211,153,0.2)", text: "#34D399" },
  seasonal: { bg: "rgba(251,146,60,0.12)", border: "rgba(251,146,60,0.25)", text: "#FB923C" },
  default: { bg: "rgba(255,255,255,0.06)", border: "rgba(255,255,255,0.06)", text: "rgba(255,255,255,0.4)" },
} as const;

export type PillType = keyof typeof PILL_COLORS;
