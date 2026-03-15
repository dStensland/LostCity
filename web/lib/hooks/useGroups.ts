"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { useAuthenticatedFetch } from "./useAuthenticatedFetch";
import { ENABLE_GROUPS_V1 } from "@/lib/launch-flags";
import type {
  MyGroupsResponse,
  GroupDetailResponse,
  GroupSpotsResponse,
  GroupActivityResponse,
  GroupHangsResponse,
  GroupWithMeta,
  CreateGroupRequest,
  UpdateGroupRequest,
  AddGroupSpotRequest,
} from "@/lib/types/groups";

// ─── useMyGroups ──────────────────────────────────────────────────────────────

/**
 * All groups the current user belongs to.
 * Refetches every 60s. Only enabled when user is authenticated.
 */
export function useMyGroups() {
  const { user } = useAuth();

  return useQuery<MyGroupsResponse>({
    queryKey: ["groups", "mine"],
    queryFn: async () => {
      const res = await fetch("/api/groups");
      if (!res.ok) return { groups: [] };
      return res.json();
    },
    enabled: !!user && ENABLE_GROUPS_V1,
    staleTime: 30_000,
    refetchInterval: 60_000,
    gcTime: 5 * 60 * 1000,
    retry: false,
  });
}

// ─── useGroup ─────────────────────────────────────────────────────────────────

/**
 * Single group detail including members list and the caller's role.
 * Only enabled when user is authenticated and a groupId is provided.
 */
export function useGroup(groupId: string) {
  const { user } = useAuth();

  return useQuery<GroupDetailResponse>({
    queryKey: ["groups", groupId],
    queryFn: async () => {
      const res = await fetch(`/api/groups/${groupId}`);
      if (!res.ok) throw new Error("Failed to fetch group");
      return res.json();
    },
    enabled: !!user && !!groupId && ENABLE_GROUPS_V1,
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
    retry: false,
  });
}

// ─── useGroupSpots ────────────────────────────────────────────────────────────

/**
 * The shared venue list (spots) for a group.
 * Only enabled when user is authenticated and a groupId is provided.
 */
export function useGroupSpots(groupId: string) {
  const { user } = useAuth();

  return useQuery<GroupSpotsResponse>({
    queryKey: ["groups", groupId, "spots"],
    queryFn: async () => {
      const res = await fetch(`/api/groups/${groupId}/spots`);
      if (!res.ok) return { spots: [] };
      return res.json();
    },
    enabled: !!user && !!groupId && ENABLE_GROUPS_V1,
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
    retry: false,
  });
}

// ─── useGroupActivity ─────────────────────────────────────────────────────────

/**
 * Recent activity feed for a group (hangs started, spots added, members joined).
 * Refetches every 60s to surface fresh activity.
 */
export function useGroupActivity(groupId: string) {
  const { user } = useAuth();

  return useQuery<GroupActivityResponse>({
    queryKey: ["groups", groupId, "activity"],
    queryFn: async () => {
      const res = await fetch(`/api/groups/${groupId}/activity`);
      if (!res.ok) return { activity: [] };
      return res.json();
    },
    enabled: !!user && !!groupId && ENABLE_GROUPS_V1,
    staleTime: 30_000,
    refetchInterval: 60_000,
    gcTime: 5 * 60 * 1000,
    retry: false,
  });
}

// ─── useGroupHangs ────────────────────────────────────────────────────────────

/**
 * Active and planned hangs for group members.
 * Refetches every 90s — hangs change more frequently than spots/activity.
 */
export function useGroupHangs(groupId: string) {
  const { user } = useAuth();

  return useQuery<GroupHangsResponse>({
    queryKey: ["groups", groupId, "hangs"],
    queryFn: async () => {
      const res = await fetch(`/api/groups/${groupId}/hangs`);
      if (!res.ok) return { active: [], planned: [] };
      return res.json();
    },
    enabled: !!user && !!groupId && ENABLE_GROUPS_V1,
    staleTime: 30_000,
    refetchInterval: 90_000,
    gcTime: 5 * 60 * 1000,
    retry: false,
  });
}

// ─── useCreateGroup ───────────────────────────────────────────────────────────

/**
 * Create a new group. The caller automatically becomes admin.
 * Invalidates the "mine" list on success.
 */
export function useCreateGroup() {
  const { authFetch } = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: CreateGroupRequest) => {
      const result = await authFetch<GroupWithMeta>("/api/groups", {
        method: "POST",
        body: request,
      });

      if (result.error) {
        throw new Error(result.error);
      }

      return result.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups", "mine"] });
    },
  });
}

