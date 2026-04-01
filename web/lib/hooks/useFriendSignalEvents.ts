"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";

export type FriendSignalEvent = {
  event_id: number;
  title: string;
  start_date: string;
  image_url: string | null;
  venue_name: string | null;
  going_count: number;
  interested_count: number;
  friend_avatars: { id: string; avatar_url: string | null }[];
};

type FriendSignalResponse = {
  events: FriendSignalEvent[];
};

export function useFriendSignalEvents(crewEventIds: number[] = []) {
  const { user } = useAuth();

  const query = useQuery<FriendSignalResponse>({
    queryKey: ["friend-signal-events"],
    queryFn: async () => {
      const res = await fetch("/api/your-people/friend-signal-events");
      if (!res.ok) throw new Error("Failed to fetch friend signal events");
      return res.json();
    },
    enabled: !!user,
    staleTime: 5 * 60_000,
  });

  // Exclude events already shown in crew board (client-side, avoids waterfall)
  const filtered = (query.data?.events || []).filter(
    (e) => !crewEventIds.includes(e.event_id)
  );

  return {
    events: filtered,
    isLoading: query.isLoading,
  };
}
