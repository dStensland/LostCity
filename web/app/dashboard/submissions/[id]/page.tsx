"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import UnifiedHeader from "@/components/UnifiedHeader";
import { useAuth } from "@/lib/auth-context";
import type {
  SubmissionStatus,
  SubmissionType,
  EventSubmissionData,
  VenueSubmissionData,
  ProducerSubmissionData,
} from "@/lib/types";

const STATUS_LABELS: Record<SubmissionStatus, { label: string; color: string }> = {
  pending: { label: "Pending Review", color: "yellow" },
  approved: { label: "Approved", color: "green" },
  rejected: { label: "Not Approved", color: "red" },
  needs_edit: { label: "Needs Changes", color: "orange" },
};

const TYPE_LABELS: Record<SubmissionType, string> = {
  event: "Event",
  venue: "Venue",
  organization: "Organization",
  producer: "Organization",
};

type SubmissionDetailResponse = {
  submission: {
    id: string;
    submission_type: SubmissionType;
    status: SubmissionStatus;
    rejection_reason: string | null;
    admin_notes?: string | null;
    reviewed_at: string | null;
    created_at: string;
    approved_event_id: number | null;
    approved_venue_id: number | null;
    approved_organization_id: string | null;
    image_urls: string[] | null;
    data: EventSubmissionData | VenueSubmissionData | ProducerSubmissionData;
  };
  duplicateDetails: Record<string, unknown> | null;
  approvedEntity: { type: string; data: { id?: string | number; slug?: string; title?: string; name?: string } | null } | null;
};

