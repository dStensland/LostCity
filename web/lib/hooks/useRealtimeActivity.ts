"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";

type ActivityUser = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

type ActivityEvent = {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  venue: { name: string } | null;
};

export type RealtimeActivity = {
  id: string;
  activity_type: "rsvp" | "recommendation" | "follow" | "save";
  created_at: string;
  user: ActivityUser;
  event?: ActivityEvent | null;
  venue?: {
    id: number;
    name: string;
    neighborhood: string | null;
  } | null;
  target_user?: {
    id: string;
    username: string;
    display_name: string | null;
  } | null;
  metadata?: {
    status?: string;
    note?: string;
  };
};

interface UseRealtimeActivityOptions {
  limit?: number;
  enabled?: boolean;
}

export function useRealtimeActivity(options: UseRealtimeActivityOptions = {}) {
  const { limit = 30, enabled = true } = options;
  const { user } = useAuth();
  const supabase = createClient();

  const [activities, setActivities] = useState<RealtimeActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newActivityCount, setNewActivityCount] = useState(0);

  const followedIdsRef = useRef<string[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Fetch followed user IDs
  const fetchFollowedIds = useCallback(async () => {
    if (!user) return [];

    const { data } = await supabase
      .from("follows")
      .select("followed_user_id")
      .eq("follower_id", user.id)
      .not("followed_user_id", "is", null);

    const ids = (data || [])
      .map((f: { followed_user_id: string | null }) => f.followed_user_id)
      .filter(Boolean) as string[];

    followedIdsRef.current = ids;
    return ids;
  }, [user, supabase]);

  // Fetch initial activities
  const fetchActivities = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/dashboard/activity?limit=${limit}`);

      if (!res.ok) {
        throw new Error("Failed to fetch activities");
      }

      const data = await res.json();
      setActivities(data.activities || []);
    } catch (err) {
      console.error("Failed to fetch activities:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch activities");
    } finally {
      setLoading(false);
    }
  }, [user, limit]);

  // Subscribe to realtime updates
  const subscribeToRealtime = useCallback(async () => {
    if (!user || !enabled) return;

    const followedIds = await fetchFollowedIds();

    if (followedIds.length === 0) return;

    // Clean up existing subscription
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    // Create new channel for activities
    const channel = supabase
      .channel("dashboard-activity")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "activities",
        },
        async (payload) => {
          const activity = payload.new as {
            id: string;
            user_id: string;
            activity_type: string;
            created_at: string;
            event_id: number | null;
            venue_id: number | null;
            target_user_id: string | null;
            metadata: Record<string, unknown>;
            visibility: string;
          };

          // Only process if from a followed user
          if (!followedIdsRef.current.includes(activity.user_id)) return;

          // Only process public/friends visibility
          if (!["public", "friends"].includes(activity.visibility)) return;

          // Fetch the full activity with relations
          const { data: fullActivity } = await supabase
            .from("activities")
            .select(`
              id,
              activity_type,
              created_at,
              metadata,
              user:profiles!activities_user_id_fkey(
                id, username, display_name, avatar_url
              ),
              event:events(
                id, title, start_date, start_time,
                venue:venues(name)
              ),
              venue:venues(id, name, neighborhood),
              target_user:profiles!activities_target_user_id_fkey(
                id, username, display_name
              )
            `)
            .eq("id", activity.id)
            .maybeSingle();

          const typedActivity = fullActivity as RealtimeActivity | null;
          if (typedActivity && typedActivity.user) {
            // Add to the front of the list
            setActivities((prev) => {
              const filtered = prev.filter((a) => a.id !== typedActivity.id);
              return [typedActivity, ...filtered].slice(0, limit);
            });

            // Increment new activity counter
            setNewActivityCount((prev) => prev + 1);
          }
        }
      )
      .subscribe();

    channelRef.current = channel;
  }, [user, enabled, supabase, fetchFollowedIds, limit]);

  // Initial load
  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  // Set up realtime subscription
  useEffect(() => {
    if (enabled) {
      subscribeToRealtime();
    }

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [enabled, subscribeToRealtime, supabase]);

  // Clear new activity count
  const clearNewActivityCount = useCallback(() => {
    setNewActivityCount(0);
  }, []);

  return {
    activities,
    loading,
    error,
    newActivityCount,
    clearNewActivityCount,
    refresh: fetchActivities,
  };
}
