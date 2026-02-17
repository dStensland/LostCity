"use client";

import { useState } from "react";
import { useCreatePlan } from "@/lib/hooks/usePlans";
import { useToast } from "@/components/Toast";

interface PlanCreatorProps {
  onClose: () => void;
  onCreated: (planId: string) => void;
}

export function PlanCreator({ onClose, onCreated }: PlanCreatorProps) {
  const { showToast } = useToast();
  const createPlan = useCreatePlan();

  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date) return;

    try {
      const result = await createPlan.mutateAsync({
        title: title.trim(),
        plan_date: date,
        plan_time: time || undefined,
        description: description.trim() || undefined,
      });

      showToast("Plan created!", "success");
      onCreated(result.plan.id);
    } catch {
      showToast("Failed to create plan", "error");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative w-full sm:max-w-md bg-[var(--dusk)] border border-[var(--twilight)] rounded-t-2xl sm:rounded-2xl animate-fadeIn">
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-[var(--twilight)]" />
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-mono text-sm font-semibold text-[var(--cream)]">
              New Plan
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div>
            <input
              type="text"
              placeholder="What's the plan?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-[var(--night)] border border-[var(--twilight)] rounded-lg px-3 py-2.5 text-[var(--cream)] font-mono text-sm placeholder:text-[var(--muted)] focus:border-[var(--coral)] focus:outline-none"
              autoFocus
              maxLength={100}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-mono text-[0.6rem] text-[var(--muted)] uppercase tracking-wider mb-1">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-[var(--night)] border border-[var(--twilight)] rounded-lg px-3 py-2 text-[var(--cream)] font-mono text-sm focus:border-[var(--coral)] focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block font-mono text-[0.6rem] text-[var(--muted)] uppercase tracking-wider mb-1">
                Time (optional)
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full bg-[var(--night)] border border-[var(--twilight)] rounded-lg px-3 py-2 text-[var(--cream)] font-mono text-sm focus:border-[var(--coral)] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <textarea
              placeholder="Notes (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full bg-[var(--night)] border border-[var(--twilight)] rounded-lg px-3 py-2 text-[var(--cream)] font-mono text-sm placeholder:text-[var(--muted)] focus:border-[var(--coral)] focus:outline-none resize-none"
              maxLength={500}
            />
          </div>

          <button
            type="submit"
            disabled={!title.trim() || !date || createPlan.isPending}
            className="w-full py-2.5 bg-[var(--coral)] text-[var(--void)] rounded-xl font-mono text-sm font-medium hover:bg-[var(--rose)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {createPlan.isPending ? "Creating..." : "Create Plan"}
          </button>
        </form>
      </div>
    </div>
  );
}
