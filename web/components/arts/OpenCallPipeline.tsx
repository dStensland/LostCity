"use client";

import { useState, useEffect, useCallback } from "react";
import { BookmarkSimple, CheckCircle, Timer, ArrowSquareOut } from "@phosphor-icons/react";
import { useAuthenticatedFetch } from "@/lib/hooks/useAuthenticatedFetch";
import { formatDeadline, isDeadlineSoon } from "@/lib/types/open-calls";
import type { TrackingStatus } from "@/lib/types/open-call-tracking";
import type { OpenCall } from "@/lib/types/open-calls";

interface TrackedCall {
  id: string;
  open_call_id: string;
  status: TrackingStatus;
  notes: string | null;
  updated_at: string;
  open_call: (OpenCall & {
    organization: { id: string; name: string; slug: string } | null;
    venue: { id: number; name: string; slug: string; neighborhood: string | null } | null;
  }) | null;
}

interface OpenCallPipelineProps {
  portalSlug: string;
}

export function OpenCallPipeline({ portalSlug }: OpenCallPipelineProps) {
  const { authFetch, user } = useAuthenticatedFetch();
  const [tracked, setTracked] = useState<TrackedCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TrackingStatus | "all">("saved");

  const fetchTracked = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await authFetch<{ tracked: TrackedCall[] }>(
      "/api/open-calls/track"
    );
    if (data) {
      setTracked(data.tracked);
    }
    setLoading(false);
  }, [user, authFetch]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount loading pattern: fetchTracked internally toggles loading + sets tracked. Cascade bounded — neither loading nor tracked is in the dep array ([fetchTracked]).
    fetchTracked();
  }, [fetchTracked]);

  if (!user) return null;

  const filtered =
    activeTab === "all"
      ? tracked
      : tracked.filter((t) => t.status === activeTab);

  const savedCount = tracked.filter((t) => t.status === "saved").length;
  const appliedCount = tracked.filter((t) => t.status === "applied").length;

  const tabs = [
    { key: "saved" as const, label: "Saved", count: savedCount },
    { key: "applied" as const, label: "Applied", count: appliedCount },
    { key: "all" as const, label: "All", count: tracked.length },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-[var(--action-primary)]">
        {"// your pipeline"}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`font-mono text-xs px-3 py-1.5 border rounded-none transition-colors ${
              activeTab === tab.key
                ? "border-[var(--action-primary)] text-[var(--action-primary)]"
                : "border-[var(--twilight)] text-[var(--muted)] hover:text-[var(--soft)]"
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="ml-1.5 opacity-60">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="border border-[var(--twilight)] rounded-none p-4 h-20 animate-pulse bg-[var(--twilight)]/10"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-[var(--twilight)] rounded-none p-6 text-center">
          <p className="font-mono text-sm text-[var(--muted)]">
            {activeTab === "saved"
              ? "// no saved calls yet — browse open calls and save ones you're interested in"
              : activeTab === "applied"
                ? "// no applications tracked yet"
                : "// your pipeline is empty"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => {
            if (!item.open_call) return null;
            const call = item.open_call;
            const urgent = isDeadlineSoon(call, 7);

            return (
              <div
                key={item.id}
                className="border border-[var(--twilight)] rounded-none p-3 sm:p-4 flex items-start justify-between gap-3 group"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {item.status === "saved" ? (
                      <BookmarkSimple
                        size={14}
                        weight="fill"
                        className="text-[var(--action-primary)] flex-shrink-0"
                      />
                    ) : (
                      <CheckCircle
                        size={14}
                        weight="fill"
                        className="text-[var(--neon-green)] flex-shrink-0"
                      />
                    )}
                    <span className="font-mono text-sm text-[var(--cream)] truncate">
                      {call.title}
                    </span>
                  </div>
                  <div className="font-mono text-xs text-[var(--muted)]">
                    {call.organization?.name}
                    <span className="mx-1.5">·</span>
                    <span className={urgent ? "text-[var(--action-primary)]" : ""}>
                      <Timer size={11} weight="bold" className="inline mr-0.5" />
                      {formatDeadline(call.deadline)}
                    </span>
                  </div>
                </div>
                <a
                  href={call.application_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 text-[var(--muted)] hover:text-[var(--action-primary)] transition-colors"
                  title="Open application"
                >
                  <ArrowSquareOut size={16} weight="bold" />
                </a>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
