"use client";

import { useState } from "react";
import { CheckCircle } from "@phosphor-icons/react";
import { trackPortalAction } from "@/lib/analytics/portal-action-tracker";

export function VolunteerInterestButton({
  portalSlug,
  opportunityId,
  opportunitySlug,
  sectionKey,
  compact = false,
}: {
  portalSlug: string;
  opportunityId: string;
  opportunitySlug: string;
  sectionKey: string;
  compact?: boolean;
}) {
  const [tracked, setTracked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onTrack() {
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/volunteer/engagements", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          opportunity_id: opportunityId,
          status: "interested",
        }),
      });

      if (response.status === 401) {
        setMessage("Sign in to track opportunities.");
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      trackPortalAction(portalSlug, {
        action_type: "resource_clicked",
        page_type: "community",
        section_key: sectionKey,
        target_kind: "volunteer_interest",
        target_id: opportunityId,
        target_label: opportunitySlug,
        metadata: {
          surface: sectionKey,
          opportunity_slug: opportunitySlug,
        },
      });

      setTracked(true);
    } catch {
      setMessage("Could not save your interest right now.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={onTrack}
        disabled={saving || tracked}
        className={`inline-flex items-center justify-center gap-1 rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:opacity-70 ${
          compact
            ? tracked
              ? "bg-[var(--action-primary)]/18 text-[var(--action-primary)]"
              : "bg-[var(--action-primary)] text-[var(--btn-primary-text)] hover:bg-[var(--action-primary-hover)]"
            : tracked
              ? "bg-[#E6F3EF] text-[#2D6A4F]"
              : "bg-[#2D6A4F] text-white hover:bg-[#255740]"
        }`}
      >
        {tracked ? (
          <>
            <CheckCircle weight="bold" className="h-4 w-4" />
            Tracking
          </>
        ) : saving ? (
          "Saving..."
        ) : (
          "Track Interest"
        )}
      </button>
      {message && <p className="text-xs text-[var(--muted,#6D6C6A)]">{message}</p>}
    </div>
  );
}
