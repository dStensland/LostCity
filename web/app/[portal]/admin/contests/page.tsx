"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { usePortal } from "@/lib/portal-context";
import type { BestOfContest } from "@/lib/best-of-contests";
import { formatTimeRemaining } from "@/lib/best-of-contests";

const STATUS_BADGE: Record<
  BestOfContest["status"],
  { label: string; bg: string; color: string; border: string }
> = {
  draft: {
    label: "Draft",
    bg: "rgba(255,255,255,0.06)",
    color: "#888",
    border: "#3A3A45",
  },
  active: {
    label: "Active",
    bg: "rgba(0,217,160,0.12)",
    color: "#00D9A0",
    border: "rgba(0,217,160,0.25)",
  },
  completed: {
    label: "Completed",
    bg: "rgba(0,212,232,0.12)",
    color: "#00D4E8",
    border: "rgba(0,212,232,0.25)",
  },
  archived: {
    label: "Archived",
    bg: "rgba(255,255,255,0.04)",
    color: "#555",
    border: "#2A2A35",
  },
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function AdminContestsPage({
  params,
}: {
  params: Promise<{ portal: string }>;
}) {
  const { portal: slug } = use(params);
  const { portal } = usePortal();

  const [contests, setContests] = useState<BestOfContest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(
          `/api/admin/portals/${portal.id}/contests`
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError((data as { error?: string }).error ?? "Failed to load contests");
          return;
        }
        const data = await res.json() as { contests: BestOfContest[] };
        setContests(data.contests ?? []);
      } catch {
        setError("Failed to load contests");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [portal.id]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--cream)] mb-1">
            Best Of Contests
          </h1>
          <p className="font-mono text-sm text-[var(--muted)]">
            Manage timed community voting contests for {portal.name}
          </p>
        </div>
        <Link
          href={`/${slug}/admin/contests/new`}
          className="px-4 py-2 rounded-lg font-mono text-sm font-medium transition-all"
          style={{
            background: "var(--coral)",
            color: "var(--void)",
          }}
        >
          + New Contest
        </Link>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 rounded-lg"
              style={{ background: "var(--dusk)", opacity: 0.6 }}
            />
          ))}
        </div>
      ) : error ? (
        <div
          className="p-4 rounded-lg"
          style={{
            background: "rgba(255,107,122,0.1)",
            border: "1px solid rgba(255,107,122,0.3)",
            color: "var(--coral)",
          }}
        >
          <p className="font-mono text-sm">{error}</p>
        </div>
      ) : contests.length === 0 ? (
        <div
          className="text-center py-16 rounded-lg"
          style={{ background: "var(--dusk)", border: "1px solid var(--twilight)" }}
        >
          <p className="text-sm text-[var(--muted)] mb-1">
            No contests yet
          </p>
          <p className="text-xs text-[var(--muted)] opacity-60 mb-4">
            Create your first Best Of contest to start collecting community votes
          </p>
          <Link
            href={`/${slug}/admin/contests/new`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-sm font-medium transition-all"
            style={{ background: "var(--coral)", color: "var(--void)" }}
          >
            Create Contest
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[var(--twilight)]">
          {/* Table header */}
          <div
            className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-4 py-3 border-b border-[var(--twilight)]"
            style={{ background: "var(--dusk)" }}
          >
            <span className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">
              Contest
            </span>
            <span className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider text-center w-20">
              Status
            </span>
            <span className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider text-center w-24 hidden sm:block">
              Dates
            </span>
            <span className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider text-right w-16 hidden sm:block">
              Time Left
            </span>
            <span className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider text-right w-16">
              Actions
            </span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-[var(--twilight)]">
            {contests.map((contest) => {
              const badge = STATUS_BADGE[contest.status];
              const timeLeft =
                contest.status === "active"
                  ? formatTimeRemaining(contest.endsAt)
                  : null;

              return (
                <div
                  key={contest.id}
                  className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 items-center px-4 py-4 hover:bg-white/[0.02] transition-colors"
                >
                  {/* Title + category */}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--cream)] truncate">
                      {contest.title}
                    </p>
                    {contest.prompt && (
                      <p className="text-xs text-[var(--muted)] truncate italic mt-0.5">
                        {contest.prompt}
                      </p>
                    )}
                    <p className="font-mono text-[10px] text-[var(--muted)] opacity-60 mt-0.5">
                      /{contest.slug}
                    </p>
                  </div>

                  {/* Status badge */}
                  <div className="flex items-center justify-center w-20">
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold"
                      style={{
                        background: badge.bg,
                        color: badge.color,
                        border: `1px solid ${badge.border}`,
                      }}
                    >
                      {badge.label}
                    </span>
                  </div>

                  {/* Dates */}
                  <div className="w-24 hidden sm:block">
                    <p className="text-[10px] font-mono text-[var(--muted)]">
                      {formatDate(contest.startsAt)}
                    </p>
                    <p className="text-[10px] font-mono text-[var(--muted)] opacity-60">
                      → {formatDate(contest.endsAt)}
                    </p>
                  </div>

                  {/* Time left */}
                  <div className="w-16 text-right hidden sm:block">
                    {timeLeft ? (
                      <span className="text-[10px] font-mono text-[var(--coral)]">
                        {timeLeft}
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono text-[var(--muted)] opacity-40">
                        —
                      </span>
                    )}
                  </div>

                  {/* Edit link */}
                  <div className="w-16 flex justify-end">
                    <Link
                      href={`/${slug}/admin/contests/${contest.id}`}
                      className="font-mono text-xs text-[var(--coral)] hover:opacity-80 transition-opacity"
                    >
                      Edit
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
