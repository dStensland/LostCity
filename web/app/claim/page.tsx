"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import UnifiedHeader from "@/components/UnifiedHeader";
import { useAuth } from "@/lib/auth-context";

const VERIFICATION_OPTIONS = [
  {
    id: "domain_email",
    label: "Verify via domain email",
    description: "I can receive email at the official domain.",
  },
  {
    id: "website_token",
    label: "Verify via website token",
    description: "I can add a token to the official website.",
  },
  {
    id: "manual",
    label: "Other proof",
    description: "I can provide alternative evidence.",
  },
];

export default function ClaimPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const type = searchParams.get("type");
  const idParam = searchParams.get("id");
  const nameParam = searchParams.get("name");
  const returnTo = searchParams.get("return");
  const claimId = searchParams.get("claim_id");

  const [entityType, setEntityType] = useState(type);
  const [entityId, setEntityId] = useState(idParam);
  const [entityName, setEntityName] = useState(nameParam);
  const [claimStatus, setClaimStatus] = useState<string | null>(null);
  const [verificationMethod, setVerificationMethod] = useState("domain_email");
  const [domain, setDomain] = useState("");
  const [token, setToken] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingClaim, setLoadingClaim] = useState(false);

  const redirectUrl = useMemo(() => {
    const query = searchParams.toString();
    return `/auth/login?redirect=/claim${query ? `?${query}` : ""}`;
  }, [searchParams]);

  useEffect(() => {
    if (!user) {
      router.push(redirectUrl);
    }
  }, [user, router, redirectUrl]);

  const isVenue = entityType === "venue";
  const isOrganization = entityType === "organization";
  const displayName = entityName || (isVenue ? "venue" : "organization");

  useEffect(() => {
    if (!user) return;
    if (!claimId || entityType || entityId) return;

    setLoadingClaim(true);
    fetch(`/api/claims/${claimId}`)
      .then((res) => res.json())
      .then((data) => {
        const claim = data.claim as {
          status: string;
          venue_id: number | null;
          organization_id: string | null;
          verification_method: string | null;
          verification_domain: string | null;
          verification_token: string | null;
          notes: string | null;
          venue?: { name: string };
          organization?: { name: string };
        } | null;
        if (!claim) {
          setError("Claim request not found");
          return;
        }
        if (claim.venue_id) {
          setEntityType("venue");
          setEntityId(claim.venue_id.toString());
          setEntityName(claim.venue?.name || "venue");
        } else if (claim.organization_id) {
          setEntityType("organization");
          setEntityId(claim.organization_id);
          setEntityName(claim.organization?.name || "organization");
        }
        setClaimStatus(claim.status);
        setVerificationMethod(claim.verification_method || "domain_email");
        setDomain(claim.verification_domain || "");
        setToken(claim.verification_token || "");
        setNotes(claim.notes || "");
      })
      .catch(() => setError("Failed to load claim request"))
      .finally(() => setLoadingClaim(false));
  }, [claimId, entityType, entityId, user]);

  if (!user) {
    return null;
  }

  if ((!entityType || !entityId || (!isVenue && !isOrganization)) && !claimId) {
    return (
      <div className="min-h-screen">
        <UnifiedHeader />
        <main className="max-w-2xl mx-auto px-4 py-12">
          <div className="text-center">
            <h1 className="text-3xl font-semibold text-[var(--cream)] mb-4">
              Claim a Venue or Organization
            </h1>
            <p className="text-[var(--muted)] font-mono text-sm mb-6">
              Visit the venue or organization page and click “Claim this” to get started.
            </p>
            <Link
              href="/spots"
              className="inline-flex px-6 py-3 rounded-lg bg-[var(--coral)] text-[var(--void)] font-mono text-sm font-medium hover:bg-[var(--rose)] transition-colors"
            >
              Browse Spots
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const payload: Record<string, unknown> = {
      verification_method: verificationMethod,
      verification_domain: domain.trim() || undefined,
      verification_token: token.trim() || undefined,
      notes: notes.trim() || undefined,
    };

    if (!claimId) {
      if (isVenue) {
        payload.venue_id = Number(entityId);
      } else {
        payload.organization_id = entityId;
      }
    }

    try {
      const res = await fetch(claimId ? `/api/claims/${claimId}` : "/api/claims", {
        method: claimId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Failed to submit claim request");
      }

      router.push(`/dashboard/claims?success=${claimId ? "updated" : "1"}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit claim request");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen">
      <UnifiedHeader />

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          {returnTo && (
            <Link
              href={returnTo}
              className="text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
          )}
          <h1 className="text-2xl font-semibold text-[var(--cream)]">
            {claimId ? "Update Claim Request" : `Claim ${isVenue ? "Venue" : "Organization"}`}
          </h1>
        </div>

        <p className="text-[var(--soft)] mb-6">
          You&apos;re requesting ownership of <span className="text-[var(--cream)] font-medium">{displayName}</span>.
          We&apos;ll review your claim as soon as possible.
        </p>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-[var(--coral)]/10 border border-[var(--coral)] text-[var(--coral)] font-mono text-sm">
            {error}
          </div>
        )}

        {loadingClaim && (
          <div className="mb-6 p-4 rounded-lg bg-[var(--void)]/50 border border-[var(--twilight)] text-[var(--muted)] font-mono text-sm">
            Loading claim details...
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
              Verification Method
            </label>
            <div className="space-y-2">
              {VERIFICATION_OPTIONS.map((option) => (
                <label
                  key={option.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    verificationMethod === option.id
                      ? "border-[var(--coral)] bg-[var(--coral)]/5"
                      : "border-[var(--twilight)] bg-[var(--dusk)] hover:border-[var(--coral)]"
                  }`}
                >
                  <input
                    type="radio"
                    name="verification"
                    value={option.id}
                    checked={verificationMethod === option.id}
                    onChange={() => setVerificationMethod(option.id)}
                    className="mt-1"
                  />
                  <div>
                    <div className="text-[var(--cream)] font-medium text-sm">{option.label}</div>
                    <div className="text-[var(--muted)] font-mono text-xs">{option.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {(verificationMethod === "domain_email" || verificationMethod === "website_token") && (
            <div>
              <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
                Official Domain
              </label>
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="example.com"
                className="w-full px-4 py-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)] transition-colors"
              />
            </div>
          )}

          {verificationMethod === "website_token" && (
            <div>
              <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
                Website Token (if you already have one)
              </label>
              <input
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Optional token or proof"
                className="w-full px-4 py-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)] transition-colors"
              />
            </div>
          )}

          {verificationMethod === "manual" && (
            <div>
              <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
                Proof
              </label>
              <input
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Link or description of proof"
                className="w-full px-4 py-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)] transition-colors"
              />
            </div>
          )}

          <div>
            <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
              Additional Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Anything else that helps us verify ownership"
              className="w-full px-4 py-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)] transition-colors resize-none"
            />
          </div>

          {claimStatus === "needs_info" && (
            <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500 text-orange-400 font-mono text-xs">
              This request needs more info. Update your details below and resubmit.
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || loadingClaim}
            className="w-full px-4 py-3 rounded-lg bg-[var(--coral)] text-[var(--void)] font-mono text-sm font-medium hover:bg-[var(--rose)] transition-colors disabled:opacity-60"
          >
            {submitting || loadingClaim ? "Submitting..." : claimId ? "Update Claim Request" : "Submit Claim Request"}
          </button>
        </form>
      </main>
    </div>
  );
}
