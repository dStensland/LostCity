"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import UnifiedHeader from "@/components/UnifiedHeader";
import { useAuth } from "@/lib/auth-context";

type ClaimStatus = "pending" | "needs_info" | "approved" | "rejected";

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
  venue?: { id: number; name: string; slug: string } | null;
  organization?: { id: string; name: string; slug: string } | null;
};

const STATUS_LABELS: Record<ClaimStatus, { label: string; color: string }> = {
  pending: { label: "Pending Review", color: "yellow" },
  needs_info: { label: "Needs Info", color: "orange" },
  approved: { label: "Approved", color: "green" },
  rejected: { label: "Not Approved", color: "red" },
};

export default function UserClaimsPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const success = searchParams.get("success");

  const [claims, setClaims] = useState<ClaimRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchClaims = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/claims");
        const data = await res.json();
        setClaims(data.claims || []);
      } catch (err) {
        console.error("Failed to fetch claim requests:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchClaims();
  }, [user]);

  if (!user) {
    return (
      <div className="min-h-screen">
        <UnifiedHeader />
        <main className="max-w-4xl mx-auto px-4 py-12 text-center">
          <p className="text-[var(--muted)]">Please sign in to view your claims.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <UnifiedHeader />

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--cream)]">
              My Claims
            </h1>
            <p className="text-[var(--muted)] font-mono text-sm mt-1">
              Track your venue and organization claim requests
            </p>
          </div>
          <Link
            href="/submit"
            className="px-4 py-2 rounded-lg bg-[var(--coral)] text-[var(--void)] font-mono text-sm font-medium hover:bg-[var(--rose)] transition-colors"
          >
            Submit New
          </Link>
        </div>

        {success && (
          <div className="mb-6 p-4 rounded-lg bg-green-500/10 border border-green-500 text-green-400 font-mono text-sm">
            {success === "updated"
              ? "Your claim request was updated. We&apos;ll review it soon."
              : "Your claim request was received! We&apos;ll review it soon."}
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center">
            <div className="w-8 h-8 border-2 border-[var(--coral)] border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : claims.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-[var(--muted)] font-mono text-sm mb-4">
              You haven&apos;t submitted any claims yet.
            </p>
            <Link
              href="/spots"
              className="inline-flex px-4 py-2 rounded-lg bg-[var(--coral)] text-[var(--void)] font-mono text-sm hover:bg-[var(--rose)] transition-colors"
            >
              Browse Venues
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {claims.map((claim) => {
              const statusInfo = STATUS_LABELS[claim.status];
              const entity = claim.venue || claim.organization;
              const isVenue = Boolean(claim.venue_id);
              const entityLink = entity?.slug
                ? isVenue
                  ? `/spots/${entity.slug}`
                  : `/community/${entity.slug}`
                : null;
              const claimEditLink = `/claim?claim_id=${claim.id}${entityLink ? `&return=${encodeURIComponent(entityLink)}` : ""}`;

              return (
                <div
                  key={claim.id}
                  className="p-4 rounded-xl bg-[var(--dusk)] border border-[var(--twilight)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-xs font-mono bg-${statusInfo.color}-500/20 text-${statusInfo.color}-400`}>
                          {statusInfo.label}
                        </span>
                        <span className="px-2 py-0.5 rounded text-xs font-mono bg-[var(--twilight)] text-[var(--muted)]">
                          {isVenue ? "Venue" : "Organization"}
                        </span>
                      </div>
                      <h3 className="text-[var(--cream)] font-medium">{entity?.name || "Unknown"}</h3>
                      <div className="font-mono text-xs text-[var(--muted)] mt-1">
                        Submitted {new Date(claim.created_at).toLocaleDateString()}
                      </div>
                      {claim.rejection_reason && (
                        <div className="mt-3 p-3 rounded-lg bg-[var(--void)]/50">
                          <div className="font-mono text-xs text-[var(--muted)] mb-1">Feedback:</div>
                          <div className="font-mono text-sm text-[var(--cream)]">
                            {claim.rejection_reason}
                          </div>
                        </div>
                      )}
                    </div>
                    {(entityLink || claim.status === "needs_info") && (
                      <div className="flex flex-col items-end gap-2">
                        {entityLink && (
                          <Link
                            href={entityLink}
                            className="text-[var(--muted)] hover:text-[var(--cream)] font-mono text-xs"
                          >
                            View
                          </Link>
                        )}
                        {claim.status === "needs_info" && (
                          <Link
                            href={claimEditLink}
                            className="text-orange-400 hover:text-orange-300 font-mono text-xs"
                          >
                            Update
                          </Link>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
