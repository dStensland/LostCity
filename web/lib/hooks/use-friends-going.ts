"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";

export type FriendGoing = {
  event_id: number;
  user_id: string;
  status: "going" | "interested";
  user: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
};

type FriendsGoingMap = Record<number, FriendGoing[]>;

export function useFriendsGoing(eventIds: number[]) {
  const { user } = useAuth();
  const [friendsGoing, setFriendsGoing] = useState<FriendsGoingMap>({});
  const [loading, setLoading] = useState(false);

  const fetchFriendsGoing = useCallback(async (ids: number[]) => {
    if (!user || ids.length === 0) {
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`/api/events/friends-going?event_ids=${ids.join(",")}`);
      if (res.ok) {
        const data = await res.json();
        setFriendsGoing((prev) => ({
          ...prev,
          ...data.friends,
        }));
      }
    } catch (error) {
      console.error("Failed to fetch friends going:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Fetch when eventIds change
  useEffect(() => {
    // Only fetch for new event IDs we don't already have
    const newIds = eventIds.filter((id) => !(id in friendsGoing));
    if (newIds.length > 0) {
      fetchFriendsGoing(newIds);
    }
  }, [eventIds, friendsGoing, fetchFriendsGoing]);

  const getFriendsForEvent = useCallback(
    (eventId: number): FriendGoing[] => {
      return friendsGoing[eventId] || [];
    },
    [friendsGoing]
  );

  return {
    friendsGoing,
    loading,
    getFriendsForEvent,
    refetch: () => fetchFriendsGoing(eventIds),
  };
}
