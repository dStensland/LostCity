"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";

type FriendPlanCreator = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

type FriendPlanItemVenue = {
  id: number;
  name: string;
  slug: string | null;
};

type FriendPlanItem = {
  id: string;
  title: string | null;
  sort_order: number;
  venue_id: number | null;
  event_id: number | null;
  start_time: string | null;
  venue: FriendPlanItemVenue | null;
};

type FriendPlanParticipant = {
  id: string;
  status: string;
  user: FriendPlanCreator | null;
};

export type FriendPlan = {
  id: string;
  title: string;
  description: string | null;
  plan_date: string;
  plan_time: string | null;
  status: "active" | "draft" | "cancelled";
  visibility: "private" | "friends" | "public";
  created_at: string;
  creator: FriendPlanCreator | null;
  items: FriendPlanItem[];
  participants: FriendPlanParticipant[];
};

type FriendPlansResponse = {
  plans: FriendPlan[];
};

/**
 * Friends' upcoming plans (mutual friends only).
 * Fetches on mount, stale after 60s. Plans change infrequently.
 */
export function useFriendPlans() {
  const { user } = useAuth();

  return useQuery<FriendPlansResponse>({
    queryKey: ["plans", "friends"],
    queryFn: async () => {
      const res = await fetch("/api/plans/friends");
      if (!res.ok) {
        throw new Error(`Failed to fetch plans: ${res.status}`);
      }
      return res.json();
    },
    enabled: !!user,
    staleTime: 60_000,
    gcTime: 5 * 60 * 1000,
    retry: false,
  });
}
