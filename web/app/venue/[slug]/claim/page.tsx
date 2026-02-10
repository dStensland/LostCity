"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function VenueClaimPage({
  params,
}: {
  params: { slug: string };
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [venue, setVenue] = useState<{
    id: number;
    name: string;
    slug: string;
    address: string;
    city: string;
    state: string;
    website: string | null;
    claimed_by: string | null;
  } | null>(null);

  const [proofUrl, setProofUrl] = useState("");

  useEffect(() => {
    const fetchVenue = async () => {
      try {
        const response = await fetch(`/api/venues/search?slug=${params.slug}`);
        if (!response.ok) {
          throw new Error("Failed to fetch venue");
        }

        const data = await response.json();
        const venueData = data.venues?.[0];

        if (!venueData) {
          setError("Venue not found");
          return;
        }

        // Check if already claimed
        if (venueData.claimed_by) {
          setError("This venue has already been claimed");
          return;
        }

        setVenue({
          id: venueData.id,
          name: venueData.name,
          slug: venueData.slug,
          address: venueData.address || "",
          city: venueData.city || "",
          state: venueData.state || "",
          website: venueData.website,
          claimed_by: venueData.claimed_by,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchVenue();
  }, [params.slug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    if (!venue) return;

    try {
      const response = await fetch("/api/venues/claim", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          venue_id: venue.id,
          proof_url: proofUrl || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to submit claim");
      }

      const result = await response.json();

      // Check if auto-approved
      if (result.claim?.status === "approved") {
        router.push(`/venue/${params.slug}/dashboard`);
      } else {
        router.push(`/venue/${params.slug}/claim/success`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--void)] text-[var(--cream)] flex items-center justify-center">
        <div className="text-[var(--muted)]">Loading...</div>
      </div>
    );
  }

  if (error && !venue) {
    return (
      <div className="min-h-screen bg-[var(--void)] text-[var(--cream)] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[var(--void-light)] border border-[var(--border)] rounded-lg p-8 text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold mb-2">Error</h1>
          <p className="text-[var(--muted)] mb-6">{error}</p>
          <Link
            href={`/atlanta/spots/${params.slug}`}
            className="text-[var(--coral)] hover:underline"
          >
            Back to venue
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--void)] text-[var(--cream)]">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <Link
          href={`/atlanta/spots/${params.slug}`}
          className="inline-flex items-center gap-2 text-[var(--muted)] hover:text-[var(--cream)] mb-8 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to venue
        </Link>

        <div className="bg-[var(--void-light)] border border-[var(--border)] rounded-lg p-8">
          <h1 className="text-3xl font-bold mb-2">Claim Your Venue</h1>
          <p className="text-[var(--muted)] mb-8">
            Get management access to {venue?.name}
          </p>

          {error && (
            <div className="mb-6 bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded">
              {error}
            </div>
          )}

          <div className="mb-8 p-4 bg-[var(--void)] border border-[var(--border)] rounded">
            <h3 className="font-bold mb-2">{venue?.name}</h3>
            <p className="text-sm text-[var(--muted)]">
              {venue?.address && `${venue.address}, `}
              {venue?.city}, {venue?.state}
            </p>
            {venue?.website && (
              <p className="text-sm text-[var(--muted)] mt-1">
                Website: {venue.website}
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <h2 className="text-lg font-bold mb-4">Verification</h2>
              <p className="text-sm text-[var(--soft)] mb-4">
                To verify ownership, please provide a link to a page that shows your
                association with this venue (social media profile, press mention, or
                official listing).
              </p>
              <p className="text-sm text-[var(--soft)] mb-4">
                If your email domain matches the venue website (e.g., you&apos;re
                logged in with @{venue?.website?.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]})
                , your claim will be auto-approved.
              </p>

              <label htmlFor="proof_url" className="block text-sm font-medium mb-2">
                Proof URL (optional but recommended)
              </label>
              <input
                id="proof_url"
                type="url"
                value={proofUrl}
                onChange={(e) => setProofUrl(e.target.value)}
                className="w-full bg-[var(--void)] border border-[var(--border)] rounded px-4 py-2 text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
                placeholder="https://example.com/about-us"
              />
            </div>

            <div className="bg-[var(--neon-cyan)]/10 border border-[var(--neon-cyan)]/20 text-[var(--neon-cyan)] p-4 rounded text-sm">
              <strong>What you&apos;ll get:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Edit venue details, photos, and hours</li>
                <li>Submit events that appear across all portals</li>
                <li>View analytics and engagement metrics</li>
                <li>Verified badge on your venue page</li>
              </ul>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full px-6 py-3 bg-[var(--coral)] text-[var(--void)] font-medium rounded hover:bg-[var(--coral)]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? "Submitting..." : "Submit Claim"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
