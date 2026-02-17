"use client";

import { useState } from "react";
import { usePlan, useRespondToPlan, useAddPlanItem, useInviteToPlan } from "@/lib/hooks/usePlans";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/Toast";
import UserAvatar from "@/components/UserAvatar";
import { PlanItemRow } from "./PlanItemRow";
import { PlanInviteSheet } from "./PlanInviteSheet";
import { format, parseISO } from "date-fns";

interface PlanDetailViewProps {
  planId: string;
  onBack: () => void;
}

export function PlanDetailView({ planId, onBack }: PlanDetailViewProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { data, isLoading } = usePlan(planId);
  const respondMutation = useRespondToPlan(planId);
  const addItemMutation = useAddPlanItem(planId);
  const inviteMutation = useInviteToPlan(planId);

  const [showAddItem, setShowAddItem] = useState(false);
  const [newItemTitle, setNewItemTitle] = useState("");
  const [showInvite, setShowInvite] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <div className="h-6 w-48 skeleton-shimmer rounded" />
        <div className="h-4 w-32 skeleton-shimmer rounded" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 skeleton-shimmer rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!data?.plan) {
    return (
      <div className="text-center py-12">
        <p className="text-[var(--muted)]">Plan not found</p>
      </div>
    );
  }

  const plan = data.plan;
  const isCreator = user?.id === plan.creator.id;
  const myParticipation = plan.participants.find((p) => p.user.id === user?.id);
  const dateStr = format(parseISO(plan.plan_date), "EEEE, MMMM d");
  const timeStr = plan.plan_time
    ? format(parseISO(`2000-01-01T${plan.plan_time}`), "h:mm a")
    : null;

  const sortedItems = [...plan.items].sort((a, b) => a.sort_order - b.sort_order);

  const handleAddItem = async () => {
    if (!newItemTitle.trim()) return;
    try {
      await addItemMutation.mutateAsync({
        title: newItemTitle.trim(),
        sort_order: plan.items.length,
      });
      setNewItemTitle("");
      setShowAddItem(false);
    } catch {
      showToast("Failed to add", "error");
    }
  };

  const handleInvite = async (userIds: string[]) => {
    try {
      await inviteMutation.mutateAsync(userIds);
      showToast("Invites sent!", "success");
      setShowInvite(false);
    } catch {
      showToast("Failed to invite", "error");
    }
  };

  return (
    <div className="space-y-4">
      {/* Back button + header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-[var(--cream)]">{plan.title}</h2>
          <p className="font-mono text-xs text-[var(--muted)]">
            {dateStr}{timeStr ? ` · ${timeStr}` : ""} · by {plan.creator.display_name || plan.creator.username}
          </p>
        </div>
      </div>

      {plan.description && (
        <p className="text-sm text-[var(--soft)] px-2">{plan.description}</p>
      )}

      {/* Response bar (for non-creators) */}
      {!isCreator && myParticipation && (
        <div className="flex items-center gap-2 p-3 glass border border-[var(--twilight)] rounded-xl">
          <span className="font-mono text-xs text-[var(--muted)] mr-auto">Your response:</span>
          {(["accepted", "maybe", "declined"] as const).map((s) => (
            <button
              key={s}
              onClick={() => respondMutation.mutate(s)}
              disabled={respondMutation.isPending}
              className={`px-3 py-1.5 rounded-lg font-mono text-xs transition-colors ${
                myParticipation.status === s
                  ? s === "accepted"
                    ? "bg-[var(--neon-green)]/20 text-[var(--neon-green)]"
                    : s === "maybe"
                      ? "bg-[var(--gold)]/20 text-[var(--gold)]"
                      : "bg-[var(--coral)]/20 text-[var(--coral)]"
                  : "bg-[var(--twilight)]/50 text-[var(--muted)] hover:text-[var(--cream)]"
              }`}
            >
              {s === "accepted" ? "I'm in" : s === "maybe" ? "Maybe" : "Can't make it"}
            </button>
          ))}
        </div>
      )}

      {/* Participants */}
      <div className="p-3 glass border border-[var(--twilight)] rounded-xl">
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--soft)]">
            Who&apos;s in
          </span>
          {isCreator && (
            <button
              onClick={() => setShowInvite(true)}
              className="font-mono text-xs text-[var(--coral)] hover:text-[var(--rose)] transition-colors"
            >
              + Invite
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {plan.participants.map((p) => (
            <div key={p.id} className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-[var(--twilight)]/30">
              <UserAvatar
                src={p.user.avatar_url}
                name={p.user.display_name || p.user.username}
                size="xs"
              />
              <span className="font-mono text-xs text-[var(--cream)]">
                {p.user.display_name?.split(" ")[0] || p.user.username}
              </span>
              <span className={`w-1.5 h-1.5 rounded-full ${
                p.status === "accepted" ? "bg-[var(--neon-green)]"
                : p.status === "maybe" ? "bg-[var(--gold)]"
                : p.status === "declined" ? "bg-[var(--coral)]"
                : "bg-[var(--muted)]"
              }`} />
            </div>
          ))}
        </div>
      </div>

      {/* Items (timeline) */}
      <div>
        <div className="flex items-center justify-between mb-2 px-2">
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--soft)]">
            The plan
          </span>
          {isCreator && (
            <button
              onClick={() => setShowAddItem(!showAddItem)}
              className="font-mono text-xs text-[var(--coral)] hover:text-[var(--rose)] transition-colors"
            >
              + Add stop
            </button>
          )}
        </div>

        {/* Add item input */}
        {showAddItem && (
          <div className="flex gap-2 mb-2 px-2">
            <input
              type="text"
              placeholder="Add a stop..."
              value={newItemTitle}
              onChange={(e) => setNewItemTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddItem()}
              className="flex-1 bg-[var(--night)] border border-[var(--twilight)] rounded-lg px-3 py-2 text-[var(--cream)] font-mono text-sm placeholder:text-[var(--muted)] focus:border-[var(--coral)] focus:outline-none"
              autoFocus
            />
            <button
              onClick={handleAddItem}
              disabled={!newItemTitle.trim() || addItemMutation.isPending}
              className="px-3 py-2 bg-[var(--coral)] text-[var(--void)] rounded-lg font-mono text-sm disabled:opacity-50"
            >
              Add
            </button>
          </div>
        )}

        {sortedItems.length === 0 ? (
          <p className="text-center font-mono text-sm text-[var(--muted)] py-6">
            No stops yet. {isCreator ? "Add some!" : ""}
          </p>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[1.5rem] top-3 bottom-3 w-px bg-[var(--twilight)]" />
            <div className="space-y-0.5">
              {sortedItems.map((item) => (
                <PlanItemRow
                  key={item.id}
                  item={item}
                  isCreator={isCreator}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Invite sheet */}
      {showInvite && (
        <PlanInviteSheet
          planId={planId}
          existingParticipantIds={plan.participants.map((p) => p.user.id)}
          onInvite={handleInvite}
          onClose={() => setShowInvite(false)}
        />
      )}
    </div>
  );
}
