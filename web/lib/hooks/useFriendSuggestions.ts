"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import type { Profile } from "@/components/community/FriendSuggestions";

interface SuggestionsResponse {
  suggestions: Profile[];
}

export function useFriendSuggestions() {
  const { user } = useAuth();

  const query = useQuery<SuggestionsResponse, Error>({
    queryKey: ["friend-suggestions"],
    queryFn: async () => {
      const res = await fetch("/api/find-friends/suggestions");
      if (!res.ok) {
        throw new Error(`Failed to fetch suggestions: ${res.status}`);
      }
      return res.json();
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 min - suggestions don't change often
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });

  return {
    suggestions: query.data?.suggestions || [],
    isLoading: query.isLoading,
  };
}
