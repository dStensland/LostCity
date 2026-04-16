"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

type SubscriptionStatusResponse = {
  subscribed: boolean;
};

type SubscribeResponse = {
  subscribed: boolean;
  materialized_count: number;
};

type UnsubscribeResponse = {
  unsubscribed: boolean;
  removed_rsvps: number;
};

/**
 * Hook for managing a user's subscription to a recurring series.
 *
 * Provides:
 * - `isSubscribed` — whether the current user is subscribed
 * - `isLoading` — true while the initial status check is in flight
 * - `subscribe` — mutation to subscribe (POST); materializes future RSVPs
 * - `unsubscribe` — mutation to unsubscribe (DELETE); removes subscription RSVPs
 *
 * Both mutations invalidate the subscription status and calendar queries on
 * success so the UI stays in sync.
 *
 * Usage:
 * ```tsx
 * const { isSubscribed, isLoading, subscribe, unsubscribe } = useSeriesSubscription(seriesId);
 * ```
 */
export function useSeriesSubscription(seriesId: string | null | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ["series-subscription", seriesId];

  const { data, isLoading } = useQuery<SubscriptionStatusResponse>({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`/api/series/${seriesId}/subscribe`);
      if (!res.ok) throw new Error("Failed to check subscription status");
      return res.json();
    },
    enabled: !!seriesId,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  const subscribeMutation = useMutation<SubscribeResponse, Error>({
    mutationFn: async () => {
      const res = await fetch(`/api/series/${seriesId}/subscribe`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Failed to subscribe");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["events", "calendar"] });
    },
  });

  const unsubscribeMutation = useMutation<UnsubscribeResponse, Error>({
    mutationFn: async () => {
      const res = await fetch(`/api/series/${seriesId}/subscribe`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Failed to unsubscribe");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["events", "calendar"] });
    },
  });

  return {
    isSubscribed: data?.subscribed ?? false,
    isLoading,
    subscribe: subscribeMutation,
    unsubscribe: unsubscribeMutation,
  };
}
