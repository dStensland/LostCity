"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import UnifiedHeader from "@/components/UnifiedHeader";
import { GooglePlaceAutocomplete } from "@/components/GooglePlaceAutocomplete";
import { useAuth } from "@/lib/auth-context";
import type { VenueSubmissionData } from "@/lib/types";
import { VENUE_SUBMISSION_NEIGHBORHOODS } from "@/config/neighborhoods";

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

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Place selection (required)
  const [selectedPlace, setSelectedPlace] = useState<{
    name: string;
    address?: string;
    google_place_id?: string; // Field name kept for compatibility, contains Foursquare ID
    venue_id?: number;
    location?: { lat: number; lng: number };
  } | null>(null);

  // Additional optional fields
  const [venueType, setVenueType] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [website, setWebsite] = useState("");

  if (!user) {
    router.push("/auth/login?redirect=/submit/venue");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    if (!selectedPlace?.google_place_id) {
      setError("Please select a place from the search results");
      setSubmitting(false);
      return;
    }

    // If venue already exists in our DB, just redirect to it
    if (selectedPlace.venue_id) {
      setError("This venue is already in Lost City!");
      setSubmitting(false);
      return;
    }

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

    const data: VenueSubmissionData = {
      name: selectedPlace.name,
      address: streetAddress || undefined,
      neighborhood: neighborhood || undefined,
      city,
      state,
      zip: zip || undefined,
      venue_type: venueType || undefined,
      website: website.trim() || undefined,
      foursquare_id: selectedPlace.google_place_id, // Field name is google_place_id but contains Foursquare ID
    };

    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submission_type: "venue",
          data,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Failed to submit venue");
      }

      // Check if it was auto-approved (has venue data)
      if (result.venue) {
        router.push(`/atlanta/spots/${result.venue.slug}?submitted=true`);
      } else {
        router.push("/dashboard/submissions?success=venue");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit venue");
    } finally {
      setSubmitting(false);
    }
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
            Add a Destination
          </h1>
        </div>

        <p className="text-[var(--soft)] mb-6">
          Search for a place to add it to Lost City. Verified places are approved instantly.
        </p>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-[var(--coral)]/10 border border-[var(--coral)] text-[var(--coral)] font-mono text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
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

                  <div>
                    <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
                      Neighborhood
                    </label>
                    <select
                      value={neighborhood}
                      onChange={(e) => setNeighborhood(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm focus:outline-none focus:border-[var(--coral)] transition-colors"
                    >
                      <option value="">Select neighborhood</option>
                      {VENUE_SUBMISSION_NEIGHBORHOODS.map((n) => (
                        <option key={n} value={n}>{n}</option>
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
              {submitting ? "Adding..." : "Add Destination"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
