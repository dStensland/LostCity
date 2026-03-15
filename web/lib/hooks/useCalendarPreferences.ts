"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { CalendarPreferences } from "@/lib/types/calendar";

const DEFAULTS: CalendarPreferences = {
  default_view: "agenda",
  week_start: "sunday",
  show_friend_events: true,
  show_past_events: true,
};

export function useCalendarPreferences() {
  return useQuery<CalendarPreferences>({
    queryKey: ["calendar-preferences"],
    queryFn: async () => {
      const res = await fetch("/api/user/calendar/preferences");
      if (!res.ok) return DEFAULTS;
      const json = await res.json();
      return json.preferences ?? DEFAULTS;
    },
    staleTime: 300_000, // 5 minutes
    placeholderData: DEFAULTS,
  });
}

export function useUpdateCalendarPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: Partial<CalendarPreferences>) => {
      const res = await fetch("/api/user/calendar/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update preferences");
      const json = await res.json();
      return json.preferences as CalendarPreferences;
    },
    onMutate: async (updates) => {
      await queryClient.cancelQueries({ queryKey: ["calendar-preferences"] });
      const previous = queryClient.getQueryData<CalendarPreferences>([
        "calendar-preferences",
      ]);
      queryClient.setQueryData<CalendarPreferences>(
        ["calendar-preferences"],
        (old) => ({ ...(old ?? DEFAULTS), ...updates })
      );
      return { previous };
    },
    onError: (_err, _updates, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["calendar-preferences"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-preferences"] });
    },
  });
}
