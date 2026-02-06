"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import type { ReactNode } from "react";
import Link from "next/link";
import type {
  SubmissionWithProfile,
  SubmissionStatus,
  SubmissionType,
  EventSubmissionData,
  VenueSubmissionData,
  ProducerSubmissionData,
} from "@/lib/types";

const STATUS_OPTIONS: { value: SubmissionStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "needs_edit", label: "Needs Edit" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

const STATUS_FILTERS: Array<SubmissionStatus | "all"> = [
  "all",
  "pending",
  "needs_edit",
  "approved",
  "rejected",
];

const TYPE_OPTIONS: { value: SubmissionType | "all"; label: string }[] = [
  { value: "all", label: "All Types" },
  { value: "event", label: "Events" },
  { value: "venue", label: "Venues" },
  { value: "producer", label: "Organizations" },
];
const TYPE_FILTERS: Array<SubmissionType | "all"> = ["all", "event", "venue", "producer"];

export default function AdminSubmissionsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const statusParam = searchParams.get("status") as SubmissionStatus | "all" | null;
  const typeParam = searchParams.get("type") as SubmissionType | "all" | null;
  const [submissions, setSubmissions] = useState<SubmissionWithProfile[]>([]);
  const [summary, setSummary] = useState({
    total: 0,
    byStatus: { pending: 0, approved: 0, rejected: 0, needs_edit: 0 },
    byType: { event: 0, venue: 0, producer: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<SubmissionStatus | "all">(() => {
    if (statusParam && STATUS_FILTERS.includes(statusParam)) return statusParam;
    return "pending";
  });
  const [typeFilter, setTypeFilter] = useState<SubmissionType | "all">(() => {
    if (typeParam && TYPE_FILTERS.includes(typeParam)) return typeParam;
    return "all";
  });
  const [selectedSubmission, setSelectedSubmission] = useState<SubmissionWithProfile | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [trustLoading, setTrustLoading] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (typeFilter !== "all") params.set("type", typeFilter);

      const res = await fetch(`/api/admin/submissions?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setSubmissions(data.submissions || []);
      setSummary(s => data.summary || s);
    } catch (err) {
      console.error("Failed to fetch submissions:", err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  useEffect(() => {
    const nextStatus = statusParam && STATUS_FILTERS.includes(statusParam) ? statusParam : "pending";
    const nextType = typeParam && TYPE_FILTERS.includes(typeParam) ? typeParam : "all";

    setStatusFilter(nextStatus);
    setTypeFilter(nextType);

    const params = new URLSearchParams(searchParams.toString());
    let dirty = false;

    if (statusParam !== nextStatus) {
      params.set("status", nextStatus);
      dirty = true;
    }
    if (typeParam !== nextType) {
      params.set("type", nextType);
      dirty = true;
    }

    if (dirty) {
      const query = params.toString();
      router.replace(`/admin/submissions${query ? `?${query}` : ""}`);
    }
  }, [statusParam, typeParam, router, searchParams]);

  const handleStatusChange = (next: SubmissionStatus | "all") => {
    setStatusFilter(next);
    const params = new URLSearchParams(searchParams.toString());
    params.set("status", next);
    params.set("type", typeFilter);
    const query = params.toString();
    router.replace(`/admin/submissions${query ? `?${query}` : ""}`);
  };

  const handleTypeChange = (next: SubmissionType | "all") => {
    setTypeFilter(next);
    const params = new URLSearchParams(searchParams.toString());
    params.set("status", statusFilter);
    params.set("type", next);
    const query = params.toString();
    router.replace(`/admin/submissions${query ? `?${query}` : ""}`);
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

  const handlePromoteTrusted = async (userId: string) => {
    setTrustLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/trust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trust_tier: "trusted_submitter",
        }),
      });
      if (!res.ok) throw new Error("Failed to promote");
      fetchSubmissions();
    } catch (err) {
      console.error("Failed to promote submitter:", err);
    } finally {
      setTrustLoading(false);
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
                onClick={() => handleStatusChange(opt.value)}
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
                onClick={() => handleTypeChange(opt.value)}
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
              const approvedId = submission.submission_type === "event"
                ? submission.approved_event_id
                : submission.submission_type === "venue"
                  ? submission.approved_venue_id
                  : submission.approved_organization_id;
              const duplicateLabel = submission.potential_duplicate_id
                ? `${submission.potential_duplicate_type || "item"} #${submission.potential_duplicate_id}`
                : null;
              const submitter = submission.submitter as {
                id: string;
                username: string;
                approved_count: number;
                rejected_count: number;
                trust_tier?: string | null;
              } | null;
              const trustTier = (submission as { submitter_trust_tier?: string }).submitter_trust_tier || submitter?.trust_tier || "standard";
              const isTrusted = trustTier === "trusted_submitter";
              const isEligible = (submission as { submitter_is_trust_eligible?: boolean }).submitter_is_trust_eligible === true;

              return (
                <div
                  key={submission.id}
                  className={`p-4 rounded-xl border transition-colors cursor-pointer ${
                    selectedSubmission?.id === submission.id
                      ? "border-[var(--coral)] bg-[var(--coral)]/5"
                      : "border-[var(--twilight)] bg-[var(--dusk)] hover:border-[var(--coral)]"
                  }`}
                  onClick={() => {
                    const isSame = selectedSubmission?.id === submission.id;
                    setSelectedSubmission(isSame ? null : submission);
                    if (!isSame) setRejectionReason("");
                  }}
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
                        {isTrusted && (
                          <span className="px-2 py-0.5 rounded text-xs font-mono bg-green-500/20 text-green-400">
                            trusted
                          </span>
                        )}
                        {!isTrusted && isEligible && (
                          <span className="px-2 py-0.5 rounded text-xs font-mono bg-yellow-500/20 text-yellow-400">
                            eligible
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
                    <div
                      className="mt-4 pt-4 border-t border-[var(--twilight)] space-y-4"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                        <div className="p-4 rounded-lg bg-[var(--void)]/50">
                          <div className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-3">
                            Submission details
                          </div>
                          {submission.submission_type === "event" ? (
                            <EventPreview data={data as unknown as EventSubmissionData} />
                          ) : submission.submission_type === "venue" ? (
                            <VenuePreview data={data as unknown as VenueSubmissionData} />
                          ) : (
                            <OrgPreview data={data as unknown as ProducerSubmissionData} />
                          )}
                        </div>
                        <div className="space-y-4">
                          <div className="p-4 rounded-lg bg-[var(--void)]/50">
                            <div className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-3">
                              Review metadata
                            </div>
                            <div className="space-y-2">
                              <MetaRow label="Submitted" value={formatDateTime(submission.created_at)} />
                              <MetaRow label="Reviewed" value={formatDateTime(submission.reviewed_at)} />
                              <MetaRow label="Portal" value={submission.portal?.name || "—"} />
                              <MetaRow label="Reviewer" value={submission.reviewer?.username || "—"} />
                              <MetaRow label="Approved ID" value={approvedId ? String(approvedId) : "—"} />
                              <MetaRow label="Potential duplicate" value={duplicateLabel || "—"} />
                              {submission.potential_duplicate_id && (
                                <MetaRow
                                  label="Duplicate acknowledged"
                                  value={submission.duplicate_acknowledged ? "Yes" : "No"}
                                />
                              )}
                            </div>
                          </div>
                          {submission.rejection_reason && (
                            <div className="p-4 rounded-lg bg-[var(--void)]/50">
                              <div className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
                                Feedback to submitter
                              </div>
                              <p className="text-[var(--cream)] text-sm">
                                {submission.rejection_reason}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Images */}
                      {submission.image_urls && submission.image_urls.length > 0 && (
                        <div className="mb-4 flex gap-2">
                          {submission.image_urls.map((url, i) => (
                            <Image
                              key={i}
                              src={url}
                              alt=""
                              width={96}
                              height={96}
                              className="w-24 h-24 rounded-lg object-cover"
                            />
                          ))}
                        </div>
                      )}

                      <details className="p-4 rounded-lg bg-[var(--void)]/50">
                        <summary className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider cursor-pointer">
                          Raw submission data
                        </summary>
                        <pre className="mt-3 text-[var(--muted)] font-mono text-xs overflow-x-auto">
                          {JSON.stringify(data, null, 2)}
                        </pre>
                      </details>

                      {/* Actions */}
                      {["pending", "needs_edit"].includes(submission.status) && (
                        <div className="space-y-3">
                          {submitter?.id && !isTrusted && isEligible && (
                            <div className="flex justify-end">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePromoteTrusted(submitter.id);
                                }}
                                disabled={trustLoading}
                                className="px-3 py-2 rounded-lg border border-green-500 text-green-400 font-mono text-xs hover:bg-green-500/10 transition-colors disabled:opacity-50"
                              >
                                Promote to Trusted
                              </button>
                            </div>
                          )}
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

const formatDateTime = (value?: string | null) => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
};

function MetaRow({ label, value }: { label: string; value: ReactNode }) {
  const display = value === null || value === undefined || value === "" ? "—" : value;
  return (
    <div className="flex items-start justify-between gap-3 text-xs">
      <span className="font-mono text-[var(--muted)] uppercase tracking-wider">{label}</span>
      <span className="text-[var(--cream)] text-right">{display}</span>
    </div>
  );
}

function PreviewRow({ label, value }: { label: string; value?: ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex flex-wrap gap-2 text-sm">
      <span className="font-mono text-[10px] text-[var(--muted)] uppercase tracking-wider">{label}</span>
      <span className="text-[var(--cream)]">{value}</span>
    </div>
  );
}

function EventPreview({ data }: { data: EventSubmissionData }) {
  const startLabel = data.start_date
    ? `${data.start_date}${data.is_all_day ? " (All day)" : data.start_time ? ` at ${data.start_time}` : ""}`
    : undefined;
  const endLabel = data.end_date
    ? `${data.end_date}${data.is_all_day ? "" : data.end_time ? ` at ${data.end_time}` : ""}`
    : undefined;
  const venueLabel = data.venue?.name || (data.venue_id ? `Venue #${data.venue_id}` : undefined);
  const orgLabel = data.organization?.name || (data.organization_id ? `Organization #${data.organization_id}` : undefined);
  const tagsLabel = data.tags?.length ? data.tags.join(", ") : undefined;
  const seriesLabel = data.series_title || data.recurrence_pattern || (data.recurrence_notes ? "Recurring event" : undefined);
  const hasMin = typeof data.price_min === "number";
  const hasMax = typeof data.price_max === "number";
  let priceLabel: string | undefined;
  if (data.is_free) {
    priceLabel = "Free";
  } else if (hasMin || hasMax) {
    if (hasMin && hasMax) {
      priceLabel = `$${data.price_min}–$${data.price_max}`;
    } else if (hasMin) {
      priceLabel = `$${data.price_min}+`;
    } else if (hasMax) {
      priceLabel = `Up to $${data.price_max}`;
    }
  } else if (data.price_note) {
    priceLabel = data.price_note;
  }

  return (
    <div className="space-y-2 text-sm text-[var(--soft)]">
      <PreviewRow label="Title" value={data.title} />
      <PreviewRow label="Date" value={startLabel} />
      <PreviewRow label="Ends" value={endLabel} />
      <PreviewRow label="Venue" value={venueLabel} />
      <PreviewRow label="Organization" value={orgLabel} />
      <PreviewRow label="Series" value={seriesLabel} />
      <PreviewRow label="Recurs until" value={data.recurrence_ends_on} />
      <PreviewRow label="Category" value={data.category} />
      <PreviewRow label="Tags" value={tagsLabel} />
      <PreviewRow label="Price" value={priceLabel} />
      <PreviewRow
        label="Ticket"
        value={
          data.ticket_url ? (
            <a
              href={data.ticket_url}
              target="_blank"
              rel="noreferrer"
              className="text-[var(--coral)] hover:underline break-all"
              onClick={(e) => e.stopPropagation()}
            >
              {data.ticket_url}
            </a>
          ) : undefined
        }
      />
      <PreviewRow
        label="Source"
        value={
          data.source_url ? (
            <a
              href={data.source_url}
              target="_blank"
              rel="noreferrer"
              className="text-[var(--coral)] hover:underline break-all"
              onClick={(e) => e.stopPropagation()}
            >
              {data.source_url}
            </a>
          ) : undefined
        }
      />
      {data.description && (
        <div className="pt-2">
          <span className="font-mono text-[10px] text-[var(--muted)] uppercase tracking-wider">
            Description
          </span>
          <p className="text-[var(--soft)] mt-1 whitespace-pre-wrap">{data.description}</p>
        </div>
      )}
    </div>
  );
}

function VenuePreview({ data }: { data: VenueSubmissionData }) {
  return (
    <div className="space-y-2 text-sm text-[var(--soft)]">
      <PreviewRow label="Name" value={data.name} />
      <PreviewRow label="Address" value={data.address} />
      <PreviewRow label="Neighborhood" value={data.neighborhood} />
      <PreviewRow label="Website" value={data.website} />
      <PreviewRow label="Type" value={data.venue_type} />
      <PreviewRow label="Google Place ID" value={data.google_place_id} />
      <PreviewRow label="Foursquare ID" value={data.foursquare_id} />
    </div>
  );
}

function OrgPreview({ data }: { data: ProducerSubmissionData }) {
  const categoriesLabel = data.categories?.length ? data.categories.join(", ") : undefined;
  return (
    <div className="space-y-2 text-sm text-[var(--soft)]">
      <PreviewRow label="Name" value={data.name} />
      <PreviewRow label="Type" value={data.org_type} />
      <PreviewRow label="Categories" value={categoriesLabel} />
      <PreviewRow label="Website" value={data.website} />
      <PreviewRow label="Email" value={data.email} />
      <PreviewRow label="Instagram" value={data.instagram} />
      <PreviewRow label="Facebook" value={data.facebook} />
      <PreviewRow label="Neighborhood" value={data.neighborhood} />
      {data.description && (
        <div className="pt-2">
          <span className="font-mono text-[10px] text-[var(--muted)] uppercase tracking-wider">
            Description
          </span>
          <p className="text-[var(--soft)] mt-1 whitespace-pre-wrap">{data.description}</p>
        </div>
      )}
    </div>
  );
}
