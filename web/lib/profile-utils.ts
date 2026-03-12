/**
 * Client-safe profile helper functions.
 * No server imports — safe to use in "use client" components.
 *
 * Types live in lib/types/profile.ts.
 */

import type { PrivacyMode } from "@/lib/types/profile";

// ============================================================================
// Profile completeness
// ============================================================================

/**
 * A profile is "complete" when it has both a display name and an avatar.
 * Used to prompt users to finish onboarding.
 */
export function isProfileComplete(profile: {
  display_name?: string | null;
  avatar_url?: string | null;
}): boolean {
  return Boolean(profile.display_name?.trim()) && Boolean(profile.avatar_url?.trim());
}

// ============================================================================
// Privacy-gated field visibility
// ============================================================================

/**
 * Determine whether a given profile field is visible to the current viewer,
 * based on the profile owner's privacy_mode and the viewer's relationship.
 *
 * This mirrors the DB-level visibility logic in get_public_profile() so
 * client components can conditionally render field values.
 *
 * Field visibility by mode:
 *
 * | Field            | low_key       | social          | open_book   |
 * |------------------|---------------|-----------------|-------------|
 * | bio              | friends+owner | anyone          | anyone      |
 * | interests        | friends+owner | anyone          | anyone      |
 * | regular_spots    | friends+owner | friends+owner   | anyone      |
 * | website          | friends+owner | friends+owner   | anyone      |
 * | location         | friends+owner | anyone          | anyone      |
 * | portal_activity  | friends+owner | anyone          | anyone      |
 */
export function canViewField(
  field: "bio" | "interests" | "regular_spots" | "website" | "location" | "portal_activity",
  privacyMode: PrivacyMode,
  isFriend: boolean,
  isOwner: boolean,
): boolean {
  if (isOwner) return true;

  switch (privacyMode) {
    case "low_key":
      // All extended fields are friends-only
      return isFriend;

    case "social":
      // regular_spots + website are friends-only; everything else is public
      if (field === "regular_spots" || field === "website") return isFriend;
      return true;

    case "open_book":
      // Everything is public
      return true;
  }
}

// ============================================================================
// Interest pill colors
// ============================================================================

/**
 * Map an interest string to a design-system accent color CSS variable.
 * Used for coloring interest pills on profile cards.
 *
 * Returns a CSS variable reference suitable for Tailwind arbitrary values,
 * e.g. `bg-[var(--coral)]`.
 */
export function getInterestColor(interest: string): string {
  const lower = interest.toLowerCase();

  // Music-adjacent
  if (
    lower.includes("music") ||
    lower.includes("concert") ||
    lower.includes("jazz") ||
    lower.includes("band")
  ) {
    return "var(--vibe)"; // indigo/purple
  }

  // Comedy / performance
  if (
    lower.includes("comedy") ||
    lower.includes("improv") ||
    lower.includes("standup") ||
    lower.includes("theater") ||
    lower.includes("theatre")
  ) {
    return "var(--coral)"; // brand red-pink
  }

  // Outdoors / nature
  if (
    lower.includes("outdoor") ||
    lower.includes("hiking") ||
    lower.includes("trail") ||
    lower.includes("nature") ||
    lower.includes("park") ||
    lower.includes("camping") ||
    lower.includes("climbing")
  ) {
    return "var(--neon-green)"; // success/nature green
  }

  // Food & drink
  if (
    lower.includes("food") ||
    lower.includes("beer") ||
    lower.includes("brew") ||
    lower.includes("wine") ||
    lower.includes("cocktail") ||
    lower.includes("dining") ||
    lower.includes("coffee")
  ) {
    return "var(--gold)"; // warm amber
  }

  // Art & culture
  if (
    lower.includes("art") ||
    lower.includes("gallery") ||
    lower.includes("museum") ||
    lower.includes("film") ||
    lower.includes("cinema") ||
    lower.includes("photo")
  ) {
    return "var(--neon-cyan)"; // cyan accent
  }

  // Sports & fitness
  if (
    lower.includes("sport") ||
    lower.includes("fitness") ||
    lower.includes("run") ||
    lower.includes("yoga") ||
    lower.includes("gym") ||
    lower.includes("tennis") ||
    lower.includes("cycling")
  ) {
    return "var(--neon-magenta)"; // energetic pink
  }

  // Nightlife
  if (
    lower.includes("nightlife") ||
    lower.includes("club") ||
    lower.includes("dance") ||
    lower.includes("dj") ||
    lower.includes("drag")
  ) {
    return "var(--neon-magenta)";
  }

  // Community / civic
  if (
    lower.includes("volunteer") ||
    lower.includes("civic") ||
    lower.includes("community") ||
    lower.includes("nonprofit")
  ) {
    return "var(--neon-cyan)";
  }

  // Default — neutral muted
  return "var(--soft)";
}

// ============================================================================
// Username helpers
// ============================================================================

const USERNAME_REGEX = /^[a-z0-9_]{3,30}$/;

/**
 * Validate a username candidate on the client before submitting to the API.
 * Returns a user-facing error string, or null if valid.
 */
export function validateUsername(username: string): string | null {
  if (!username.trim()) return "Username is required.";
  if (username.length < 3) return "Username must be at least 3 characters.";
  if (username.length > 30) return "Username must be 30 characters or fewer.";
  if (!USERNAME_REGEX.test(username))
    return "Only lowercase letters, numbers, and underscores allowed.";
  return null;
}

/**
 * Return the short display label for a profile — prefers display_name,
 * falls back to @username.
 */
export function getProfileLabel(profile: {
  display_name: string | null;
  username: string;
}): string {
  return profile.display_name?.trim() || `@${profile.username}`;
}
