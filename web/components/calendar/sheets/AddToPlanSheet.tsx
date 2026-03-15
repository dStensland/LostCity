"use client";

import { useState, useCallback } from "react";
import { useCalendar } from "@/lib/calendar/CalendarProvider";
import { usePlans } from "@/lib/hooks/usePlans";
import type { CalendarEvent } from "@/lib/types/calendar";

interface AddToPlanSheetProps {
  event: CalendarEvent;
}

export function AddToPlanSheet({ event }: AddToPlanSheetProps) {
  const { openSheet, closeSheet } = useCalendar();
  const { data, isLoading } = usePlans();
  const plans = data?.plans ?? [];

  const [addingToPlanId, setAddingToPlanId] = useState<string | null>(null);
  const [addedToPlanId, setAddedToPlanId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // We instantiate addPlanItem with a placeholder id; each tap creates a fresh mutation instance
  // via the internal handler below, which captures planId in closure.
  const handleAdd = useCallback(
    async (planId: string) => {
      if (addingToPlanId) return;
      setAddingToPlanId(planId);
      setError(null);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      try {
        const res = await fetch(`/api/plans/${planId}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: event.title,
            event_id: event.id,
          }),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("Failed to add");

        setAddedToPlanId(planId);
        // Close after brief success flash
        setTimeout(() => {
          closeSheet();
        }, 800);
      } catch {
        setError("Something went wrong. Try again.");
        setAddingToPlanId(null);
      } finally {
        clearTimeout(timeoutId);
      }
    },
    [event.id, event.title, addingToPlanId, closeSheet]
  );

  const handleCreateNew = useCallback(() => {
    openSheet({ sheet: "create-plan" });
  }, [openSheet]);

  return (
    <div className="flex flex-col h-full">
      {/* Event identity strip */}
      <div className="px-4 pt-4 pb-3 border-b border-[var(--twilight)]/50">
        <p className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-1">
          Adding to plan
        </p>
        <p className="text-sm font-medium text-[var(--cream)] line-clamp-2">
          {event.title}
        </p>
      </div>

      {/* Plan list */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {error && (
          <p className="px-4 py-2 mb-3 text-xs font-mono text-[var(--coral)] bg-[var(--coral)]/10 rounded-lg">
            {error}
          </p>
        )}

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-16 rounded-xl bg-[var(--dusk)] animate-pulse"
              />
            ))}
          </div>
        ) : plans.length === 0 ? (
          <div className="py-8 text-center">
            <p className="font-mono text-sm text-[var(--muted)]">
              No plans yet.
            </p>
            <p className="font-mono text-xs text-[var(--muted)] mt-1 opacity-70">
              Create one below.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {plans.map((plan) => {
              const isAdding = addingToPlanId === plan.id;
              const isAdded = addedToPlanId === plan.id;
              const planDate = new Date(`${plan.plan_date}T00:00:00`);
              const dateStr = planDate.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              });

              return (
                <button
                  key={plan.id}
                  onClick={() => handleAdd(plan.id)}
                  disabled={!!addingToPlanId || isAdded}
                  className="w-full flex items-center justify-between gap-3 p-3 rounded-xl bg-[var(--night)] border border-[var(--twilight)]/40 hover:border-[var(--twilight)] transition-colors disabled:opacity-60 text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-sm font-medium text-[var(--cream)] truncate">
                      {plan.title}
                    </p>
                    <p className="font-mono text-xs text-[var(--muted)] mt-0.5">
                      {dateStr}
                      {plan.participants.length > 0 && (
                        <span>
                          {" · "}
                          {plan.participants.length === 1
                            ? "1 person"
                            : `${plan.participants.length} people`}
                        </span>
                      )}
                    </p>
                  </div>

                  {isAdded ? (
                    <span className="flex-shrink-0 font-mono text-xs text-[var(--neon-green)]">
                      Added ✓
                    </span>
                  ) : isAdding ? (
                    <span className="flex-shrink-0 font-mono text-xs text-[var(--muted)]">
                      Adding…
                    </span>
                  ) : (
                    <svg
                      className="flex-shrink-0 w-4 h-4 text-[var(--muted)]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer: create new plan */}
      <div className="flex-shrink-0 border-t border-[var(--twilight)] bg-[var(--void)] px-4 py-3">
        <button
          onClick={handleCreateNew}
          className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--soft)] font-mono text-sm hover:border-[var(--soft)] hover:text-[var(--cream)] transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          Create New Plan
        </button>
      </div>
    </div>
  );
}
