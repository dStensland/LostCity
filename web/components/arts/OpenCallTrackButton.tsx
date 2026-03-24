"use client";

import { useState } from "react";
import { BookmarkSimple, Check } from "@phosphor-icons/react";
import { useAuthenticatedFetch } from "@/lib/hooks/useAuthenticatedFetch";
import type { TrackingStatus } from "@/lib/types/open-call-tracking";

interface OpenCallTrackButtonProps {
  openCallId: string;
  initialStatus?: TrackingStatus | null;
}

export function OpenCallTrackButton({
  openCallId,
  initialStatus = null,
}: OpenCallTrackButtonProps) {
  const { authFetch, user } = useAuthenticatedFetch();
  const [status, setStatus] = useState<TrackingStatus | null>(initialStatus);
  const [loading, setLoading] = useState(false);

  const handleSave = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;

    setLoading(true);

    if (status === "saved") {
      // Unsave
      const { error } = await authFetch(
        `/api/open-calls/track?open_call_id=${openCallId}`,
        { method: "DELETE" }
      );
      if (!error) setStatus(null);
    } else {
      // Save
      const { error } = await authFetch("/api/open-calls/track", {
        method: "POST",
        body: { open_call_id: openCallId, status: "saved" },
      });
      if (!error) setStatus("saved");
    }

    setLoading(false);
  };

  const handleApplied = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;

    setLoading(true);
    const newStatus = status === "applied" ? "saved" : "applied";
    const { error } = await authFetch("/api/open-calls/track", {
      method: "POST",
      body: { open_call_id: openCallId, status: newStatus },
    });
    if (!error) setStatus(newStatus);
    setLoading(false);
  };

  if (!user) return null;

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={handleSave}
        disabled={loading}
        className={`p-1.5 rounded-none border transition-colors ${
          status === "saved" || status === "applied"
            ? "border-[var(--action-primary)] text-[var(--action-primary)]"
            : "border-[var(--twilight)] text-[var(--muted)] hover:text-[var(--action-primary)] hover:border-[var(--action-primary)]/40"
        }`}
        title={status ? "Unsave" : "Save"}
      >
        <BookmarkSimple
          size={14}
          weight={status ? "fill" : "regular"}
        />
      </button>
      {status && (
        <button
          onClick={handleApplied}
          disabled={loading}
          className={`font-mono text-2xs uppercase tracking-wider px-2 py-1 border rounded-none transition-colors ${
            status === "applied"
              ? "border-[var(--neon-green)] text-[var(--neon-green)]"
              : "border-[var(--twilight)] text-[var(--muted)] hover:text-[var(--neon-green)] hover:border-[var(--neon-green)]/40"
          }`}
          title={status === "applied" ? "Undo applied" : "Mark as applied"}
        >
          <Check size={10} weight="bold" className="inline mr-0.5" />
          {status === "applied" ? "Applied" : "Applied?"}
        </button>
      )}
    </div>
  );
}