// ─── useJoinGroup ─────────────────────────────────────────────────────────────

/**
 * Join a group via invite code.
 * Invalidates the "mine" list on success.
 */
export function useJoinGroup() {
  const { authFetch } = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ invite_code }: { invite_code: string }) => {
      const result = await authFetch<GroupWithMeta>("/api/groups/join", {
        method: "POST",
        body: { invite_code },
      });

      if (result.error) {
        throw new Error(result.error);
      }

      return result.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups", "mine"] });
    },
  });
}

// ─── useLeaveGroup ────────────────────────────────────────────────────────────

/**
 * Leave a group by removing the current user from its member list.
 * Invalidates "mine" list and removes the group detail from cache.
 */
export function useLeaveGroup() {
  const { authFetch } = useAuthenticatedFetch();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (groupId: string) => {
      const userId = user?.id;
      if (!userId) throw new Error("Not authenticated");

      const result = await authFetch<{ success: boolean }>(
        `/api/groups/${groupId}/members/${userId}`,
        { method: "DELETE" }
      );

      if (result.error) {
        throw new Error(result.error);
      }

      return result.data!;
    },
    onSuccess: (_data, groupId) => {
      queryClient.invalidateQueries({ queryKey: ["groups", "mine"] });
      queryClient.removeQueries({ queryKey: ["groups", groupId] });
    },
  });
}

// ─── useAddGroupSpot ──────────────────────────────────────────────────────────

/**
 * Add a venue to the group's shared spot list.
 * Invalidates the spots list for the given group on success.
 */
export function useAddGroupSpot(groupId: string) {
  const { authFetch } = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: AddGroupSpotRequest) => {
      const result = await authFetch<{ id: string }>(`/api/groups/${groupId}/spots`, {
        method: "POST",
        body: request,
      });

      if (result.error) {
        throw new Error(result.error);
      }

      return result.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups", groupId, "spots"] });
    },
  });
}

// ─── useRemoveGroupSpot ───────────────────────────────────────────────────────

/**
 * Remove a venue from the group's shared spot list.
 * Invalidates the spots list for the given group on success.
 */
export function useRemoveGroupSpot(groupId: string) {
  const { authFetch } = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (spotId: string) => {
      const result = await authFetch<{ success: boolean }>(
        `/api/groups/${groupId}/spots/${spotId}`,
        { method: "DELETE" }
      );

      if (result.error) {
        throw new Error(result.error);
      }

      return result.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups", groupId, "spots"] });
    },
  });
}

// ─── useUpdateGroup ───────────────────────────────────────────────────────────

/**
 * Update group metadata (name, description, emoji, avatar, visibility).
 * Only admins can call this — the API enforces it.
 * Invalidates both the group detail and the "mine" list on success.
 */
export function useUpdateGroup(groupId: string) {
  const { authFetch } = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: UpdateGroupRequest) => {
      const result = await authFetch<GroupWithMeta>(`/api/groups/${groupId}`, {
        method: "PATCH",
        body: request,
      });

      if (result.error) {
        throw new Error(result.error);
      }

      return result.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups", groupId] });
      queryClient.invalidateQueries({ queryKey: ["groups", "mine"] });
    },
  });
}

// ─── useDeleteGroup ───────────────────────────────────────────────────────────

/**
 * Delete a group entirely. Only the creator/admin can call this — the API enforces it.
 * Invalidates "mine" list and removes the group detail from cache.
 */
export function useDeleteGroup(groupId: string) {
  const { authFetch } = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const result = await authFetch<{ success: boolean }>(`/api/groups/${groupId}`, {
        method: "DELETE",
      });

      if (result.error) {
        throw new Error(result.error);
      }

      return result.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups", "mine"] });
      queryClient.removeQueries({ queryKey: ["groups", groupId] });
    },
  });
}

// ─── useRegenerateInviteCode ──────────────────────────────────────────────────

/**
 * Rotate the group's invite code. Old links immediately become invalid.
 * Only admins can call this — the API enforces it.
 * Invalidates the group detail to surface the new code.
 */
export function useRegenerateInviteCode(groupId: string) {
  const { authFetch } = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const result = await authFetch<{ invite_code: string }>(
        `/api/groups/${groupId}/invite-code`,
        { method: "POST" }
      );

      if (result.error) {
        throw new Error(result.error);
      }

      return result.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups", groupId] });
    },
  });
}