export default function SubmissionDetailPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const submissionId = params?.id as string | undefined;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<SubmissionDetailResponse | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!user || !submissionId) return;
    let isActive = true;
    setLoading(true);

    fetch(`/api/submissions/${submissionId}`)
      .then((res) => res.json())
      .then((data) => {
        if (!isActive) return;
        if (data?.error) {
          setError(data.error);
          return;
        }
        setDetail(data as SubmissionDetailResponse);
      })
      .catch(() => {
        if (!isActive) return;
        setError("Failed to load submission.");
      })
      .finally(() => {
        if (isActive) setLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [user, submissionId]);

  const submission = detail?.submission;
  const statusInfo = submission ? STATUS_LABELS[submission.status] : null;

  const editHref = useMemo(() => {
    if (!submission) return "/submit";
    const type = submission.submission_type === "producer" || submission.submission_type === "organization"
      ? "org"
      : submission.submission_type;
    return `/submit/${type}?edit=${submission.id}`;
  }, [submission]);

  const handleDelete = async () => {
    if (!submissionId) return;
    if (!confirm("Cancel this submission? This can only be done while pending.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/submissions/${submissionId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete submission");
      }
      router.push("/dashboard/submissions?deleted=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete submission");
    } finally {
      setDeleting(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen">
        <UnifiedHeader />
        <main className="max-w-4xl mx-auto px-4 py-12 text-center">
          <p className="text-[var(--muted)]">Please sign in to view this submission.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <UnifiedHeader />

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-6">
          <Link
            href="/dashboard/submissions"
            className="text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-[var(--cream)]">Submission Details</h1>
            <p className="text-[var(--muted)] font-mono text-xs mt-1">
              View status, feedback, and update your submission.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-[var(--coral)]/10 border border-[var(--coral)] text-[var(--coral)] font-mono text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center">
            <div className="w-8 h-8 border-2 border-[var(--coral)] border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : !submission ? (
          <div className="py-12 text-center">
            <p className="text-[var(--muted)] font-mono text-sm">Submission not found.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="p-6 rounded-xl bg-[var(--dusk)] border border-[var(--twilight)]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    {statusInfo && (
                      <span className={`px-2 py-0.5 rounded text-xs font-mono bg-${statusInfo.color}-500/20 text-${statusInfo.color}-400`}>
                        {statusInfo.label}
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded text-xs font-mono bg-[var(--twilight)] text-[var(--muted)]">
                      {TYPE_LABELS[submission.submission_type]}
                    </span>
                  </div>
                  <div className="font-mono text-xs text-[var(--muted)]">
                    Submitted {new Date(submission.created_at).toLocaleString()}
                  </div>
                  {submission.reviewed_at && (
                    <div className="font-mono text-xs text-[var(--muted)] mt-1">
                      Reviewed {new Date(submission.reviewed_at).toLocaleString()}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {["pending", "needs_edit"].includes(submission.status) && (
                    <Link
                      href={editHref}
                      className="px-3 py-1.5 rounded-lg border border-orange-500 text-orange-400 font-mono text-xs hover:bg-orange-500/10 transition-colors"
                    >
                      Edit submission
                    </Link>
                  )}
                  {submission.status === "pending" && (
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={deleting}
                      className="px-3 py-1.5 rounded-lg border border-red-500 text-red-400 font-mono text-xs hover:bg-red-500/10 transition-colors disabled:opacity-50"
                    >
                      {deleting ? "Canceling..." : "Cancel submission"}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {(submission.rejection_reason || submission.admin_notes) && (
              <div className="p-4 rounded-xl bg-[var(--void)]/60 border border-[var(--twilight)]">
                <div className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
                  Feedback
                </div>
                {submission.rejection_reason && (
                  <p className="text-[var(--cream)] text-sm">{submission.rejection_reason}</p>
                )}
                {submission.admin_notes && (
                  <p className="text-[var(--muted)] text-sm mt-2">{submission.admin_notes}</p>
                )}
              </div>
            )}

            {detail?.approvedEntity?.data && (
              <div className="p-4 rounded-xl bg-[var(--void)]/60 border border-[var(--twilight)]">
                <div className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
                  Published
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[var(--cream)] text-sm">
                    {detail.approvedEntity.data.title || detail.approvedEntity.data.name || "Approved"}
                  </span>
                  {detail.approvedEntity.type === "event" && detail.approvedEntity.data.id && (
                    <Link
                      href={`/events/${detail.approvedEntity.data.id}`}
                      className="text-[var(--coral)] font-mono text-xs hover:underline"
                    >
                      View event
                    </Link>
                  )}
                  {detail.approvedEntity.type === "venue" && detail.approvedEntity.data.slug && (
                    <Link
                      href={`/atlanta/spots/${detail.approvedEntity.data.slug}`}
                      className="text-[var(--coral)] font-mono text-xs hover:underline"
                    >
                      View venue
                    </Link>
                  )}
                  {detail.approvedEntity.type === "organization" && detail.approvedEntity.data.slug && (
                    <Link
                      href={`/atlanta/community/${detail.approvedEntity.data.slug}`}
                      className="text-[var(--coral)] font-mono text-xs hover:underline"
                    >
                      View organization
                    </Link>
                  )}
                </div>
              </div>
            )}

            {detail?.duplicateDetails && (
              <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/40">
                <div className="font-mono text-xs text-orange-200 uppercase tracking-wider mb-2">
                  Potential duplicate
                </div>
                <pre className="text-xs text-orange-100 whitespace-pre-wrap">
                  {JSON.stringify(detail.duplicateDetails, null, 2)}
                </pre>
              </div>
            )}

            <div className="p-6 rounded-xl bg-[var(--dusk)] border border-[var(--twilight)]">
              <div className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-4">
                Submission Details
              </div>
              {submission.submission_type === "event" ? (
                <EventDetailView data={submission.data as EventSubmissionData} />
              ) : submission.submission_type === "venue" ? (
                <VenueDetailView data={submission.data as VenueSubmissionData} />
              ) : (
                <OrgDetailView data={submission.data as ProducerSubmissionData} />
              )}
            </div>

            {submission.image_urls && submission.image_urls.length > 0 && (
              <div className="p-4 rounded-xl bg-[var(--void)]/60 border border-[var(--twilight)]">
                <div className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
                  Images
                </div>
                <div className="flex flex-wrap gap-3">
                  {submission.image_urls.map((url) => (
                    <Image
                      key={url}
                      src={url}
                      alt=""
                      width={112}
                      height={112}
                      className="w-28 h-28 rounded-lg object-cover"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function EventDetailView({ data }: { data: EventSubmissionData }) {
  return (
    <div className="space-y-3 text-sm text-[var(--soft)]">
      <div className="flex flex-wrap gap-2">
        <span className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">Title</span>
        <span className="text-[var(--cream)]">{data.title}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <span className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">Date</span>
        <span className="text-[var(--cream)]">
          {data.start_date} {data.is_all_day ? "(All day)" : data.start_time ? `at ${data.start_time}` : ""}
        </span>
      </div>
      {data.end_date && (
        <div className="flex flex-wrap gap-2">
          <span className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">Ends</span>
          <span className="text-[var(--cream)]">
            {data.end_date} {data.is_all_day ? "" : data.end_time ? `at ${data.end_time}` : ""}
          </span>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <span className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">Venue</span>
        <span className="text-[var(--cream)]">
          {data.venue?.name || (data.venue_id ? `Venue #${data.venue_id}` : "Not provided")}
        </span>
      </div>
      {data.organization_id && (
        <div className="flex flex-wrap gap-2">
          <span className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">Organization</span>
          <span className="text-[var(--cream)]">Organization #{data.organization_id}</span>
        </div>
      )}
      {(data.series_title || data.recurrence_pattern) && (
        <div className="flex flex-wrap gap-2">
          <span className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">Series</span>
          <span className="text-[var(--cream)]">{data.series_title || "Recurring event"}</span>
        </div>
      )}
      {data.category && (
        <div className="flex flex-wrap gap-2">
          <span className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">Category</span>
          <span className="text-[var(--cream)]">{data.category}</span>
        </div>
      )}
      {data.tags && data.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">Tags</span>
          <span className="text-[var(--cream)]">{data.tags.join(", ")}</span>
        </div>
      )}
      {(data.ticket_url || data.source_url) && (
        <div className="flex flex-wrap gap-2">
          <span className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">Links</span>
          <span className="text-[var(--cream)]">{data.ticket_url || data.source_url}</span>
        </div>
      )}
      {data.description && (
        <div className="pt-2">
          <span className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">Description</span>
          <p className="text-[var(--soft)] mt-1 whitespace-pre-wrap">{data.description}</p>
        </div>
      )}
    </div>
  );
}

function VenueDetailView({ data }: { data: VenueSubmissionData }) {
  return (
    <div className="space-y-3 text-sm text-[var(--soft)]">
      <div className="flex flex-wrap gap-2">
        <span className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">Name</span>
        <span className="text-[var(--cream)]">{data.name}</span>
      </div>
      {data.address && (
        <div className="flex flex-wrap gap-2">
          <span className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">Address</span>
          <span className="text-[var(--cream)]">{data.address}</span>
        </div>
      )}
      {data.neighborhood && (
        <div className="flex flex-wrap gap-2">
          <span className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">Neighborhood</span>
          <span className="text-[var(--cream)]">{data.neighborhood}</span>
        </div>
      )}
      {data.website && (
        <div className="flex flex-wrap gap-2">
          <span className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">Website</span>
          <span className="text-[var(--cream)]">{data.website}</span>
        </div>
      )}
      {data.venue_type && (
        <div className="flex flex-wrap gap-2">
          <span className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">Type</span>
          <span className="text-[var(--cream)]">{data.venue_type}</span>
        </div>
      )}
    </div>
  );
}

function OrgDetailView({ data }: { data: ProducerSubmissionData }) {
  return (
    <div className="space-y-3 text-sm text-[var(--soft)]">
      <div className="flex flex-wrap gap-2">
        <span className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">Name</span>
        <span className="text-[var(--cream)]">{data.name}</span>
      </div>
      {data.org_type && (
        <div className="flex flex-wrap gap-2">
          <span className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">Type</span>
          <span className="text-[var(--cream)]">{data.org_type}</span>
        </div>
      )}
      {data.categories && data.categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">Categories</span>
          <span className="text-[var(--cream)]">{data.categories.join(", ")}</span>
        </div>
      )}
      {data.website && (
        <div className="flex flex-wrap gap-2">
          <span className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">Website</span>
          <span className="text-[var(--cream)]">{data.website}</span>
        </div>
      )}
      {data.email && (
        <div className="flex flex-wrap gap-2">
          <span className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">Email</span>
          <span className="text-[var(--cream)]">{data.email}</span>
        </div>
      )}
      {data.description && (
        <div className="pt-2">
          <span className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">Description</span>
          <p className="text-[var(--soft)] mt-1 whitespace-pre-wrap">{data.description}</p>
        </div>
      )}
    </div>
  );
}
