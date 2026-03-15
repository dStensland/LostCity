"use client";

import { useState, useCallback } from "react";
import { useCalendar } from "@/lib/calendar/CalendarProvider";
import { useCreatePlan } from "@/lib/hooks/usePlans";

export function CreatePlanSheet() {
  const { closeSheet } = useCalendar();
  const createPlan = useCreatePlan();

  const [title, setTitle] = useState("");
  const [planDate, setPlanDate] = useState("");
  const [planTime, setPlanTime] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const todayStr = new Date().toISOString().slice(0, 10);

  const handleSubmit = useCallback(async () => {
    if (!title.trim()) {
      setError("Plan name is required.");
      return;
    }
    if (!planDate) {
      setError("Date is required.");
      return;
    }

    setError(null);

    try {
      await createPlan.mutateAsync({
        title: title.trim(),
        plan_date: planDate,
        ...(planTime && { plan_time: planTime }),
        ...(description.trim() && { description: description.trim() }),
      });
      closeSheet();
    } catch {
      setError("Failed to create plan. Please try again.");
    }
  }, [title, planDate, planTime, description, createPlan, closeSheet]);

  return (
    <div className="flex flex-col h-full">
      {/* Scrollable form */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {/* Plan name */}
        <div>
          <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-1.5">
            Plan Name <span className="text-[var(--coral)]">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Summer rooftop hang"
            maxLength={120}
            className="w-full px-3 py-2.5 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)] transition-colors"
          />
        </div>

        {/* Date */}
        <div>
          <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-1.5">
            Date <span className="text-[var(--coral)]">*</span>
          </label>
          <input
            type="date"
            value={planDate}
            onChange={(e) => setPlanDate(e.target.value)}
            min={todayStr}
            className="w-full px-3 py-2.5 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm focus:outline-none focus:border-[var(--coral)] transition-colors"
          />
        </div>

        {/* Time (optional) */}
        <div>
          <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-1.5">
            Time{" "}
            <span className="normal-case tracking-normal opacity-60">
              (optional)
            </span>
          </label>
          <input
            type="time"
            value={planTime}
            onChange={(e) => setPlanTime(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm focus:outline-none focus:border-[var(--coral)] transition-colors"
          />
        </div>

        {/* Description (optional) */}
        <div>
          <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-1.5">
            Description{" "}
            <span className="normal-case tracking-normal opacity-60">
              (optional)
            </span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's the plan?"
            rows={3}
            maxLength={500}
            className="w-full px-3 py-2.5 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)] transition-colors resize-none"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 rounded-lg bg-[var(--coral)]/10 border border-[var(--coral)]">
            <p className="font-mono text-xs text-[var(--coral)]">{error}</p>
          </div>
        )}
      </div>

      {/* Footer CTA */}
      <div className="flex-shrink-0 border-t border-[var(--twilight)] bg-[var(--void)] px-4 py-3">
        <button
          onClick={handleSubmit}
          disabled={createPlan.isPending || !title.trim() || !planDate}
          className="w-full min-h-[44px] bg-[var(--coral)] text-[var(--void)] font-mono text-sm font-medium rounded-lg py-2.5 hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {createPlan.isPending ? "Creating..." : "Create Plan"}
        </button>
      </div>
    </div>
  );
}
