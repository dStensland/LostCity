"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type PlanParticipant = {
  id: string;
  status: "invited" | "accepted" | "declined" | "maybe";
  responded_at: string | null;
  user: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
};

export type PlanItem = {
  id: string;
  title: string;
  sort_order: number;
  event_id: number | null;
  venue_id: number | null;
  note: string | null;
  start_time: string | null;
  event?: { id: number; title: string; start_date: string; start_time: string | null } | null;
  venue?: { id: number; name: string; slug: string | null } | null;
};

export type PlanSuggestion = {
  id: string;
  suggestion_type: string;
  content: Record<string, unknown>;
  status: string;
  created_at: string;
  user: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
};

export type Plan = {
  id: string;
  title: string;
  description: string | null;
  plan_date: string;
  plan_time: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  creator: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  items: PlanItem[];
  participants: PlanParticipant[];
  suggestions?: PlanSuggestion[];
};

export function usePlans() {
  return useQuery<{ plans: Plan[] }>({
    queryKey: ["plans"],
    queryFn: async () => {
      const res = await fetch("/api/plans");
      if (!res.ok) throw new Error("Failed to fetch plans");
      return res.json();
    },
    staleTime: 30_000,
  });
}

export function usePlan(id: string | null) {
  return useQuery<{ plan: Plan }>({
    queryKey: ["plan", id],
    queryFn: async () => {
      const res = await fetch(`/api/plans/${id}`);
      if (!res.ok) throw new Error("Failed to fetch plan");
      return res.json();
    },
    enabled: !!id,
    staleTime: 15_000,
  });
}

export function useCreatePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      title: string;
      description?: string;
      plan_date: string;
      plan_time?: string;
      portal_id?: number;
    }) => {
      const res = await fetch("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create plan");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plans"] });
    },
  });
}

export function useAddPlanItem(planId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      title: string;
      event_id?: number;
      venue_id?: number;
      note?: string;
      start_time?: string;
      sort_order?: number;
    }) => {
      const res = await fetch(`/api/plans/${planId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to add item");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plan", planId] });
    },
  });
}

export function useInviteToPlan(planId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userIds: string[]) => {
      const res = await fetch(`/api/plans/${planId}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_ids: userIds }),
      });
      if (!res.ok) throw new Error("Failed to invite");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plan", planId] });
    },
  });
}

export function useRespondToPlan(planId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (status: "accepted" | "declined" | "maybe") => {
      const res = await fetch(`/api/plans/${planId}/participants`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to respond");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plan", planId] });
      queryClient.invalidateQueries({ queryKey: ["plans"] });
    },
  });
}
