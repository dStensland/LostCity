"use client";

import Link from "next/link";
import { useCalendar } from "@/lib/calendar/CalendarProvider";
import { useRespondToPlan } from "@/lib/hooks/usePlans";
import type { CalendarPlan } from "@/lib/types/calendar";

interface PlanPreviewSheetProps {
  plan: CalendarPlan;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  active: "Active",
  completed: "Completed",
};

const STATUS_CLASSES: Record<string, string> = {
  draft:
    "bg-[var(--twilight)] text-[var(--soft)]",
  active:
    "bg-[var(--neon-cyan)]/15 text-[var(--neon-cyan)]",
  completed:
    "bg-[var(--neon-green)]/15 text-[var(--neon-green)]",
};

const PARTICIPANT_STATUS_COLORS: Record<string, string> = {
  accepted: "bg-[var(--neon-green)]",
  maybe: "bg-[var(--gold)]",
  declined: "bg-[var(--neon-red)]",
  invited: "bg-[var(--soft)]",
};

export function PlanPreviewSheet({ plan }: PlanPreviewSheetProps) {
  const { closeSheet } = useCalendar();
  const respondMutation = useRespondToPlan(plan.id);

  const handleRespond = (status: "accepted" | "declined" | "maybe") => {
    respondMutation.mutate(status);
  };

  const planDate = new Date(`${plan.plan_date}T00:00:00`);
  const dateLabel = planDate.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const statusClass =
    STATUS_CLASSES[plan.status] ?? STATUS_CLASSES.draft;
  const statusLabel = STATUS_LABELS[plan.status] ?? plan.status;

  return (
    <div className="flex flex-col h-full">
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {/* Plan title */}
        <div>
          <div className="flex items-start justify-between gap-2 mb-2">
            <h2 className="text-lg font-semibold text-[var(--cream)] leading-snug flex-1">
              {plan.title}
            </h2>
            <span
              className={`flex-shrink-0 px-2.5 py-1 rounded-full font-mono text-xs font-medium ${statusClass}`}
            >
              {statusLabel}
            </span>
          </div>

          {/* Date + time */}
          <div className="flex items-center gap-1.5 font-mono text-xs text-[var(--soft)]">
            <svg
              className="w-3.5 h-3.5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span>
              {dateLabel}
              {plan.plan_time && (
                <span className="text-[var(--muted)]">
                  {" · "}
                  {plan.plan_time.slice(0, 5)}
                </span>
              )}
            </span>
          </div>
        </div>

        {/* Description */}
        {plan.description && (
          <p className="text-sm text-[var(--soft)] leading-relaxed">
            {plan.description}
          </p>
        )}

        {/* Participants */}
        {plan.participants.length > 0 && (
          <div>
            <p className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
              {plan.participants.length === 1
                ? "1 Participant"
                : `${plan.participants.length} Participants`}
            </p>
            <div className="space-y-2">
              {plan.participants.map((p) => (
                <div
                  key={p.user_id}
                  className="flex items-center gap-3 py-1"
                >
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    {p.user.avatar_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={p.user.avatar_url}
                        alt={p.user.display_name ?? p.user.username}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-[var(--dusk)] flex items-center justify-center font-mono text-xs text-[var(--soft)]">
                        {(p.user.display_name ?? p.user.username)
                          .charAt(0)
                          .toUpperCase()}
                      </div>
                    )}
                    {/* Status dot */}
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[var(--void)] ${
                        PARTICIPANT_STATUS_COLORS[p.status] ??
                        PARTICIPANT_STATUS_COLORS.invited
                      }`}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-sm text-[var(--cream)] truncate">
                      {p.user.display_name ?? p.user.username}
                    </p>
                    <p className="font-mono text-xs text-[var(--muted)] capitalize">
                      {p.status}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Itinerary count */}
        {plan.item_count > 0 && (
          <div className="p-3 rounded-xl bg-[var(--night)] border border-[var(--twilight)]/40">
            <p className="font-mono text-xs text-[var(--muted)]">
              {plan.item_count === 1
                ? "1 item in itinerary"
                : `${plan.item_count} items in itinerary`}
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 border-t border-[var(--twilight)] bg-[var(--void)] px-4 py-3 space-y-2">
        {/* Respond buttons — only for non-creators */}
        {!plan.is_creator && (
          <div className="flex gap-2">
            <button
              onClick={() => handleRespond("accepted")}
              disabled={respondMutation.isPending}
              className={`flex-1 min-h-[44px] rounded-lg font-mono text-sm font-medium transition-all disabled:opacity-50 ${
                plan.participant_status === "accepted"
                  ? "bg-[var(--neon-green)] text-[var(--void)]"
                  : "bg-[var(--neon-green)]/15 border border-[var(--neon-green)]/40 text-[var(--neon-green)] hover:bg-[var(--neon-green)]/25"
              }`}
            >
              Accept
            </button>
            <button
              onClick={() => handleRespond("maybe")}
              disabled={respondMutation.isPending}
              className={`flex-1 min-h-[44px] rounded-lg font-mono text-sm font-medium transition-all disabled:opacity-50 ${
                plan.participant_status === "maybe"
                  ? "bg-[var(--gold)] text-[var(--void)]"
                  : "bg-[var(--gold)]/15 border border-[var(--gold)]/40 text-[var(--gold)] hover:bg-[var(--gold)]/25"
              }`}
            >
              Maybe
            </button>
            <button
              onClick={() => handleRespond("declined")}
              disabled={respondMutation.isPending}
              className={`flex-1 min-h-[44px] rounded-lg font-mono text-sm font-medium transition-all disabled:opacity-50 ${
                plan.participant_status === "declined"
                  ? "bg-[var(--neon-red)] text-[var(--void)]"
                  : "bg-[var(--neon-red)]/15 border border-[var(--neon-red)]/40 text-[var(--neon-red)] hover:bg-[var(--neon-red)]/25"
              }`}
            >
              Decline
            </button>
          </div>
        )}

        {/* View full plan link */}
        <Link
          href={`/plans/${plan.id}`}
          onClick={closeSheet}
          className="flex w-full min-h-[44px] items-center justify-center rounded-lg bg-[var(--twilight)] text-[var(--cream)] font-mono text-sm hover:bg-[var(--dusk)] transition-colors"
        >
          View Full Plan
        </Link>
      </div>
    </div>
  );
}
