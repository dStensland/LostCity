/**
 * Shared profile types for the community/friends feature.
 * Client-safe — no server imports.
 */

export type FriendProfile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
};

export type SuggestedProfile = FriendProfile & {
  mutual_friends_count?: number;
  suggestion_reason?: "mutual_friends" | "shared_interests" | "similar_activity" | "popular";
};

export type FriendRequest = {
  id: string;
  inviter_id: string;
  invitee_id: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
  responded_at: string | null;
  inviter?: FriendProfile | null;
  invitee?: FriendProfile | null;
};

// ============================================================================
// Privacy + Public Profile
// ============================================================================

export type PrivacyMode = "low_key" | "social" | "open_book";

/**
 * Venue summary returned as part of regular_spots on a public profile.
 * Comes from the user_regular_spots junction table joined with venues.
 */
export interface RegularSpotVenue {
  venue_id: number;
  name: string;
  slug: string | null;
  neighborhood: string | null;
  image_url: string | null;
}

/**
 * The public-facing profile shape returned from /api/profiles/[username].
 * Fields marked optional may be absent depending on the viewer's relationship
 * to the profile owner and the owner's privacy_mode setting.
 *
 * interests: sourced from user_preferences.favorite_categories (not a profile column)
 * regular_spots: sourced from user_regular_spots junction table (venue objects, not IDs)
 */
/**
 * Active hang summary returned as part of a public profile.
 * Privacy-gated: visibility depends on both profile privacy_mode
 * and the hang's own visibility setting.
 */
export interface CurrentHang {
  venue_name: string;
  venue_slug: string | null;
  venue_neighborhood: string | null;
  started_at: string;
  note: string | null;
  visibility: "private" | "friends" | "public";
}

export interface PublicProfile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  city_moment_url: string | null;
  city_moment_thumbnail_url: string | null;
  privacy_mode: PrivacyMode;
  created_at: string;
  hang_count: number;
  friend_count: number;
  is_own?: boolean;
  // Conditionally present — gated by privacy tier and friend status
  bio?: string | null;
  location?: string | null;
  website?: string | null;
  interests?: string[];
  regular_spots?: RegularSpotVenue[];
  portal_activity?: PortalActivity[];
  current_hang?: CurrentHang | null;
}

/**
 * Compact representation for profile cards on hangs, venue pages, etc.
 */
export interface ProfileCardData {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  is_friend: boolean;
  interests: string[];
  note?: string | null;
}

/**
 * Per-portal activity summary, shown on a user's profile when privacy allows.
 */
export interface PortalActivity {
  portal_id: string;
  portal_slug: string;
  portal_name: string;
  hang_count: number;
}

// ============================================================================
// Privacy Mode Metadata
// ============================================================================

export const PRIVACY_MODES: Record<
  PrivacyMode,
  { label: string; description: string; icon: string }
> = {
  low_key: {
    label: "Low-key",
    description: "Name and photo visible. Everything else is friends-only.",
    icon: "eye-off",
  },
  social: {
    label: "Social",
    description: "Interests and portals public. Hangs and spots visible to friends.",
    icon: "users",
  },
  open_book: {
    label: "Open Book",
    description: "Everything public except hang history.",
    icon: "globe",
  },
} as const;

// ============================================================================
// Limits
// ============================================================================

export const MAX_INTERESTS = 20;
export const MAX_INTEREST_LENGTH = 50;
export const MAX_REGULAR_SPOTS = 10;
