"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { useAuthenticatedFetch } from "./useAuthenticatedFetch";
import type {
  KidProfile,
  CreateKidProfileRequest,
  UpdateKidProfileRequest,
} from "@/lib/types/kid-profiles";

type KidsResponse = { kids: KidProfile[] };

export const KID_PROFILES_QUERY_KEY = ["kid-profiles"] as const;

/**
 * All kid profiles for the current user.
 * Only runs when authenticated.
 */
export function useKidProfiles() {
  const { user } = useAuth();

  return useQuery<KidProfile[]>({
    queryKey: KID_PROFILES_QUERY_KEY,
    queryFn: async () => {
      const res = await fetch("/api/user/kids");
      if (!res.ok) return [];
      const body = (await res.json()) as KidsResponse;
      return body.kids;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,  // profiles don't change often
    gcTime: 10 * 60 * 1000,
    retry: false,
  });
}

/**
 * Add a new kid profile.
 * Optimistically appends a placeholder; replaces with real data on success.
 */
export function useAddKid() {
  const { authFetch } = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: CreateKidProfileRequest) => {
      const result = await authFetch<{ kid: KidProfile }>("/api/user/kids", {
        method: "POST",
        body: request,
      });

      if (result.error) throw new Error(result.error);
      return result.data!.kid;
    },
    onSuccess: (newKid) => {
      queryClient.setQueryData<KidProfile[]>(KID_PROFILES_QUERY_KEY, (prev) =>
        prev ? [...prev, newKid] : [newKid]
      );
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: KID_PROFILES_QUERY_KEY });
    },
  });
}

/**
 * Update an existing kid profile by id.
 * Optimistically merges the patch; rolls back on error.
 */
export function useUpdateKid() {
  const { authFetch } = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...patch
    }: UpdateKidProfileRequest & { id: string }) => {
      const result = await authFetch<{ kid: KidProfile }>(
        `/api/user/kids/${id}`,
        { method: "PATCH", body: patch }
      );

      if (result.error) throw new Error(result.error);
      return result.data!.kid;
    },
    onMutate: async ({ id, ...patch }) => {
      await queryClient.cancelQueries({ queryKey: KID_PROFILES_QUERY_KEY });
      const prev = queryClient.getQueryData<KidProfile[]>(KID_PROFILES_QUERY_KEY);

      queryClient.setQueryData<KidProfile[]>(KID_PROFILES_QUERY_KEY, (kids) =>
        kids?.map((k) =>
          k.id === id ? { ...k, ...patch, updated_at: new Date().toISOString() } : k
        )
      );

      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev !== undefined) {
        queryClient.setQueryData(KID_PROFILES_QUERY_KEY, context.prev);
      }
    },
    onSuccess: (updatedKid) => {
      queryClient.setQueryData<KidProfile[]>(KID_PROFILES_QUERY_KEY, (kids) =>
        kids?.map((k) => (k.id === updatedKid.id ? updatedKid : k))
      );
    },
  });
}

/**
 * Remove a kid profile by id.
 * Optimistically removes from cache; rolls back on error.
 */
export function useRemoveKid() {
  const { authFetch } = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await authFetch<{ success: boolean }>(
        `/api/user/kids/${id}`,
        { method: "DELETE" }
      );

      if (result.error) throw new Error(result.error);
      return id;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: KID_PROFILES_QUERY_KEY });
      const prev = queryClient.getQueryData<KidProfile[]>(KID_PROFILES_QUERY_KEY);

      queryClient.setQueryData<KidProfile[]>(KID_PROFILES_QUERY_KEY, (kids) =>
        kids?.filter((k) => k.id !== id)
      );

      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev !== undefined) {
        queryClient.setQueryData(KID_PROFILES_QUERY_KEY, context.prev);
      }
    },
  });
}
