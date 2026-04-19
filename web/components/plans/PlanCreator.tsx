"use client";

import { useState, useCallback } from "react";
import { ShareNetwork, Link as LinkIcon, Check, X } from "@phosphor-icons/react";
import { useCreatePlan } from "@/lib/hooks/useUserPlans";
import { usePortal } from "@/lib/portal-context";
import { useToast } from "@/components/Toast";

interface PlanCreatorProps {
  onClose: () => void;
  onCreated: (planId: string) => void;
  portalSlug?: string;
}

export function PlanCreator({ onClose, onCreated, portalSlug = "atlanta" }: PlanCreatorProps) {
  const { showToast } = useToast();
  const { portal } = usePortal();
  const createPlan = useCreatePlan();

  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [description, setDescription] = useState("");
  void description; // not in new API — kept for UI UX

  // Share step state
  const [shareStep, setShareStep] = useState<{
    planId: string;
    shareToken: string;
    title: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date) return;

    try {
      const startsAt = time
        ? new Date(`${date}T${time}`).toISOString()
        : new Date(`${date}T12:00:00`).toISOString();

      const result = await createPlan.mutateAsync({
        anchor_type: "event",
        anchor_id: 0, // placeholder — PlanCreator is a legacy component; no anchor
        portal_id: portal?.id ?? portalSlug,
        starts_at: startsAt,
        title: title.trim(),
      });

      // If we got a share_token, show the share step
      if (result.plan.share_token) {
        setShareStep({
          planId: result.plan.id,
          shareToken: result.plan.share_token,
          title: title.trim(),
        });
      } else {
        // Fallback — go straight to plan detail
        showToast("Plan created!", "success");
        onCreated(result.plan.id);
      }
    } catch {
      showToast("Failed to create plan", "error");
    }
  };

  const shareUrl = shareStep
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/${portalSlug}/plans/share/${shareStep.shareToken}`
    : null;

  const handleCopyLink = useCallback(async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = shareUrl;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [shareUrl]);

  const handleNativeShare = useCallback(async () => {
    if (!shareUrl || !shareStep) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: shareStep.title,
          text: `Join my plan: ${shareStep.title}`,
          url: shareUrl,
        });
      } catch {
        // User cancelled share — no action needed
      }
    }
  }, [shareUrl, shareStep]);

  const handleSkipShare = () => {
    if (shareStep) {
      onCreated(shareStep.planId);
    }
  };

  // ─── Share Step ──────────────────────────────────────────────────
  if (shareStep && shareUrl) {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
        <div className="absolute inset-0 bg-black/60" onClick={handleSkipShare} />

        <div className="relative w-full sm:max-w-md bg-[var(--dusk)] border border-[var(--twilight)] rounded-t-2xl sm:rounded-2xl animate-fadeIn">
          <div className="flex justify-center pt-3 pb-1 sm:hidden">
            <div className="w-10 h-1 rounded-full bg-[var(--twilight)]" />
          </div>

          <div className="p-5 space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--coral)]/15 flex items-center justify-center">
                  <Check weight="bold" className="w-5 h-5 text-[var(--coral)]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--cream)]">Plan created!</p>
                  <p className="text-xs text-[var(--soft)]">Invite friends to join</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSkipShare}
                className="text-[var(--muted)] hover:text-[var(--cream)] transition-colors p-1"
              >
                <X weight="bold" className="w-4 h-4" />
              </button>
            </div>

            {/* Plan title preview */}
            <div className="p-3 rounded-lg bg-[var(--night)] border border-[var(--twilight)]/40">
              <p className="text-sm font-medium text-[var(--cream)]">{shareStep.title}</p>
              <p className="text-xs text-[var(--muted)] mt-0.5">
                Share this link so friends can see your plan and join
              </p>
            </div>

            {/* Copy link */}
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-lg bg-[var(--night)] border border-[var(--twilight)] overflow-hidden">
                <LinkIcon weight="bold" className="w-4 h-4 text-[var(--muted)] flex-shrink-0" />
                <span className="text-xs text-[var(--soft)] truncate font-mono">{shareUrl}</span>
              </div>
              <button
                onClick={handleCopyLink}
                className={`px-4 py-2.5 rounded-lg font-mono text-sm font-medium transition-all flex-shrink-0 ${
                  copied
                    ? "bg-[var(--neon-green)]/15 text-[var(--neon-green)] border border-[var(--neon-green)]/20"
                    : "bg-[var(--coral)] text-[var(--void)] hover:brightness-110"
                }`}
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              {typeof navigator !== "undefined" && "share" in navigator && (
                <button
                  onClick={handleNativeShare}
                  className="flex-1 py-2.5 rounded-lg bg-[var(--twilight)] text-[var(--cream)] font-mono text-sm hover:bg-[var(--twilight)]/80 transition-colors flex items-center justify-center gap-2"
                >
                  <ShareNetwork weight="bold" className="w-4 h-4" />
                  Share
                </button>
              )}
              <button
                onClick={handleSkipShare}
                className="flex-1 py-2.5 rounded-lg bg-[var(--night)] text-[var(--soft)] font-mono text-sm hover:text-[var(--cream)] transition-colors border border-[var(--twilight)]"
              >
                Continue to Plan
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Create Step ─────────────────────────────────────────────────
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
              <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-1">
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
              <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-1">
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
