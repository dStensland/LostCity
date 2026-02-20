"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import UnifiedHeader from "@/components/UnifiedHeader";
import { GooglePlaceAutocomplete } from "@/components/GooglePlaceAutocomplete";
import { useAuth } from "@/lib/auth-context";
import type { VenueSubmissionData } from "@/lib/types";
import { DEFAULT_PORTAL_SLUG } from "@/lib/constants";
import PageFooter from "@/components/PageFooter";

const VENUE_TYPES = [
  { id: "bar", label: "Bar" },
  { id: "restaurant", label: "Restaurant" },
  { id: "club", label: "Club / Nightlife" },
  { id: "music_venue", label: "Music Venue" },
  { id: "theater", label: "Theater" },
  { id: "gallery", label: "Art Gallery" },
  { id: "museum", label: "Museum" },
  { id: "park", label: "Park / Outdoor" },
  { id: "community_center", label: "Community Center" },
  { id: "brewery", label: "Brewery / Taproom" },
  { id: "coffee_shop", label: "Coffee Shop" },
  { id: "other", label: "Other" },
];

export default function SubmitVenuePage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");

  const [step, setStep] = useState<"details" | "review" | "submitted">("details");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [confirmAccuracy, setConfirmAccuracy] = useState(false);
  const [autoApproved, setAutoApproved] = useState(false);
  const [approvedVenueSlug, setApprovedVenueSlug] = useState<string | null>(null);
  const [editSubmissionId, setEditSubmissionId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<string | null>(null);
  const [editRejectionReason, setEditRejectionReason] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  // Place selection (required)
  const [selectedPlace, setSelectedPlace] = useState<{
    name: string;
    address?: string;
    google_place_id?: string; // Field name kept for compatibility, contains Foursquare ID
    venue_id?: number;
    location?: { lat: number; lng: number };
    website?: string;
    category?: string;
    categoryName?: string;
  } | null>(null);

  // Additional optional fields
  const [venueType, setVenueType] = useState("");
  const [website, setWebsite] = useState("");

  // Auto-fill fields when a Foursquare place is selected
  useEffect(() => {
    if (!selectedPlace?.google_place_id) return;
    if (selectedPlace.category && !venueType) {
      setVenueType(selectedPlace.category);
    }
    if (selectedPlace.website && !website) {
      setWebsite(selectedPlace.website);
    }
  }, [selectedPlace]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user) {
      router.push("/auth/login?redirect=/submit/venue");
      return;
    }
  }, [user, router]);

  useEffect(() => {
    if (!editId || !user) return;
    let isActive = true;
    setEditSubmissionId(editId);
    setEditLoading(true);

    fetch(`/api/submissions/${editId}`)
      .then((res) => res.json())
      .then((data) => {
        if (!isActive || !data?.submission) return;
        const submission = data.submission as {
          submission_type: string;
          status: string;
          rejection_reason: string | null;
          data: VenueSubmissionData;
        };

        if (submission.submission_type !== "venue") {
          setError("This submission is not a venue.");
          return;
        }

        const venueData = submission.data;
        setSelectedPlace({
          name: venueData.name,
          address: venueData.address || undefined,
          google_place_id: venueData.foursquare_id || venueData.google_place_id || undefined,
        });
        setVenueType(venueData.venue_type || "");
        setWebsite(venueData.website || "");
        setEditStatus(submission.status);
        setEditRejectionReason(submission.rejection_reason);
      })
      .catch(() => {
        if (!isActive) return;
        setError("Failed to load submission for editing.");
      })
      .finally(() => {
        if (isActive) setEditLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [editId, user]);

  if (!user) {
    return null;
  }

  const buildVenueData = (): VenueSubmissionData | null => {
    if (!selectedPlace?.google_place_id) return null;

    // Parse address from Foursquare's format
    let city = "Atlanta";
    let state = "GA";
    let zip = "";
    let streetAddress = "";

    if (selectedPlace.address) {
      const addressParts = selectedPlace.address.split(",").map((p) => p.trim());
      if (addressParts.length >= 1) {
        streetAddress = addressParts[0];
      }
      if (addressParts.length >= 2) {
        city = addressParts[1];
      }
      if (addressParts.length >= 3) {
        const stateZip = addressParts[2].split(" ");
        if (stateZip.length >= 1) state = stateZip[0];
        if (stateZip.length >= 2) zip = stateZip[1];
      }
    }

    return {
      name: selectedPlace.name,
      address: streetAddress || undefined,
      city,
      state,
      zip: zip || undefined,
      venue_type: venueType || undefined,
      website: website.trim() || undefined,
      foursquare_id: selectedPlace.google_place_id, // Field name is google_place_id but contains Foursquare ID
    };
  };

  const validateForReview = () => {
    if (!selectedPlace?.google_place_id) {
      return "Please select a place from the search results";
    }
    if (selectedPlace?.venue_id) {
      return "This venue is already in Lost City!";
    }
    return null;
  };

  const handleReview = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setDuplicateWarning(null);

    const validationError = validateForReview();
    if (validationError) {
      setError(validationError);
      return;
    }

    setStep("review");
  };

  const submitVenue = async (duplicateAcknowledged = false) => {
    setError(null);
    setDuplicateWarning(null);
    setSubmitting(true);

    const data = buildVenueData();
    if (!data) {
      setError("Please select a place from the search results");
      setSubmitting(false);
      return;
    }

    try {
      const isEditing = Boolean(editSubmissionId);
      const res = await fetch(isEditing ? `/api/submissions/${editSubmissionId}` : "/api/submissions", {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isEditing
            ? { data }
            : {
                submission_type: "venue",
                data,
                duplicate_acknowledged: duplicateAcknowledged || undefined,
              }
        ),
      });

      const result = await res.json();

      if (!editSubmissionId && res.status === 409) {
        setDuplicateWarning(result.warning || "Potential duplicate detected.");
        return;
      }

      if (!res.ok) {
        throw new Error(result.error || "Failed to submit venue");
      }

      if (!editSubmissionId && result.autoApproved && result.venue?.slug) {
        setAutoApproved(true);
        setApprovedVenueSlug(result.venue.slug);
      }

      setStep("submitted");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit venue");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setStep("details");
    setSubmitting(false);
    setError(null);
    setDuplicateWarning(null);
    setConfirmAccuracy(false);
    setAutoApproved(false);
    setApprovedVenueSlug(null);
    setEditSubmissionId(null);
    setEditStatus(null);
    setEditRejectionReason(null);
    setSelectedPlace(null);
    setVenueType("");
    setWebsite("");
  };

  return (
    <div className="min-h-screen">
      <UnifiedHeader />

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/submit"
            className="text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-2xl font-semibold text-[var(--cream)]">
            Add a Spot
          </h1>
        </div>

        <p className="text-[var(--soft)] mb-6">
          Search for a place to add it to Lost City. Verified places are approved instantly.
        </p>

        <div className="mb-6 flex items-center gap-2 text-xs font-mono text-[var(--muted)]">
          {["Details", "Review", "Submit"].map((label, index) => (
            <div key={label} className="flex items-center gap-2">
              <span
                className={`px-2 py-1 rounded-full border ${
                  (step === "details" && index === 0) ||
                  (step === "review" && index <= 1) ||
                  (step === "submitted" && index <= 2)
                    ? "border-[var(--coral)] text-[var(--coral)]"
                    : "border-[var(--twilight)]"
                }`}
              >
                {index + 1}. {label}
              </span>
              {index < 2 && <span className="text-[var(--twilight)]">—</span>}
            </div>
          ))}
        </div>

        {editSubmissionId && (
          <div className="mb-6 p-4 rounded-lg bg-[var(--void)]/60 border border-[var(--twilight)] text-[var(--soft)] font-mono text-xs">
            Editing submission {editSubmissionId.slice(0, 8)}… {editStatus ? `(${editStatus})` : ""}
            {editRejectionReason && (
              <div className="mt-2 text-[var(--muted)]">
                Feedback: {editRejectionReason}
              </div>
            )}
          </div>
        )}

        <div className="grid gap-4 mb-6">
          <div className="p-4 rounded-lg bg-[var(--void)]/60 border border-[var(--twilight)]">
            <div className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">
              What happens next
            </div>
            <p className="text-[var(--soft)] text-sm mt-2">
              If we can verify this place with trusted map data, it goes live right away. Otherwise it goes into review.
            </p>
          </div>
          <div className="p-4 rounded-lg bg-[var(--void)]/60 border border-[var(--twilight)]">
            <div className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">
              Track your status
            </div>
            <p className="text-[var(--soft)] text-sm mt-2">
              You can see approvals, edits, and notes in your{" "}
              <Link href="/dashboard/submissions" className="text-[var(--coral)] hover:text-[var(--rose)]">
                submissions dashboard
              </Link>
              .
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-[var(--coral)]/10 border border-[var(--coral)] text-[var(--coral)] font-mono text-sm">
            {error}
          </div>
        )}

        {editLoading ? (
          <div className="py-12 text-center">
            <div className="w-8 h-8 border-2 border-[var(--coral)] border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : step === "submitted" ? (
          <div className="p-8 rounded-xl bg-[var(--dusk)] border border-[var(--twilight)] text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--neon-green)]/20 border border-[var(--neon-green)]/40 flex items-center justify-center">
              <svg className="w-8 h-8 text-[var(--neon-green)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-[var(--cream)] mb-2">
              Submission received
            </h2>
            <p className="text-[var(--soft)] mb-6">
              {editSubmissionId
                ? "Your updates were submitted. We’ll review them shortly."
                : autoApproved
                  ? "Your venue was auto-approved and is live now."
                  : "We’ll review your venue and publish it soon."}
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {!editSubmissionId && autoApproved && approvedVenueSlug && (
                <Link
                  href={`/${DEFAULT_PORTAL_SLUG}/spots/${approvedVenueSlug}`}
                  className="px-5 py-2.5 rounded-lg bg-[var(--coral)] text-[var(--void)] font-mono text-sm font-medium hover:bg-[var(--rose)] transition-colors"
                >
                  View venue
                </Link>
              )}
              <Link
                href="/dashboard/submissions"
                className="px-5 py-2.5 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm hover:border-[var(--coral)] transition-colors"
              >
                View submissions
              </Link>
              <button
                type="button"
                onClick={resetForm}
                className="px-5 py-2.5 rounded-lg text-[var(--muted)] font-mono text-sm hover:text-[var(--cream)] transition-colors"
              >
                Submit another
              </button>
            </div>
          </div>
        ) : step === "review" ? (
          <div className="space-y-6">
            <div className="p-6 rounded-xl bg-[var(--dusk)] border border-[var(--twilight)]">
              <h2 className="text-lg font-semibold text-[var(--cream)] mb-4">Review your submission</h2>
              <div className="space-y-3 text-sm text-[var(--soft)]">
                <div className="flex flex-wrap gap-2">
                  <span className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">Place</span>
                  <span className="text-[var(--cream)]">{selectedPlace?.name}</span>
                </div>
                {selectedPlace?.address && (
                  <div className="flex flex-wrap gap-2">
                    <span className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">Address</span>
                    <span className="text-[var(--cream)]">{selectedPlace.address}</span>
                  </div>
                )}
                {venueType && (
                  <div className="flex flex-wrap gap-2">
                    <span className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">Type</span>
                    <span className="text-[var(--cream)]">{VENUE_TYPES.find((t) => t.id === venueType)?.label || venueType}</span>
                  </div>
                )}
                {website && (
                  <div className="flex flex-wrap gap-2">
                    <span className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">Website</span>
                    <span className="text-[var(--cream)]">{website}</span>
                  </div>
                )}
              </div>
            </div>

            {!editSubmissionId && duplicateWarning && (
              <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500 text-orange-300 font-mono text-xs">
                {duplicateWarning} If this is a different venue, you can submit anyway.
              </div>
            )}

            <label className="flex items-start gap-3 text-sm text-[var(--soft)]">
              <input
                type="checkbox"
                checked={confirmAccuracy}
                onChange={(e) => setConfirmAccuracy(e.target.checked)}
                className="mt-1"
              />
              I confirm this information is accurate and public.
            </label>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  setStep("details");
                  setConfirmAccuracy(false);
                }}
                className="px-4 py-2.5 rounded-lg font-mono text-sm text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
              >
                Back to edit
              </button>
              <button
                type="button"
                onClick={() => submitVenue(false)}
                disabled={submitting || !confirmAccuracy}
                className="px-6 py-2.5 rounded-lg bg-[var(--coral)] text-[var(--void)] font-mono text-sm font-medium hover:bg-[var(--rose)] transition-colors disabled:opacity-50"
              >
                {submitting ? "Submitting..." : editSubmissionId ? "Submit updates" : "Submit venue"}
              </button>
              {!editSubmissionId && duplicateWarning && (
                <button
                  type="button"
                  onClick={() => submitVenue(true)}
                  disabled={submitting || !confirmAccuracy}
                  className="px-6 py-2.5 rounded-lg border border-orange-400 text-orange-200 font-mono text-sm hover:bg-orange-400/10 transition-colors disabled:opacity-50"
                >
                  Submit anyway
                </button>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={handleReview} className="space-y-6">
            {/* Place Search - Required */}
            <div>
              <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
                Search for a place *
              </label>
              <GooglePlaceAutocomplete
                value={selectedPlace}
                onChange={setSelectedPlace}
                placeholder="Search for a bar, restaurant, venue..."
                required
              />
            </div>

            {/* Show selected place details */}
            {selectedPlace?.google_place_id && (
              <div className="p-4 rounded-lg bg-[var(--neon-green)]/10 border border-[var(--neon-green)]/20">
                <div className="flex items-start gap-3">
                  <svg
                    className="w-5 h-5 text-[var(--neon-green)] flex-shrink-0 mt-0.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-sm text-[var(--neon-green)] font-medium">
                      Instant Approval
                    </div>
                    <div className="text-[var(--cream)] font-medium mt-1">
                      {selectedPlace.name}
                    </div>
                    {selectedPlace.address && (
                      <div className="font-mono text-xs text-[var(--muted)] mt-0.5">
                        {selectedPlace.address}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Venue Already Exists */}
            {selectedPlace?.venue_id && (
              <div className="p-4 rounded-lg bg-[var(--neon-cyan)]/10 border border-[var(--neon-cyan)]/20">
                <div className="flex items-center gap-2">
                  <svg
                    className="w-5 h-5 text-[var(--neon-cyan)]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <div>
                    <div className="font-mono text-sm text-[var(--neon-cyan)] font-medium">
                      Already on Lost City
                    </div>
                    <div className="font-mono text-xs text-[var(--muted)] mt-0.5">
                      This place is already in our database
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Optional fields - only show when a place is selected */}
            {selectedPlace?.google_place_id && !selectedPlace?.venue_id && (
              <>
                <div className="border-t border-[var(--twilight)] pt-6">
                  <h3 className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-4">
                    Additional Details (Optional)
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
                        Type
                      </label>
                      <select
                        value={venueType}
                        onChange={(e) => setVenueType(e.target.value)}
                        className="w-full px-4 py-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm focus:outline-none focus:border-[var(--coral)] transition-colors"
                      >
                        <option value="">Select type</option>
                        {VENUE_TYPES.map((t) => (
                          <option key={t.id} value={t.id}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
                      Website
                    </label>
                    <input
                      type="url"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="https://..."
                      className="w-full px-4 py-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)] transition-colors"
                    />
                    <p className="mt-2 text-[var(--muted)] font-mono text-xs">
                      A website link helps us verify faster.
                    </p>
                  </div>
                </div>
              </>
            )}

            <div className="flex gap-3 pt-4">
              <Link
                href="/submit"
                className="px-4 py-2.5 rounded-lg font-mono text-sm text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={submitting || !selectedPlace?.google_place_id || !!selectedPlace?.venue_id}
                className="flex-1 sm:flex-none px-6 py-2.5 rounded-lg bg-[var(--coral)] text-[var(--void)] font-mono text-sm font-medium hover:bg-[var(--rose)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Review submission
              </button>
            </div>
          </form>
        )}
      </main>

      <PageFooter />
    </div>
  );
}
