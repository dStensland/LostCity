"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import type { UserPreferences } from "@/lib/search-context";

// ============================================
// Types
// ============================================

interface PersonalizationData {
  preferences: UserPreferences | null;
  loading: boolean;
  error: Error | null;
}

interface FollowRow {
  followed_organization_id: string | null;
  followed_venue_id: number | null;
}

interface UserPreferencesRow {
  favorite_categories: string[] | null;
}

// ============================================
// Hook
// ============================================

/**
 * Hook to fetch user personalization data for search ranking.
 * Returns followed organizers, venues, and favorite categories.
 *
 * This data is used to boost search results from entities the user follows
 * or categories they've shown interest in.
 */
export function useSearchPersonalization(): PersonalizationData {
  const { user, authState } = useAuth();
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchPersonalization = useCallback(async (userId: string) => {
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      // Fetch follows and preferences in parallel
      const [followsResult, preferencesResult] = await Promise.all([
        // Get all follows (organizations and venues)
        supabase
          .from("follows")
          .select("followed_organization_id, followed_venue_id")
          .eq("follower_id", userId),

        // Get explicit favorite categories
        supabase
          .from("user_preferences")
          .select("favorite_categories")
          .eq("user_id", userId)
          .maybeSingle(),
      ]);

      // Process follows
      const follows = (followsResult.data as FollowRow[] | null) || [];
      const followedOrganizers: string[] = [];
      const followedVenues: number[] = [];

      for (const follow of follows) {
        if (follow.followed_organization_id) {
          followedOrganizers.push(follow.followed_organization_id);
        }
        if (follow.followed_venue_id) {
          followedVenues.push(follow.followed_venue_id);
        }
      }

      // Process preferences
      const prefsData = preferencesResult.data as UserPreferencesRow | null;
      const favoriteCategories = prefsData?.favorite_categories || [];

      setPreferences({
        followedOrganizers,
        followedVenues,
        favoriteCategories,
      });
    } catch (err) {
      console.error("Error fetching personalization:", err);
      setError(err instanceof Error ? err : new Error("Failed to fetch personalization"));
      setPreferences(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch personalization when user becomes authenticated
  useEffect(() => {
    if (authState === "authenticated" && user?.id) {
      fetchPersonalization(user.id);
    } else if (authState === "unauthenticated") {
      // Clear preferences when logged out
      setPreferences(null);
      setLoading(false);
      setError(null);
    }
  }, [authState, user?.id, fetchPersonalization]);

  return { preferences, loading, error };
}

/**
 * Hook to check if a specific entity is followed by the user.
 * Useful for showing "From followed" badges in search results.
 */
export function useIsFollowed(
  preferences: UserPreferences | null
): {
  isFollowedOrganizer: (orgId: string) => boolean;
  isFollowedVenue: (venueId: number) => boolean;
  isFavoriteCategory: (category: string) => boolean;
} {
  return useMemo(
    () => ({
      isFollowedOrganizer: (orgId: string) =>
        preferences?.followedOrganizers.includes(orgId) ?? false,
      isFollowedVenue: (venueId: number) =>
        preferences?.followedVenues.includes(venueId) ?? false,
      isFavoriteCategory: (category: string) =>
        preferences?.favoriteCategories.includes(category) ?? false,
    }),
    [preferences]
  );
}

/**
 * Light-weight check to see if user has any personalization data.
 */
export function hasPersonalizationData(preferences: UserPreferences | null): boolean {
  if (!preferences) return false;
  return (
    preferences.followedOrganizers.length > 0 ||
    preferences.followedVenues.length > 0 ||
    preferences.favoriteCategories.length > 0
  );
}
