"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

type ClaimStatus = "pending" | "needs_info" | "approved" | "rejected";
type ClaimType = "venue" | "organization";

type ClaimRequest = {
  id: string;
  status: ClaimStatus;
  venue_id: number | null;
  organization_id: string | null;
  verification_method: string | null;
  verification_domain: string | null;
  verification_token: string | null;
  notes: string | null;
  rejection_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
  requested_by?: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  venue?: { id: number; name: string; slug: string } | null;
  organization?: { id: string; name: string; slug: string } | null;
};

const STATUS_OPTIONS: { value: ClaimStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "needs_info", label: "Needs Info" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

const TYPE_OPTIONS: { value: ClaimType | "all"; label: string }[] = [
  { value: "all", label: "All Types" },
  { value: "venue", label: "Venues" },
  { value: "organization", label: "Organizations" },
];

export default function AdminClaimsPage() {
  const [claims, setClaims] = useState<ClaimRequest[]>([]);
  const [summary, setSummary] = useState({
    total: 0,
    byStatus: { pending: 0, approved: 0, rejected: 0, needs_info: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<ClaimStatus | "all">("pending");
  const [typeFilter, setTypeFilter] = useState<ClaimType | "all">("all");
  const [selectedClaim, setSelectedClaim] = useState<ClaimRequest | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState("");

  const fetchClaims = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (typeFilter !== "all") params.set("type", typeFilter);

      const res = await fetch(`/api/admin/claims?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setClaims(data.claims || []);
      setSummary((s) => data.summary || s);
    } catch (err) {
      console.error("Failed to fetch claims:", err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter]);

  useEffect(() => {
    fetchClaims();
  }, [fetchClaims]);

  const handleApprove = async (id: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/claims/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Failed to approve");
      setSelectedClaim(null);
      fetchClaims();
    } catch (err) {
      console.error("Failed to approve:", err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequestInfo = async (id: string) => {
    if (!feedback.trim() || feedback.length < 10) {
      alert("Please provide a message (at least 10 characters)");
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/claims/${id}/request-info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: feedback }),
      });
      if (!res.ok) throw new Error("Failed to request info");
      setSelectedClaim(null);
      setFeedback("");
      fetchClaims();
    } catch (err) {
      console.error("Failed to request info:", err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (id: string) => {
    if (!feedback.trim() || feedback.length < 10) {
      alert("Please provide a rejection reason (at least 10 characters)");
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/claims/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rejection_reason: feedback }),
      });
      if (!res.ok) throw new Error("Failed to reject");
      setSelectedClaim(null);
      setFeedback("");
      fetchClaims();
    } catch (err) {
      console.error("Failed to reject:", err);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div>
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--cream)]">
              Claim Requests
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

        {/* Claims List */}
        {loading ? (
          <div className="py-12 text-center">
            <div className="w-8 h-8 border-2 border-[var(--coral)] border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : claims.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-[var(--muted)] font-mono text-sm">No claim requests found.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {claims.map((claim) => {
              const entityName = claim.venue?.name || claim.organization?.name || "Unknown";
              const entitySlug = claim.venue?.slug || claim.organization?.slug;
              const isVenue = Boolean(claim.venue_id);
              const typeLabel = isVenue ? "venue" : "organization";

              return (
                <div
                  key={claim.id}
                  className={`p-4 rounded-xl border transition-colors cursor-pointer ${
                    selectedClaim?.id === claim.id
                      ? "border-[var(--coral)] bg-[var(--coral)]/5"
                      : "border-[var(--twilight)] bg-[var(--dusk)] hover:border-[var(--coral)]"
                  }`}
                  onClick={() => {
                    const next = selectedClaim?.id === claim.id ? null : claim;
                    setSelectedClaim(next);
                    if (next?.id !== selectedClaim?.id) setFeedback("");
                  }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-xs font-mono ${
                          claim.status === "pending" ? "bg-yellow-500/20 text-yellow-400" :
                          claim.status === "approved" ? "bg-green-500/20 text-green-400" :
                          claim.status === "rejected" ? "bg-red-500/20 text-red-400" :
                          "bg-orange-500/20 text-orange-400"
                        }`}>
                          {claim.status}
                        </span>
                        <span className="px-2 py-0.5 rounded text-xs font-mono bg-[var(--twilight)] text-[var(--muted)]">
                          {typeLabel}
                        </span>
                      </div>
                      <h3 className="text-[var(--cream)] font-medium">{entityName}</h3>
                      <div className="flex items-center gap-3 font-mono text-xs text-[var(--muted)] mt-1">
                        <span>by @{claim.requested_by?.username || "unknown"}</span>
                        <span>{new Date(claim.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    {entitySlug && (
                      <Link
                        href={isVenue ? `/spots/${entitySlug}` : `/community/${entitySlug}`}
                        className="text-[var(--muted)] hover:text-[var(--cream)] font-mono text-xs"
                        onClick={(e) => e.stopPropagation()}
                      >
                        View
                      </Link>
                    )}
                  </div>

                  {selectedClaim?.id === claim.id && (
                    <div className="mt-4 pt-4 border-t border-[var(--twilight)] space-y-3">
                      <div className="font-mono text-xs text-[var(--muted)]">
                        Verification: {claim.verification_method || "Not provided"}
                      </div>
                      {claim.verification_domain && (
                        <div className="font-mono text-xs text-[var(--muted)]">
                          Domain: {claim.verification_domain}
                        </div>
                      )}
                      {claim.verification_token && (
                        <div className="font-mono text-xs text-[var(--muted)]">
                          Token/Proof: {claim.verification_token}
                        </div>
                      )}
                      {claim.notes && (
                        <div className="font-mono text-xs text-[var(--muted)]">
                          Notes: {claim.notes}
                        </div>
                      )}
                      {claim.rejection_reason && (
                        <div className="font-mono text-xs text-[var(--muted)]">
                          Feedback: {claim.rejection_reason}
                        </div>
                      )}

                      {["pending", "needs_info"].includes(claim.status) && (
                        <div className="space-y-3">
                          <textarea
                            value={feedback}
                            onChange={(e) => setFeedback(e.target.value)}
                            placeholder="Message for requester (required for reject/request info)..."
                            rows={2}
                            className="w-full px-3 py-2 rounded-lg bg-[var(--void)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)]"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleApprove(claim.id);
                              }}
                              disabled={actionLoading}
                              className="px-4 py-2 rounded-lg bg-green-500 text-white font-mono text-sm hover:bg-green-600 transition-colors disabled:opacity-50"
                            >
                              Approve
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRequestInfo(claim.id);
                              }}
                              disabled={actionLoading}
                              className="px-4 py-2 rounded-lg bg-orange-500 text-white font-mono text-sm hover:bg-orange-600 transition-colors disabled:opacity-50"
                            >
                              Request Info
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReject(claim.id);
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
