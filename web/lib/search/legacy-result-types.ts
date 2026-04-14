/**
 * LEGACY search result types — temporary bridge for Phase 0.5 cleanup.
 *
 * These shapes originated in `lib/unified-search.ts` and are still referenced
 * by legacy UI components (HeaderSearchButton, MobileSearchOverlay,
 * ExploreSearchResults, FindSearchInput, etc.) that are scheduled for deletion
 * in the Phase 0.5 cascade.
 *
 * Do NOT import these types from new code. The canonical three-layer search
 * contract lives in `lib/search/types.ts`. When every legacy consumer has been
 * deleted, this file goes with them.
 */

export interface SearchResult {
  id: number | string;
  type:
    | "event"
    | "venue"
    | "organizer"
    | "series"
    | "list"
    | "neighborhood"
    | "category"
    | "festival"
    | "program"
    | "exhibition";
  title: string;
  subtitle?: string;
  href: string;
  score: number;
  metadata?: {
    date?: string;
    time?: string;
    neighborhood?: string;
    category?: string;
    isLive?: boolean;
    isFree?: boolean;
    venueType?: string;
    vibes?: string[];
    orgType?: string;
    eventCount?: number;
    followerCount?: number;
    rsvpCount?: number;
    recommendationCount?: number;
    // Series-specific
    seriesType?: string;
    nextEventDate?: string;
    // List-specific
    itemCount?: number;
    curatorName?: string;
    // Venue-specific ranking signals
    featured?: boolean;
    exploreFeatured?: boolean;
    dataQuality?: number;
    isEventVenue?: boolean;
    // Program-specific
    programType?: string;
    ageMin?: number;
    ageMax?: number;
    registrationStatus?: string;
    sessionStart?: string;
    sessionEnd?: string;
  };
}

export interface SearchFacet {
  type:
    | "event"
    | "venue"
    | "organizer"
    | "series"
    | "list"
    | "festival"
    | "program"
    | "exhibition";
  count: number;
}

export interface UnifiedSearchResponse {
  results: SearchResult[];
  facets: SearchFacet[];
  total: number;
  didYouMean?: string[];
}
