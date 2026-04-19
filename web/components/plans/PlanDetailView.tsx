"use client";

import { useState, useCallback } from "react";
import {
  ShareNetwork,
  Link as LinkIcon,
  MapPin,
  CalendarDots,
  Clock,
  Plus,
  Check,
  ArrowLeft,
  UserPlus,
  Lightbulb,
} from "@phosphor-icons/react";
import { usePlan, useRespondToPlan, useInviteToPlan } from "@/lib/hooks/useUserPlans";

// useAddPlanItem: stub — new plans model removed item management from client hooks
function useAddPlanItem(_planId: string) {
  return {
    mutateAsync: async (_input: { title: string; event_id?: number; venue_id?: number; start_time?: string; note?: string }) => {
      throw new Error("useAddPlanItem is deprecated — use /api/plans directly");
    },
    isPending: false,
  };
}
// PlanItem and PlanSuggestion: local types — new plans model has no items array
type PlanItem = {
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
type PlanSuggestion = {
  id: string;
  suggestion_type: string;
  content: Record<string, unknown>;
  status: string;
  created_at: string;
  user: { id: string; username: string; display_name: string | null; avatar_url: string | null };
};
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/Toast";
import UserAvatar from "@/components/UserAvatar";
import { PlanInviteSheet } from "./PlanInviteSheet";
import Link from "next/link";
import { format, parseISO } from "date-fns";

interface PlanDetailViewProps {
  planId: string;
  onBack: () => void;
  portalSlug?: string;
}

// ─── Status chip ─────────────────────────────────────────────────────────────

const STATUS_CHIP: Record<string, { label: string; color: string }> = {
  draft:     { label: "Draft",     color: "bg-[var(--muted)]/15 text-[var(--muted)]" },
  active:    { label: "Active",    color: "bg-[var(--neon-cyan)]/15 text-[var(--neon-cyan)]" },
  completed: { label: "Completed", color: "bg-[var(--neon-green)]/15 text-[var(--neon-green)]" },
  cancelled: { label: "Cancelled", color: "bg-[var(--coral)]/15 text-[var(--coral)]" },
};

function StatusChip({ status }: { status: string }) {
  const chip = STATUS_CHIP[status] ?? STATUS_CHIP.draft;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-2xs font-mono font-medium ${chip.color}`}>
      {chip.label}
    </span>
  );
}

// ─── Participant avatar with status ring ──────────────────────────────────────

const PARTICIPANT_RING: Record<string, string> = {
  accepted: "ring-2 ring-[var(--neon-green)]",
  maybe:    "ring-2 ring-[var(--gold)]",
  declined: "ring-2 ring-[var(--coral)] opacity-50",
  invited:  "ring-1 ring-[var(--twilight)]",
};

// ─── Stop card ────────────────────────────────────────────────────────────────

function StopCard({ item, isCreator: _isCreator }: { item: PlanItem; isCreator: boolean }) {
  const timeStr = item.start_time
    ? format(parseISO(`2000-01-01T${item.start_time}`), "h:mm a")
    : null;

  const href = item.event_id
    ? `/events/${item.event_id}`
    : item.venue?.slug
      ? `/spots/${item.venue.slug}`
      : null;

  const inner = (
    <div className="flex items-start gap-3 p-3 sm:p-3.5 rounded-xl find-row-card-bg border border-[var(--twilight)]/75 border-l-2 border-l-[var(--neon-cyan)] group hover:border-[var(--twilight)] transition-colors">
      {/* Icon box */}
      <div className="flex-shrink-0 mt-0.5 w-8 h-8 rounded-lg bg-[var(--neon-cyan)]/10 border border-[var(--twilight)]/55 flex items-center justify-center">
        {item.event_id ? (
          <CalendarDots weight="duotone" className="w-4 h-4 text-[var(--neon-cyan)]" />
        ) : (
          <MapPin weight="duotone" className="w-4 h-4 text-[var(--neon-cyan)]" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-base font-semibold text-[var(--cream)] leading-tight group-hover:text-[var(--neon-cyan)] transition-colors truncate">
          {item.title}
        </p>
        {item.venue && item.event_id && (
          <p className="font-mono text-xs text-[var(--soft)] mt-0.5 truncate">
            {item.venue.name}
          </p>
        )}
        {item.note && (
          <p className="font-mono text-xs text-[var(--muted)] mt-1 line-clamp-2">
            {item.note}
          </p>
        )}
      </div>

      {/* Time */}
      {timeStr && (
        <div className="flex-shrink-0 flex items-center gap-1 text-xs font-mono text-[var(--soft)]">
          <Clock weight="regular" className="w-3 h-3" />
          {timeStr}
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {inner}
      </Link>
    );
  }
  return inner;
}

// ─── Suggestion card ──────────────────────────────────────────────────────────

function SuggestionCard({ suggestion }: { suggestion: PlanSuggestion }) {
  const label = suggestion.suggestion_type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  const contentText =
    typeof suggestion.content?.title === "string"
      ? suggestion.content.title
      : typeof suggestion.content?.text === "string"
        ? suggestion.content.text
        : null;

  return (
    <div className="p-3 rounded-xl bg-[var(--night)] border border-[var(--twilight)]/50 flex items-start gap-3">
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[var(--gold)]/10 border border-[var(--gold)]/20 flex items-center justify-center mt-0.5">
        <Lightbulb weight="duotone" className="w-4 h-4 text-[var(--gold)]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-mono text-2xs font-medium text-[var(--muted)] uppercase tracking-wider">
            {label}
          </span>
          <span className="font-mono text-2xs text-[var(--muted)] opacity-60">
            from {suggestion.user.display_name?.split(" ")[0] ?? suggestion.user.username}
          </span>
        </div>
        {contentText && (
          <p className="text-sm text-[var(--cream)]">{contentText}</p>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PlanDetailView({ planId, onBack, portalSlug = "atlanta" }: PlanDetailViewProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { data, isLoading } = usePlan(planId);
  const respondMutation = useRespondToPlan(planId);
  const addItemMutation = useAddPlanItem(planId);
  const inviteMutation = useInviteToPlan(planId);

  const [showAddItem, setShowAddItem] = useState(false);
  const [newItemTitle, setNewItemTitle] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleShareLink = useCallback(async () => {
    const shareToken = data?.plan?.share_token;
    if (!shareToken) return;
    const url = `${window.location.origin}/${portalSlug}/plans/share/${shareToken}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: data.plan.title ?? undefined, url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        showToast("Link copied!", "success");
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        showToast("Link copied!", "success");
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Last resort
      }
    }
  }, [data, portalSlug, showToast]);

  // ── Loading state ──────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-5">
        {/* Header skeleton */}
        <div className="space-y-2">
          <div className="h-7 w-56 bg-[var(--dusk)] rounded skeleton-shimmer" />
          <div className="h-4 w-40 bg-[var(--dusk)] rounded skeleton-shimmer" />
        </div>
        {/* Participants skeleton */}
        <div className="h-16 bg-[var(--dusk)] rounded-xl skeleton-shimmer" />
        {/* Items skeleton */}
        <div className="space-y-2.5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-[var(--dusk)] rounded-xl skeleton-shimmer" />
          ))}
        </div>
      </div>
    );
  }

  if (!data?.plan) {
    return (
      <div className="text-center py-16">
        <p className="font-mono text-sm text-[var(--muted)]">Plan not found.</p>
        <Link href="/plans" className="font-mono text-xs text-[var(--coral)] hover:underline mt-4 inline-block">
          ← View all plans
        </Link>
      </div>
    );
  }

  // Cast to legacy shape — this component predates the new Plan type
  // and will be fully rewritten in a future task
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const plan = data.plan as any;
  const isCreator = user?.id === plan.creator?.id;
  const myParticipation = (plan.participants ?? []).find((p: { user: { id: string } }) => p.user.id === user?.id);
  const dateStr = plan.plan_date ? format(parseISO(plan.plan_date), "EEEE, MMMM d") : format(parseISO(plan.starts_at ?? new Date().toISOString()), "EEEE, MMMM d");
  const timeStr = plan.plan_time
    ? format(parseISO(`2000-01-01T${plan.plan_time}`), "h:mm a")
    : null;

  const sortedItems = [...(plan.items ?? [])].sort((a: PlanItem, b: PlanItem) => a.sort_order - b.sort_order);
  const hasSuggestions = (plan.suggestions?.length ?? 0) > 0;

  const shareUrl = plan.share_token
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/${portalSlug}/plans/share/${plan.share_token}`
    : null;

  const handleAddItem = async () => {
    if (!newItemTitle.trim()) return;
    try {
      await addItemMutation.mutateAsync({
        title: newItemTitle.trim(),
      });
      setNewItemTitle("");
      setShowAddItem(false);
    } catch {
      showToast("Failed to add stop", "error");
    }
  };

  const handleInvite = async (userIds: string[]) => {
    try {
      await inviteMutation.mutateAsync({ user_ids: userIds });
      showToast("Invites sent!", "success");
      setShowInvite(false);
    } catch {
      showToast("Failed to invite", "error");
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6">

      {/* ── Plan header ── */}
      <div>
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 font-mono text-xs text-[var(--muted)] hover:text-[var(--cream)] transition-colors mb-4"
        >
          <ArrowLeft weight="bold" className="w-3.5 h-3.5" />
          All plans
        </button>

        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--cream)] leading-tight">
                {plan.title}
              </h1>
              <StatusChip status={plan.status} />
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <span className="flex items-center gap-1.5 font-mono text-xs text-[var(--soft)]">
                <CalendarDots weight="duotone" className="w-3.5 h-3.5 text-[var(--neon-cyan)]" />
                {dateStr}
              </span>
              {timeStr && (
                <span className="flex items-center gap-1.5 font-mono text-xs text-[var(--soft)]">
                  <Clock weight="duotone" className="w-3.5 h-3.5 text-[var(--neon-cyan)]" />
                  {timeStr}
                </span>
              )}
              <span className="font-mono text-xs text-[var(--muted)]">
                by {plan.creator.display_name || plan.creator.username}
              </span>
            </div>

            {plan.description && (
              <p className="text-sm text-[var(--soft)] mt-2 leading-relaxed">
                {plan.description}
              </p>
            )}
          </div>

          {/* Share button (creator) */}
          {isCreator && plan.share_token && (
            <button
              onClick={handleShareLink}
              className="flex-shrink-0 p-2.5 rounded-xl bg-[var(--twilight)]/50 border border-[var(--twilight)] text-[var(--soft)] hover:text-[var(--cream)] hover:bg-[var(--twilight)] transition-colors"
              title="Share plan"
            >
              <ShareNetwork weight="bold" className="w-4.5 h-4.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Response bar (non-creator participants) ── */}
      {!isCreator && myParticipation && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-[var(--night)] border border-[var(--twilight)]/50">
          <span className="font-mono text-xs text-[var(--muted)] mr-auto">Your response:</span>
          {(["going", "maybe", "declined"] as const).map((s) => (
            <button
              key={s}
              onClick={() => respondMutation.mutate({ rsvp_status: s })}
              disabled={respondMutation.isPending}
              className={`px-3 py-1.5 rounded-lg font-mono text-xs transition-colors ${
                myParticipation.status === s
                  ? s === "going"
                    ? "bg-[var(--neon-green)]/20 text-[var(--neon-green)] border border-[var(--neon-green)]/30"
                    : s === "maybe"
                      ? "bg-[var(--gold)]/20 text-[var(--gold)] border border-[var(--gold)]/30"
                      : "bg-[var(--coral)]/20 text-[var(--coral)] border border-[var(--coral)]/30"
                  : "bg-[var(--twilight)]/50 text-[var(--muted)] border border-transparent hover:text-[var(--cream)]"
              }`}
            >
              {s === "going" ? "I'm in" : s === "maybe" ? "Maybe" : "Can't make it"}
            </button>
          ))}
        </div>
      )}

      {/* ── Participant strip ── */}
      <div className="p-3.5 rounded-xl bg-[var(--night)] border border-[var(--twilight)]/50">
        <div className="flex items-center justify-between mb-3">
          <span className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-[var(--soft)]">
            Who&apos;s in
          </span>
          {isCreator && (
            <button
              onClick={() => setShowInvite(true)}
              className="flex items-center gap-1.5 font-mono text-xs text-[var(--neon-cyan)] hover:text-[var(--cream)] transition-colors"
            >
              <UserPlus weight="bold" className="w-3.5 h-3.5" />
              Invite
            </button>
          )}
        </div>

        {plan.participants.length === 0 ? (
          <p className="font-mono text-xs text-[var(--muted)]">No participants yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2.5">
            {plan.participants.map((p: { id: string; status: string; user: { avatar_url: string | null; display_name: string | null; username: string } }) => (
              <div key={p.id} className="flex flex-col items-center gap-1">
                <div className={`rounded-full ${PARTICIPANT_RING[p.status] ?? PARTICIPANT_RING.invited}`}>
                  <UserAvatar
                    src={p.user.avatar_url}
                    name={p.user.display_name || p.user.username}
                    size="sm"
                  />
                </div>
                <span className="font-mono text-2xs text-[var(--muted)] max-w-[48px] truncate text-center">
                  {p.user.display_name?.split(" ")[0] ?? p.user.username}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Status legend */}
        {plan.participants.length > 0 && (
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[var(--twilight)]/40">
            {[
              { status: "accepted", label: "Going",   color: "bg-[var(--neon-green)]" },
              { status: "maybe",    label: "Maybe",   color: "bg-[var(--gold)]" },
              { status: "declined", label: "Can't",  color: "bg-[var(--coral)]" },
              { status: "invited",  label: "Invited", color: "bg-[var(--muted)]" },
            ]
              .filter(({ status }) => plan.participants.some((p: { status: string }) => p.status === status))
              .map(({ label, color }) => (
                <div key={label} className="flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${color}`} />
                  <span className="font-mono text-2xs text-[var(--muted)]">{label}</span>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* ── Itinerary timeline ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-[var(--soft)]">
            The plan
          </span>
          {isCreator && (
            <button
              onClick={() => setShowAddItem(!showAddItem)}
              className="flex items-center gap-1.5 font-mono text-xs text-[var(--neon-cyan)] hover:text-[var(--cream)] transition-colors"
            >
              <Plus weight="bold" className="w-3.5 h-3.5" />
              Add stop
            </button>
          )}
        </div>

        {/* Add stop input */}
        {showAddItem && (
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              placeholder="Add a stop..."
              value={newItemTitle}
              onChange={(e) => setNewItemTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddItem()}
              className="flex-1 bg-[var(--night)] border border-[var(--twilight)] rounded-lg px-3 py-2.5 text-[var(--cream)] font-mono text-sm placeholder:text-[var(--muted)] focus:border-[var(--neon-cyan)] focus:outline-none transition-colors"
              autoFocus
            />
            <button
              onClick={handleAddItem}
              disabled={!newItemTitle.trim() || addItemMutation.isPending}
              className="px-4 py-2 bg-[var(--neon-cyan)]/15 border border-[var(--neon-cyan)]/30 text-[var(--neon-cyan)] rounded-lg font-mono text-sm font-medium disabled:opacity-50 hover:bg-[var(--neon-cyan)]/20 transition-colors"
            >
              Add
            </button>
          </div>
        )}

        {sortedItems.length === 0 ? (
          <div className="text-center py-10 rounded-xl border border-dashed border-[var(--twilight)]/60">
            <MapPin weight="duotone" className="w-8 h-8 text-[var(--twilight)] mx-auto mb-2" />
            <p className="font-mono text-sm text-[var(--muted)]">
              {isCreator ? 'No stops yet — add one above.' : 'No stops added yet.'}
            </p>
          </div>
        ) : (
          <div className="relative pl-5">
            {/* Vertical timeline line */}
            <div className="absolute left-[9px] top-4 bottom-4 w-px bg-[var(--twilight)]" />

            <div className="space-y-2.5">
              {sortedItems.map((item, idx) => (
                <div key={item.id} className="relative flex items-start gap-3">
                  {/* Timeline dot */}
                  <div className="absolute -left-5 mt-4 w-2.5 h-2.5 rounded-full border-2 border-[var(--neon-cyan)] bg-[var(--void)] flex-shrink-0 z-10" />
                  {/* Order label when no time */}
                  {!item.start_time && (
                    <span className="sr-only">Stop {idx + 1}</span>
                  )}
                  <div className="flex-1 min-w-0">
                    <StopCard item={item} isCreator={isCreator} />
                  </div>
                </div>
              ))}

              {/* Add a stop CTA at bottom */}
              {isCreator && (
                <div className="relative flex items-start gap-3">
                  <div className="absolute -left-5 mt-3.5 w-2.5 h-2.5 rounded-full border-2 border-dashed border-[var(--twilight)] bg-[var(--void)] flex-shrink-0 z-10" />
                  <button
                    onClick={() => {
                      setShowAddItem(true);
                      setTimeout(() => {
                        const input = document.querySelector<HTMLInputElement>("input[placeholder='Add a stop...']");
                        input?.focus();
                      }, 50);
                    }}
                    className="flex-1 flex items-center gap-2 p-3 rounded-xl border border-dashed border-[var(--twilight)]/60 text-[var(--muted)] hover:text-[var(--neon-cyan)] hover:border-[var(--neon-cyan)]/40 transition-colors font-mono text-xs"
                  >
                    <Plus weight="bold" className="w-3.5 h-3.5" />
                    Add a stop
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Share section ── */}
      {shareUrl && (
        <div className="p-3.5 rounded-xl bg-[var(--night)] border border-[var(--twilight)]/50">
          <span className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-[var(--soft)] block mb-3">
            Share
          </span>
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] overflow-hidden">
              <LinkIcon weight="bold" className="w-3.5 h-3.5 text-[var(--muted)] flex-shrink-0" />
              <span className="font-mono text-xs text-[var(--soft)] truncate">{shareUrl}</span>
            </div>
            <button
              onClick={handleShareLink}
              className={`flex items-center gap-1.5 flex-shrink-0 px-3.5 py-2.5 rounded-lg font-mono text-xs font-medium transition-all ${
                copied
                  ? "bg-[var(--neon-green)]/15 text-[var(--neon-green)] border border-[var(--neon-green)]/25"
                  : "bg-[var(--neon-cyan)]/15 text-[var(--neon-cyan)] border border-[var(--neon-cyan)]/25 hover:bg-[var(--neon-cyan)]/20"
              }`}
            >
              {copied ? (
                <>
                  <Check weight="bold" className="w-3.5 h-3.5" />
                  Copied
                </>
              ) : (
                <>
                  <LinkIcon weight="bold" className="w-3.5 h-3.5" />
                  Copy link
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── Suggestions ── */}
      {hasSuggestions && (
        <div>
          <span className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-[var(--soft)] block mb-3">
            Suggestions
          </span>
          <div className="space-y-2">
            {(plan.suggestions as PlanSuggestion[]).map((s) => (
              <SuggestionCard key={s.id} suggestion={s} />
            ))}
          </div>
        </div>
      )}

      {/* ── Invite sheet ── */}
      {showInvite && (
        <PlanInviteSheet
          planId={planId}
          existingParticipantIds={(plan.participants ?? []).map((p: { user: { id: string } }) => p.user.id)}
          onInvite={handleInvite}
          onClose={() => setShowInvite(false)}
        />
      )}
    </div>
  );
}
