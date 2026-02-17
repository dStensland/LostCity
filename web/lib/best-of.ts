// ============================================================================
// Best Of Leaderboards — Types and Constants
// Server-safe module (no supabase imports)
// ============================================================================

/** Category definition as stored in DB */
export type BestOfCategory = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  isActive: boolean;
  sortOrder: number;
};

/** Author of a case blurb */
export type CaseAuthor = {
  id: string;
  username: string;
  avatarUrl: string | null;
};

/** Case preview shown inline on venue cards */
export type BestOfCasePreview = {
  id: string;
  content: string;
  author: CaseAuthor;
  upvoteCount: number;
  hasUpvoted: boolean;
};

/** Full case with metadata */
export type BestOfCase = BestOfCasePreview & {
  venueId: number;
  createdAt: string;
};

/** Ranked venue within a leaderboard */
export type BestOfRankedVenue = {
  venueId: number;
  name: string;
  slug: string | null;
  neighborhood: string | null;
  imageUrl: string | null;
  venueType: string | null;
  rank: number;
  algorithmScore: number;
  voteCount: number;
  totalScore: number;
  topCase: BestOfCasePreview | null;
  caseCount: number;
  hasVoted: boolean;
};

/** Compact venue preview for category grid cards */
export type BestOfVenuePreview = {
  venueId: number;
  name: string;
  imageUrl: string | null;
  neighborhood: string | null;
  score: number;
};

/** Full leaderboard response */
export type BestOfLeaderboardData = {
  category: BestOfCategory;
  venues: BestOfRankedVenue[];
  userVoteVenueId: number | null;
  totalVotes: number;
};

// ============================================================================
// Case constraints
// ============================================================================

export const CASE_MIN_LENGTH = 30;
export const CASE_MAX_LENGTH = 280;

// ============================================================================
// Category accent colors — warm, inviting palette for each category
// ============================================================================

export const CATEGORY_COLORS: Record<string, string> = {
  "where-you-end-up-at-1am": "#7B6FFF",     // Neon indigo — after midnight
  "medium-effort-first-date": "#E855A0",     // Neon magenta — romance-ish
  "cool-patio": "#00D9A0",                   // Neon green — outdoor
  "place-to-hear-a-band": "#B06AFF",         // Neon purple — stage lights
  "underrated-kitchen": "#FF8A50",           // Neon orange — sleeper hit
  "the-cheers-bar": "#F5A623",              // Neon amber — bar sign glow
  "out-of-towner-converter": "#00D4E8",      // Neon cyan — show-off energy
  "third-place": "#FFD23F",                  // Neon gold — warm belonging
  "where-you-find-local-art": "#E855E8",     // Neon fuchsia — creative
  "in-this-economy": "#FF6B7A",               // Neon rose — free spirit
} as const;

export function getCategoryColor(slug: string): string {
  return CATEGORY_COLORS[slug] ?? "#C1D32F";
}


// ============================================================================
// Rank badge colors
// ============================================================================

export const RANK_COLORS = {
  1: "#FFD700", // Gold
  2: "#C0C0C0", // Silver
  3: "#CD7F32", // Bronze
} as const;

export function getRankColor(rank: number): string {
  return (RANK_COLORS as Record<number, string>)[rank] ?? "#666666";
}

