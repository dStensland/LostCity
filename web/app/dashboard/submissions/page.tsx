"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import UnifiedHeader from "@/components/UnifiedHeader";
import { useAuth } from "@/lib/auth-context";
import type { SubmissionWithProfile, SubmissionStatus, SubmissionType } from "@/lib/types";

const STATUS_LABELS: Record<SubmissionStatus, { label: string; color: string }> = {
  pending: { label: "Pending Review", color: "yellow" },
  approved: { label: "Approved", color: "green" },
  rejected: { label: "Not Approved", color: "red" },
  needs_edit: { label: "Needs Changes", color: "orange" },
};

const TYPE_LABELS: Record<SubmissionType, string> = {
  event: "Event",
  venue: "Venue",
  producer: "Organization",
};

export default function UserSubmissionsPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const success = searchParams.get("success");

  const [submissions, setSubmissions] = useState<SubmissionWithProfile[]>([]);
  const [counts, setCounts] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    needs_edit: 0,
  });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<SubmissionStatus | "all">("all");

  useEffect(() => {
    if (!user) return;

    const fetchSubmissions = async () => {
      setLoading(true);
      try {
        const url = filter === "all"
          ? "/api/submissions"
          : `/api/submissions?status=${filter}`;
        const res = await fetch(url);
        const data = await res.json();
        setSubmissions(data.submissions || []);
        setCounts(data.counts || counts);
      } catch (err) {
        console.error("Failed to fetch submissions:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSubmissions();
  }, [user, filter]);

  if (!user) {
    return (
      <div className="min-h-screen">
        <UnifiedHeader />
        <main className="max-w-4xl mx-auto px-4 py-12 text-center">
          <p className="text-[var(--muted)]">Please sign in to view your submissions.</p>
        </main>
      </div>
    );
  }

  const trustScore = counts.approved + counts.rejected > 0
    ? (counts.approved / (counts.approved + counts.rejected) * 100).toFixed(0)
    : null;
  const isTrusted = counts.approved >= 5 && trustScore !== null && parseInt(trustScore) >= 90;

  return (
    <div className="min-h-screen">
      <UnifiedHeader />

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--cream)]">
              My Submissions
            </h1>
            <p className="text-[var(--muted)] font-mono text-sm mt-1">
              Track your submitted events, venues, and organizations
            </p>
          </div>
          <Link
            href="/submit"
            className="px-4 py-2 rounded-lg bg-[var(--coral)] text-[var(--void)] font-mono text-sm font-medium hover:bg-[var(--rose)] transition-colors"
          >
            Submit New
          </Link>
        </div>

        {/* Success Message */}
        {success && (
          <div className="mb-6 p-4 rounded-lg bg-green-500/10 border border-green-500 text-green-400 font-mono text-sm">
            Your {success} submission was received! We&apos;ll review it soon.
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-8">
          <button
            onClick={() => setFilter("all")}
            className={`p-4 rounded-xl border transition-colors ${
              filter === "all"
                ? "border-[var(--coral)] bg-[var(--coral)]/10"
                : "border-[var(--twilight)] bg-[var(--dusk)] hover:border-[var(--coral)]"
            }`}
          >
            <div className="font-mono text-2xl font-bold text-[var(--cream)]">{counts.total}</div>
            <div className="font-mono text-xs text-[var(--muted)]">Total</div>
          </button>
          <button
            onClick={() => setFilter("pending")}
            className={`p-4 rounded-xl border transition-colors ${
              filter === "pending"
                ? "border-yellow-500 bg-yellow-500/10"
                : "border-[var(--twilight)] bg-[var(--dusk)] hover:border-yellow-500"
            }`}
          >
            <div className="font-mono text-2xl font-bold text-yellow-400">{counts.pending}</div>
            <div className="font-mono text-xs text-[var(--muted)]">Pending</div>
          </button>
          <button
            onClick={() => setFilter("approved")}
            className={`p-4 rounded-xl border transition-colors ${
              filter === "approved"
                ? "border-green-500 bg-green-500/10"
                : "border-[var(--twilight)] bg-[var(--dusk)] hover:border-green-500"
            }`}
          >
            <div className="font-mono text-2xl font-bold text-green-400">{counts.approved}</div>
            <div className="font-mono text-xs text-[var(--muted)]">Approved</div>
          </button>
          <button
            onClick={() => setFilter("rejected")}
            className={`p-4 rounded-xl border transition-colors ${
              filter === "rejected"
                ? "border-red-500 bg-red-500/10"
                : "border-[var(--twilight)] bg-[var(--dusk)] hover:border-red-500"
            }`}
          >
            <div className="font-mono text-2xl font-bold text-red-400">{counts.rejected}</div>
            <div className="font-mono text-xs text-[var(--muted)]">Rejected</div>
          </button>
          <button
            onClick={() => setFilter("needs_edit")}
            className={`p-4 rounded-xl border transition-colors ${
              filter === "needs_edit"
                ? "border-orange-500 bg-orange-500/10"
                : "border-[var(--twilight)] bg-[var(--dusk)] hover:border-orange-500"
            }`}
          >
            <div className="font-mono text-2xl font-bold text-orange-400">{counts.needs_edit}</div>
            <div className="font-mono text-xs text-[var(--muted)]">Needs Edit</div>
          </button>
        </div>

        {/* Trust Status */}
        {trustScore !== null && (
          <div className={`mb-8 p-4 rounded-xl border ${
            isTrusted
              ? "border-green-500 bg-green-500/10"
              : "border-[var(--twilight)] bg-[var(--dusk)]"
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-mono text-sm text-[var(--cream)]">
                  Approval Rate: {trustScore}%
                </div>
                <div className="font-mono text-xs text-[var(--muted)] mt-1">
                  {isTrusted
                    ? "You're a trusted submitter! Your submissions auto-publish."
                    : `Submit ${Math.max(0, 5 - counts.approved)} more approved events to become trusted.`}
                </div>
              </div>
              {isTrusted && (
                <div className="flex items-center gap-2 text-green-400">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="font-mono text-sm">Trusted</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Submissions List */}
        {loading ? (
          <div className="py-12 text-center">
            <div className="w-8 h-8 border-2 border-[var(--coral)] border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : submissions.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-[var(--muted)] font-mono text-sm mb-4">
              {filter === "all"
                ? "You haven't submitted anything yet."
                : `No ${filter} submissions.`}
            </p>
            <Link
              href="/submit"
              className="inline-flex px-4 py-2 rounded-lg bg-[var(--coral)] text-[var(--void)] font-mono text-sm hover:bg-[var(--rose)] transition-colors"
            >
              Submit Your First Event
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {submissions.map((submission) => {
              const data = submission.data as { title?: string; name?: string };
              const title = data.title || data.name || "Untitled";
              const statusInfo = STATUS_LABELS[submission.status as SubmissionStatus];

              return (
                <div
                  key={submission.id}
                  className="p-4 rounded-xl bg-[var(--dusk)] border border-[var(--twilight)] hover:border-[var(--coral)] transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-xs font-mono bg-${statusInfo.color}-500/20 text-${statusInfo.color}-400`}>
                          {statusInfo.label}
                        </span>
                        <span className="px-2 py-0.5 rounded text-xs font-mono bg-[var(--twilight)] text-[var(--muted)]">
                          {TYPE_LABELS[submission.submission_type as SubmissionType]}
                        </span>
                      </div>
                      <h3 className="text-[var(--cream)] font-medium">{title}</h3>
                      <div className="font-mono text-xs text-[var(--muted)] mt-1">
                        Submitted {new Date(submission.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    {submission.status === "needs_edit" && (
                      <Link
                        href={`/submit/${submission.submission_type === "producer" ? "org" : submission.submission_type}?edit=${submission.id}`}
                        className="px-3 py-1.5 rounded-lg border border-orange-500 text-orange-400 font-mono text-xs hover:bg-orange-500/10 transition-colors"
                      >
                        Edit
                      </Link>
                    )}
                  </div>

                  {/* Rejection reason */}
                  {submission.rejection_reason && (
                    <div className="mt-3 p-3 rounded-lg bg-[var(--void)]/50">
                      <div className="font-mono text-xs text-[var(--muted)] mb-1">Feedback:</div>
                      <div className="font-mono text-sm text-[var(--cream)]">
                        {submission.rejection_reason}
                      </div>
                    </div>
                  )}

                  {/* Approved link */}
                  {submission.status === "approved" && submission.approved_event_id && (
                    <div className="mt-3">
                      <Link
                        href={`/events/${submission.approved_event_id}`}
                        className="inline-flex items-center gap-1 text-[var(--coral)] font-mono text-sm hover:underline"
                      >
                        View published event
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
