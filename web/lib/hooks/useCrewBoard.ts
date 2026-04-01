"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";

type CrewFriend = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  status: string;
};

export type CrewEvent = {
  event_id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  image_url: string | null;
  venue_name: string | null;
  friends: CrewFriend[];
};

export type DayGroup = {
  date: string;
  day_label: string;
  events: CrewEvent[];
};

type CrewBoardResponse = {
  days: DayGroup[];
  friendCount: number;
};

export function useCrewBoard() {
  const { user } = useAuth();

  const query = useQuery<CrewBoardResponse>({
    queryKey: ["crew-board"],
    queryFn: async () => {
      const res = await fetch("/api/your-people/crew-board");
      if (!res.ok) throw new Error("Failed to fetch crew board");
      return res.json();
    },
    enabled: !!user,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  return {
    days: query.data?.days || [],
    friendCount: query.data?.friendCount || 0,
    isLoading: query.isLoading,
  };
}
