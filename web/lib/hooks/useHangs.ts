"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { useAuthenticatedFetch } from "./useAuthenticatedFetch";
import type {
  HangWithVenue,
  FriendHang,
  VenueHangInfo,
  HotVenue,
  CreateHangRequest,
  UpdateHangRequest,
} from "@/lib/types/hangs";

// ─── Response shapes ─────────────────────────────────────────────────────────

type MyHangsResponse = {
  active: HangWithVenue | null;
  planned: HangWithVenue[];
};

type FriendHangsResponse = {
  friends: FriendHang[];
  count: number;
};

// ─── useMyHangs ──────────────────────────────────────────────────────────────

/**
 * Current user's active hang + planned hangs.
 * Refetches every 90s because active hangs can auto-expire.
 * Only enabled when user is authenticated.
 */
export function useMyHangs() {
  const { user } = useAuth();

  return useQuery<MyHangsResponse>({
    queryKey: ["hangs", "mine"],
    queryFn: async () => {
      const res = await fetch("/api/hangs");
      if (!res.ok) throw new Error("Failed to fetch hangs");
      return res.json();
    },
    enabled: !!user,
    staleTime: 30_000,
    refetchInterval: 90_000,
    gcTime: 5 * 60 * 1000,
  });
}

// ─── useCreateHang ───────────────────────────────────────────────────────────

/**
 * Create a new hang (check-in to a venue).
 * Optimistically sets the active hang immediately; rolls back on error.
 */
export function useCreateHang() {
  const { authFetch } = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: CreateHangRequest) => {
      const result = await authFetch<HangWithVenue>("/api/hangs", {
        method: "POST",
        body: request,
      });

      if (result.error) {
        throw new Error(result.error);
      }

      return result.data!;
    },
    onMutate: async (request) => {
      await queryClient.cancelQueries({ queryKey: ["hangs", "mine"] });

      const previousData = queryClient.getQueryData<MyHangsResponse>(["hangs", "mine"]);

      // Optimistic update: build a minimal HangWithVenue placeholder.
      // Real shape is filled in from the server response via onSuccess.
      queryClient.setQueryData<MyHangsResponse>(["hangs", "mine"], (old) => {
        if (!old) return old;
        const optimisticHang: HangWithVenue = {
          id: "optimistic",
          user_id: "",
          venue_id: request.venue_id,
          event_id: request.event_id ?? null,
          portal_id: null,
          status: request.planned_for ? "planned" : "active",
          visibility: request.visibility ?? "friends",
          note: request.note ?? null,
          started_at: new Date().toISOString(),
          planned_for: request.planned_for ?? null,
          auto_expire_at: new Date(
            Date.now() + (request.duration_hours ?? 4) * 60 * 60 * 1000
          ).toISOString(),
          ended_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          venue: { id: request.venue_id, name: "", slug: null, image_url: null, neighborhood: null, address: null },
          event: null,
        };

        return request.planned_for
          ? { active: old.active, planned: [...old.planned, optimisticHang] }
          : { active: optimisticHang, planned: old.planned };
      });

      return { previousData };
    },
    onSuccess: (_data, variables) => {
      // Replace the optimistic placeholder with real server data.
      queryClient.invalidateQueries({ queryKey: ["hangs", "mine"] });
      queryClient.invalidateQueries({ queryKey: ["hangs", "hot"] });
      queryClient.invalidateQueries({ queryKey: ["hangs", "venue", variables.venue_id] });
    },
    onError: (_error, _variables, context) => {
      if (context?.previousData !== undefined) {
        queryClient.setQueryData(["hangs", "mine"], context.previousData);
      }
    },
  });
}

// ─── useUpdateHang ───────────────────────────────────────────────────────────

/**
 * Update the active hang (note, visibility) or end it via action: "end".
 * Optimistically applies note/visibility changes; rolls back on error.
 */
