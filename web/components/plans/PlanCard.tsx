"use client";

import { format, parseISO } from "date-fns";
import type { Plan } from "@/lib/types/plans";

interface PlanCardProps {
  plan: Plan;
  onClick: () => void;
}

export function PlanCard({ plan, onClick }: PlanCardProps) {
  const dateStr = format(parseISO(plan.starts_at), "EEE, MMM d");
  const timeStr = format(parseISO(plan.starts_at), "h:mm a");

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-4 glass border border-[var(--twilight)] rounded-xl hover:border-[var(--coral)]/30 transition-all group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-[var(--cream)] group-hover:text-[var(--coral)] transition-colors truncate">
            {plan.title ?? "Untitled plan"}
          </h4>
          <p className="font-mono text-xs text-[var(--muted)] mt-0.5">
            {dateStr} · {timeStr}
          </p>
          <p className="font-mono text-xs text-[var(--soft)] mt-1 capitalize">
            {plan.anchor_type} plan · {plan.visibility}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className={`inline-block px-2 py-0.5 rounded-full font-mono text-2xs font-bold capitalize ${
            plan.status === "active"
              ? "bg-[var(--neon-green)]/15 text-[var(--neon-green)]"
              : plan.status === "planning"
              ? "bg-[var(--coral)]/15 text-[var(--coral)]"
              : "bg-[var(--twilight)] text-[var(--muted)]"
          }`}>
            {plan.status}
          </span>
        </div>
      </div>
    </button>
  );
}
