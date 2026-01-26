"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { SubmissionWithProfile, SubmissionStatus, SubmissionType } from "@/lib/types";

const STATUS_OPTIONS: { value: SubmissionStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "needs_edit", label: "Needs Edit" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

const TYPE_OPTIONS: { value: SubmissionType | "all"; label: string }[] = [
  { value: "all", label: "All Types" },
  { value: "event", label: "Events" },
  { value: "venue", label: "Venues" },
  { value: "producer", label: "Organizations" },
];

export default function AdminSubmissionsPage() {
  const [submissions, setSubmissions] = useState<SubmissionWithProfile[]>([]);
  const [summary, setSummary] = useState({
    total: 0,
    byStatus: { pending: 0, approved: 0, rejected: 0, needs_edit: 0 },
    byType: { event: 0, venue: 0, producer: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<SubmissionStatus | "all">("pending");
  const [typeFilter, setTypeFilter] = useState<SubmissionType | "all">("all");
  const [selectedSubmission, setSelectedSubmission] = useState<SubmissionWithProfile | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  useEffect(() => {
    fetchSubmissions();
  }, [statusFilter, typeFilter]);

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (typeFilter !== "all") params.set("type", typeFilter);

      const res = await fetch(`/api/admin/submissions?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setSubmissions(data.submissions || []);
      setSummary(data.summary || summary);
    } catch (err) {
      console.error("Failed to fetch submissions:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/submissions/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Failed to approve");
      setSelectedSubmission(null);
      fetchSubmissions();
    } catch (err) {
      console.error("Failed to approve:", err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (id: string) => {
    if (!rejectionReason.trim() || rejectionReason.length < 10) {
      alert("Please provide a rejection reason (at least 10 characters)");
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/submissions/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rejection_reason: rejectionReason }),
      });
      if (!res.ok) throw new Error("Failed to reject");
      setSelectedSubmission(null);
      setRejectionReason("");
      fetchSubmissions();
    } catch (err) {
      console.error("Failed to reject:", err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequestEdit = async (id: string) => {
    if (!rejectionReason.trim() || rejectionReason.length < 10) {
      alert("Please describe what changes are needed (at least 10 characters)");
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/submissions/${id}/request-edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rejection_reason: rejectionReason }),
      });
      if (!res.ok) throw new Error("Failed to request edit");
      setSelectedSubmission(null);
      setRejectionReason("");
      fetchSubmissions();
    } catch (err) {
      console.error("Failed to request edit:", err);
    } finally {
      setActionLoading(false);
    }
  };

  // Note: Admin auth is handled by the admin layout (server-side)
  // No client-side check needed here

  return (
    <div>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--cream)]">
              Submission Review
            </h1>
            <p className="text-[var(--muted)] font-mono text-sm mt-1">
              {summary.byStatus.pending} pending • {summary.total} total
            </p>
          </div>
          <Link
            href="/admin"
            className="text-[var(--muted)] hover:text-[var(--cream)] font-mono text-sm"
          >
            ← Back to Admin
          </Link>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex gap-2">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setStatusFilter(opt.value)}
                className={`px-3 py-1.5 rounded-lg font-mono text-xs transition-colors ${
                  statusFilter === opt.value
                    ? "bg-[var(--coral)] text-[var(--void)]"
                    : "bg-[var(--dusk)] text-[var(--muted)] hover:text-[var(--cream)]"
                }`}
              >
                {opt.label}
                {opt.value === "pending" && summary.byStatus.pending > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 rounded bg-[var(--void)]/30 text-[10px]">
                    {summary.byStatus.pending}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTypeFilter(opt.value)}
                className={`px-3 py-1.5 rounded-lg font-mono text-xs transition-colors ${
                  typeFilter === opt.value
                    ? "bg-[var(--twilight)] text-[var(--cream)]"
                    : "bg-[var(--dusk)] text-[var(--muted)] hover:text-[var(--cream)]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Submissions List */}
        {loading ? (
          <div className="py-12 text-center">
            <div className="w-8 h-8 border-2 border-[var(--coral)] border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : submissions.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-[var(--muted)] font-mono text-sm">No submissions found.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {submissions.map((submission) => {
              const data = submission.data as Record<string, unknown>;
              const title = (data.title as string) || (data.name as string) || "Untitled";
              const submitter = submission.submitter as {
                username: string;
                approved_count: number;
                rejected_count: number;
              } | null;

              return (
                <div
                  key={submission.id}
                  className={`p-4 rounded-xl border transition-colors cursor-pointer ${
                    selectedSubmission?.id === submission.id
                      ? "border-[var(--coral)] bg-[var(--coral)]/5"
                      : "border-[var(--twilight)] bg-[var(--dusk)] hover:border-[var(--coral)]"
                  }`}
                  onClick={() => setSelectedSubmission(
                    selectedSubmission?.id === submission.id ? null : submission
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-xs font-mono ${
                          submission.status === "pending" ? "bg-yellow-500/20 text-yellow-400" :
                          submission.status === "approved" ? "bg-green-500/20 text-green-400" :
                          submission.status === "rejected" ? "bg-red-500/20 text-red-400" :
                          "bg-orange-500/20 text-orange-400"
                        }`}>
                          {submission.status}
                        </span>
                        <span className="px-2 py-0.5 rounded text-xs font-mono bg-[var(--twilight)] text-[var(--muted)]">
                          {submission.submission_type}
                        </span>
                        {(submission as { submitter_is_trusted?: boolean }).submitter_is_trusted && (
                          <span className="px-2 py-0.5 rounded text-xs font-mono bg-green-500/20 text-green-400">
                            trusted
                          </span>
                        )}
                      </div>
                      <h3 className="text-[var(--cream)] font-medium">{title}</h3>
                      <div className="flex items-center gap-3 font-mono text-xs text-[var(--muted)] mt-1">
                        <span>by @{submitter?.username || "unknown"}</span>
                        {submitter && (
                          <span>
                            ({submitter.approved_count}/{submitter.approved_count + submitter.rejected_count} approved)
                          </span>
                        )}
                        <span>{new Date(submission.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Expanded View */}
                  {selectedSubmission?.id === submission.id && (
                    <div className="mt-4 pt-4 border-t border-[var(--twilight)]">
                      {/* Data Preview */}
                      <div className="mb-4 p-3 rounded-lg bg-[var(--void)]/50 font-mono text-xs overflow-x-auto">
                        <pre className="text-[var(--muted)]">
                          {JSON.stringify(data, null, 2)}
                        </pre>
                      </div>

                      {/* Images */}
                      {submission.image_urls && submission.image_urls.length > 0 && (
                        <div className="mb-4 flex gap-2">
                          {submission.image_urls.map((url, i) => (
                            <img
                              key={i}
                              src={url}
                              alt=""
                              className="w-24 h-24 rounded-lg object-cover"
                            />
                          ))}
                        </div>
                      )}

                      {/* Actions */}
                      {["pending", "needs_edit"].includes(submission.status) && (
                        <div className="space-y-3">
                          <textarea
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            placeholder="Feedback for submitter (required for reject/request edit)..."
                            rows={2}
                            className="w-full px-3 py-2 rounded-lg bg-[var(--void)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)]"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleApprove(submission.id);
                              }}
                              disabled={actionLoading}
                              className="px-4 py-2 rounded-lg bg-green-500 text-white font-mono text-sm hover:bg-green-600 transition-colors disabled:opacity-50"
                            >
                              Approve
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRequestEdit(submission.id);
                              }}
                              disabled={actionLoading}
                              className="px-4 py-2 rounded-lg bg-orange-500 text-white font-mono text-sm hover:bg-orange-600 transition-colors disabled:opacity-50"
                            >
                              Request Edit
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReject(submission.id);
                              }}
                              disabled={actionLoading}
                              className="px-4 py-2 rounded-lg bg-red-500 text-white font-mono text-sm hover:bg-red-600 transition-colors disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      )}
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
