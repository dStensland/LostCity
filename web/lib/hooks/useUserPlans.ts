"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import type {
  Plan,
  PlanWithDetail,
  CreatePlanRequest,
  UpdatePlanRequest,
  RsvpStatus,
  EventPlansAggregate,
  PlacePlansAggregate,
} from "@/lib/types/plans";

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

type MyPlansArgs = { scope?: "mine" | "friends"; status?: "upcoming" | "active" | "past" };

export function useMyPlans(args: MyPlansArgs = {}) {
  const { user } = useAuth();
  const scope = args.scope ?? "mine";
  const status = args.status ?? "upcoming";
  return useQuery<{ plans: Plan[] }>({
    queryKey: ["plans", "list", scope, status, user?.id ?? null],
    enabled: !!user,
    queryFn: async () => {
      const res = await fetch(`/api/plans?scope=${scope}&status=${status}`, { credentials: "same-origin" });
      if (!res.ok) throw new Error(`Plans list failed (${res.status})`);
      return res.json();
    },
  });
}

export function usePlan(id: string | null) {
  return useQuery<{ plan: Plan; anchor: unknown; invitees: unknown[] }>({
    queryKey: ["plans", "detail", id],
    enabled: !!id,
    queryFn: async () => {
      const res = await fetch(`/api/plans/${id}`, { credentials: "same-origin" });
      if (!res.ok) throw new Error(`Plan detail failed (${res.status})`);
      return res.json();
    },
  });
}

export function useEventPlans(eventId: number | null) {
  return useQuery<EventPlansAggregate>({
    queryKey: ["plans", "event-aggregate", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const res = await fetch(`/api/plans?anchor_event_id=${eventId}`, { credentials: "same-origin" });
      if (!res.ok) throw new Error(`Event plans aggregate failed (${res.status})`);
      const body = (await res.json()) as { plans: Plan[] };
      // NOTE: server-side aggregate endpoint lands in Phase 4 (Task 4.2). For now this
      // returns a simple count. Friend-aware count stays at 0 until batched aggregate ships.
      return { going_count: body.plans.length, friend_going_count: 0 };
    },
  });
}

export function usePlacePlans(placeId: number | null) {
  return useQuery<PlacePlansAggregate>({
    queryKey: ["plans", "place-aggregate", placeId],
    enabled: !!placeId,
    queryFn: async () => {
      const res = await fetch(`/api/plans?anchor_place_id=${placeId}`, { credentials: "same-origin" });
      if (!res.ok) throw new Error(`Place plans aggregate failed (${res.status})`);
      const body = (await res.json()) as { plans: Plan[] };
      const active = body.plans.filter((p) => p.status === "active");
      return { active_count: active.length, friends_here: [] };
    },
  });
}

export function useActivePlans(portalId: string | null) {
  const { user } = useAuth();
  return useQuery<{ plans: Plan[] }>({
    queryKey: ["plans", "active", portalId, user?.id ?? null],
    enabled: !!user && !!portalId,
    queryFn: async () => {
      const res = await fetch(`/api/plans?scope=mine&status=active`, { credentials: "same-origin" });
      if (!res.ok) throw new Error(`Active plans failed (${res.status})`);
      return res.json();
    },
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreatePlan() {
  const qc = useQueryClient();
  return useMutation<{ plan: { id: string; share_token: string } }, Error, CreatePlanRequest>({
    mutationFn: async (input) => {
      const res = await fetch("/api/plans", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plans"] });
    },
  });
}

export function useUpdatePlan(id: string) {
  const qc = useQueryClient();
  return useMutation<void, Error, UpdatePlanRequest>({
    mutationFn: async (input) => {
      const res = await fetch(`/api/plans/${id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plans"] });
    },
  });
}

export function useCancelPlan(id: string) {
  const qc = useQueryClient();
  return useMutation<void, Error, void>({
    mutationFn: async () => {
      const res = await fetch(`/api/plans/${id}`, { method: "DELETE", credentials: "same-origin" });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plans"] }),
  });
}

export function useInviteToPlan(id: string) {
  const qc = useQueryClient();
  return useMutation<void, Error, { user_ids: string[] }>({
    mutationFn: async (input) => {
      const res = await fetch(`/api/plans/${id}/invitees`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plans", "detail", id] }),
  });
}

export function useRespondToPlan(id: string) {
  const qc = useQueryClient();
  return useMutation<void, Error, { rsvp_status: Exclude<RsvpStatus, "invited"> }>({
    mutationFn: async (input) => {
      const res = await fetch(`/api/plans/${id}/invitees/me`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plans"] }),
  });
}

export function useMarkPlanSeen(id: string) {
  return useMutation<void, Error, void>({
    mutationFn: async () => {
      await fetch(`/api/plans/${id}/invitees/me/seen`, { method: "PATCH", credentials: "same-origin" });
    },
  });
}

// Re-export PlanWithDetail so consumers can import it from this module
export type { PlanWithDetail };
