"use client";

import { format, parseISO } from "date-fns";
import { AvatarStack } from "@/components/UserAvatar";
import type { Plan } from "@/lib/hooks/usePlans";

interface PlanCardProps {
  plan: Plan;
  onClick: () => void;
}

export function PlanCard({ plan, onClick }: PlanCardProps) {
  const dateStr = format(parseISO(plan.plan_date), "EEE, MMM d");
  const timeStr = plan.plan_time
    ? format(parseISO(`2000-01-01T${plan.plan_time}`), "h:mm a")
    : null;

  const acceptedCount = plan.participants.filter((p) => p.status === "accepted").length;
  const pendingCount = plan.participants.filter((p) => p.status === "invited").length;

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-4 glass border border-[var(--twilight)] rounded-xl hover:border-[var(--coral)]/30 transition-all group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-[var(--cream)] group-hover:text-[var(--coral)] transition-colors truncate">
            {plan.title}
          </h4>
          <p className="font-mono text-xs text-[var(--muted)] mt-0.5">
            {dateStr}{timeStr ? ` · ${timeStr}` : ""}
          </p>
          {plan.items.length > 0 && (
            <p className="font-mono text-xs text-[var(--soft)] mt-1">
              {plan.items.length} {plan.items.length === 1 ? "stop" : "stops"}
              {plan.items[0] && ` · ${plan.items[0].title}`}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <AvatarStack
            users={plan.participants
              .filter((p) => p.status === "accepted")
              .map((p) => ({
                id: p.user.id,
                name: p.user.display_name || p.user.username,
                avatar_url: p.user.avatar_url,
              }))}
            max={3}
            size="xs"
          />
          <span className="font-mono text-[0.55rem] text-[var(--muted)]">
            {acceptedCount} in{pendingCount > 0 ? ` · ${pendingCount} pending` : ""}
          </span>
        </div>
      </div>
    </button>
  );
}