export function useUpdateHang() {
  const { authFetch } = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: UpdateHangRequest) => {
      const result = await authFetch<HangWithVenue>("/api/hangs", {
        method: "PATCH",
        body: request,
      });

      if (result.error) {
        throw new Error(result.error);
      }

      return result.data!;
    },
    onMutate: async (request) => {
      await queryClient.cancelQueries({ queryKey: ["hangs", "mine"] });

      const previousData = queryClient.getQueryData<MyHangsResponse>(["hangs", "mine"]);
      const activeVenueId = previousData?.active?.venue_id ?? null;

      // Optimistically apply note/visibility changes to the active hang.
      // If action=end, clear the active hang immediately.
      queryClient.setQueryData<MyHangsResponse>(["hangs", "mine"], (old) => {
        if (!old) return old;

        if (request.action === "end") {
          return { active: null, planned: old.planned };
        }

        if (!old.active) return old;

        return {
          active: {
            ...old.active,
            ...(request.note !== undefined && { note: request.note }),
            ...(request.visibility !== undefined && { visibility: request.visibility }),
            updated_at: new Date().toISOString(),
          },
          planned: old.planned,
        };
      });

      return { previousData, activeVenueId };
    },
    onSuccess: (_data, _variables, context) => {
      queryClient.invalidateQueries({ queryKey: ["hangs", "mine"] });
      if (context?.activeVenueId != null) {
        queryClient.invalidateQueries({ queryKey: ["hangs", "venue", context.activeVenueId] });
      }
    },
    onError: (_error, _variables, context) => {
      if (context?.previousData !== undefined) {
        queryClient.setQueryData(["hangs", "mine"], context.previousData);
      }
    },
  });
}

// ─── useEndHang ──────────────────────────────────────────────────────────────

/**
 * End the active hang immediately (DELETE).
 * Optimistically clears the active hang; rolls back on error.
 */
export function useEndHang() {
  const { authFetch } = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const result = await authFetch<{ success: boolean }>("/api/hangs", {
        method: "DELETE",
      });

      if (result.error) {
        throw new Error(result.error);
      }

      return result.data!;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["hangs", "mine"] });

      const previousData = queryClient.getQueryData<MyHangsResponse>(["hangs", "mine"]);
      const activeVenueId = previousData?.active?.venue_id ?? null;

      // Optimistically clear the active hang.
      queryClient.setQueryData<MyHangsResponse>(["hangs", "mine"], (old) => {
        if (!old) return old;
        return { active: null, planned: old.planned };
      });

      return { previousData, activeVenueId };
    },
    onSuccess: (_data, _variables, context) => {
      queryClient.invalidateQueries({ queryKey: ["hangs", "mine"] });
      queryClient.invalidateQueries({ queryKey: ["hangs", "hot"] });
      if (context?.activeVenueId != null) {
        queryClient.invalidateQueries({ queryKey: ["hangs", "venue", context.activeVenueId] });
      }
    },
    onError: (_error, _variables, context) => {
      if (context?.previousData !== undefined) {
        queryClient.setQueryData(["hangs", "mine"], context.previousData);
      }
    },
  });
}

// ─── useFriendHangs ──────────────────────────────────────────────────────────

/**
 * Friends' active hangs.
 * Refetches every 90s. Only enabled when user is authenticated.
 */
export function useFriendHangs() {
  const { user } = useAuth();

  return useQuery<FriendHangsResponse>({
    queryKey: ["hangs", "friends"],
    queryFn: async () => {
      const res = await fetch("/api/hangs/friends");
      if (!res.ok) throw new Error("Failed to fetch friend hangs");
      return res.json();
    },
    enabled: !!user,
    staleTime: 30_000,
    refetchInterval: 90_000,
    gcTime: 5 * 60 * 1000,
  });
}

// ─── useVenueHangs ───────────────────────────────────────────────────────────

/**
 * Hang activity at a specific venue.
 * Public data — no auth required. Used on venue detail pages.
 */
export function useVenueHangs(venueId: number) {
  return useQuery<VenueHangInfo>({
    queryKey: ["hangs", "venue", venueId],
    queryFn: async () => {
      const res = await fetch(`/api/hangs/venue/${venueId}`);
      if (!res.ok) throw new Error("Failed to fetch venue hangs");
      return res.json();
    },
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
  });
}

// ─── useHotVenues ────────────────────────────────────────────────────────────

/**
 * Currently hot venues (highest active hang count).
 * Public data — no auth required.
 * staleTime: 60s because hot venues change less frequently than individual hangs.
 *
 * @param portalSlug - Optional portal scope. Pass undefined for global.
 * @param limit - Max venues to return (default handled server-side).
 */
export function useHotVenues(portalSlug?: string, limit?: number) {
  return useQuery<{ venues: HotVenue[] }>({
    queryKey: ["hangs", "hot", portalSlug, limit],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (portalSlug) params.set("portal", portalSlug);
      if (limit !== undefined) params.set("limit", String(limit));
      const qs = params.toString();
      const res = await fetch(`/api/hangs/hot${qs ? `?${qs}` : ""}`);
      if (!res.ok) throw new Error("Failed to fetch hot venues");
      return res.json();
    },
    staleTime: 60_000,
    gcTime: 5 * 60 * 1000,
  });
}
