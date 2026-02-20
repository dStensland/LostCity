"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { GooglePlaceAutocomplete } from "@/components/GooglePlaceAutocomplete";
import type { VenueSubmissionData } from "@/lib/types";

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

type ModalState = "form" | "success";

interface SubmitVenueModalProps {
  isOpen: boolean;
  onClose: () => void;
  portalSlug?: string;
}

interface SuccessData {
  name: string;
  slug: string;
}

export default function SubmitVenueModal({ isOpen, onClose, portalSlug = "atlanta" }: SubmitVenueModalProps) {
  const router = useRouter();
  const { user } = useAuth();
  const modalRef = useRef<HTMLDivElement>(null);

  const [modalState, setModalState] = useState<ModalState>("form");
  const [successData, setSuccessData] = useState<SuccessData | null>(null);

  // Form state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<{
    name: string;
    address?: string;
    google_place_id?: string;
    venue_id?: number;
    location?: { lat: number; lng: number };
    website?: string;
    category?: string;
    categoryName?: string;
  } | null>(null);
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

  const resetForm = useCallback(() => {
    setSelectedPlace(null);
    setVenueType("");
    setWebsite("");
    setError(null);
    setSubmitting(false);
    setModalState("form");
    setSuccessData(null);
  }, []);

  // Focus trap, escape key, body scroll lock
  useEffect(() => {
    if (!isOpen) return;

    document.body.style.overflow = "hidden";

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !submitting) {
        onClose();
        return;
      }

      if (e.key === "Tab" && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, submitting, onClose]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      resetForm();
    }
  }, [isOpen, resetForm]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget && !submitting) {
        onClose();
      }
    },
    [submitting, onClose]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    if (!selectedPlace?.google_place_id) {
      setError("Please select a place from the search results");
      setSubmitting(false);
      return;
    }

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
      if (addressParts.length >= 1) streetAddress = addressParts[0];
      if (addressParts.length >= 2) city = addressParts[1];
      if (addressParts.length >= 3) {
        const stateZip = addressParts[2].split(" ");
        if (stateZip.length >= 1) state = stateZip[0];
        if (stateZip.length >= 2) zip = stateZip[1];
      }
    }

    const data: VenueSubmissionData = {
      name: selectedPlace.name,
      address: streetAddress || undefined,
      city,
      state,
      zip: zip || undefined,
      venue_type: venueType || undefined,
      website: website.trim() || undefined,
      foursquare_id: selectedPlace.google_place_id,
    };

    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submission_type: "venue", data }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Failed to submit venue");
      }

      if (result.venue) {
        setSuccessData({ name: result.venue.name || selectedPlace.name, slug: result.venue.slug });
        setModalState("success");
      } else {
        // Submitted for review — still show success
        setSuccessData({ name: selectedPlace.name, slug: "" });
        setModalState("success");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit venue");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddAnother = () => {
    resetForm();
  };

  const handleViewDetails = () => {
    if (successData?.slug) {
      router.push(`/${portalSlug}/spots/${successData.slug}`);
    }
    onClose();
  };

  if (!isOpen) return null;

  // Not logged in
  if (!user) {
    const notLoggedInContent = (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={handleBackdropClick}
        role="dialog"
        aria-modal="true"
        aria-labelledby="submit-venue-title"
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        <div className="relative max-w-md w-full">
          <button
            onClick={onClose}
            className="absolute -top-10 right-0 text-[var(--muted)] hover:text-[var(--cream)] transition-colors p-1"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="bg-[var(--night)] border border-[var(--twilight)] rounded-xl p-6 w-full">
            <p className="text-[var(--soft)] text-center mb-4">
              You need to be logged in to add a venue.
            </p>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 bg-[var(--twilight)] text-[var(--cream)] rounded-lg font-mono text-sm hover:bg-[var(--dusk)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => router.push("/auth/login?redirect=/submit/venue")}
                className="flex-1 py-2.5 bg-[var(--coral)] text-[var(--void)] rounded-lg font-mono text-sm font-medium hover:bg-[var(--rose)] transition-colors"
              >
                Log In
              </button>
            </div>
          </div>
        </div>
      </div>
    );

    if (typeof document !== "undefined") {
      return createPortal(notLoggedInContent, document.body);
    }
    return null;
  }

  const modalContent = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="submit-venue-title"
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div className="relative max-w-lg w-full animate-in fade-in scale-in">
        {/* Close button — outside the modal panel */}
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-[var(--muted)] hover:text-[var(--cream)] transition-colors p-1"
          aria-label="Close"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

      <div
        ref={modalRef}
        className="bg-[var(--night)] border border-[var(--twilight)] rounded-xl p-6 w-full shadow-2xl max-h-[85vh] overflow-y-auto min-h-[420px]"
      >

        {submitting ? (
          /* Pizza loading state */
          <div className="text-center py-10">
            <div className="w-24 h-24 mx-auto mb-5 relative">
              <svg
                className="w-24 h-24 animate-[spin_2s_linear_infinite]"
                viewBox="0 0 100 100"
              >
                {/* Crust */}
                <circle cx="50" cy="50" r="46" fill="#D4A054" />
                <circle cx="50" cy="50" r="44" fill="#C4903C" />
                {/* Sauce */}
                <circle cx="50" cy="50" r="38" fill="#C0392B" />
                {/* Cheese base */}
                <circle cx="50" cy="50" r="36" fill="#F5CBA7" />
                {/* Melted cheese blobs */}
                <ellipse cx="38" cy="38" rx="10" ry="8" fill="#FDEBD0" opacity="0.8" />
                <ellipse cx="62" cy="55" rx="9" ry="7" fill="#FDEBD0" opacity="0.7" />
                <ellipse cx="45" cy="62" rx="8" ry="6" fill="#FAE5CD" opacity="0.6" />
                {/* Pepperoni */}
                <circle cx="35" cy="40" r="5" fill="#922B21" />
                <circle cx="35" cy="40" r="4.5" fill="#B03A2E" />
                <circle cx="35" cy="40" r="2" fill="#922B21" opacity="0.4" />
                <circle cx="58" cy="35" r="5" fill="#922B21" />
                <circle cx="58" cy="35" r="4.5" fill="#B03A2E" />
                <circle cx="58" cy="35" r="2" fill="#922B21" opacity="0.4" />
                <circle cx="50" cy="55" r="5" fill="#922B21" />
                <circle cx="50" cy="55" r="4.5" fill="#B03A2E" />
                <circle cx="50" cy="55" r="2" fill="#922B21" opacity="0.4" />
                <circle cx="65" cy="55" r="4.5" fill="#922B21" />
                <circle cx="65" cy="55" r="4" fill="#B03A2E" />
                <circle cx="42" cy="50" r="4.5" fill="#922B21" />
                <circle cx="42" cy="50" r="4" fill="#B03A2E" />
                {/* Basil leaves */}
                <ellipse cx="52" cy="42" rx="4" ry="2" fill="#27AE60" transform="rotate(-30 52 42)" />
                <ellipse cx="40" cy="58" rx="3.5" ry="1.8" fill="#2ECC71" transform="rotate(20 40 58)" />
                {/* Cheese drip highlights */}
                <ellipse cx="55" cy="48" rx="3" ry="1.5" fill="#FFF8E1" opacity="0.5" />
                {/* Missing slice wedge */}
                <path d="M50,50 L50,4 L72,10 Z" fill="var(--night)" />
                <line x1="50" y1="50" x2="50" y2="4" stroke="#D4A054" strokeWidth="1.5" />
                <line x1="50" y1="50" x2="72" y2="10" stroke="#D4A054" strokeWidth="1.5" />
                {/* Sauce on cut edges */}
                <line x1="50" y1="48" x2="50" y2="12" stroke="#C0392B" strokeWidth="0.8" opacity="0.5" />
              </svg>
              {/* Steam wisps */}
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 flex gap-2">
                <span className="block w-1 h-4 bg-[var(--muted)] rounded-full opacity-40 animate-pulse" />
                <span className="block w-1 h-6 bg-[var(--muted)] rounded-full opacity-30 animate-pulse" />
                <span className="block w-1 h-4 bg-[var(--muted)] rounded-full opacity-40 animate-pulse" />
              </div>
            </div>
            <p className="text-[var(--cream)] font-medium mb-1">Adding your spot...</p>
            <p className="text-[var(--muted)] font-mono text-xs">
              I was hungry when I made this loading screen.
            </p>
          </div>
        ) : modalState === "success" ? (
          /* Success state */
          <div className="text-center py-4">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--neon-green)]/20 border-2 border-[var(--neon-green)]/50 flex items-center justify-center">
              <svg className="w-8 h-8 text-[var(--neon-green)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <h2 className="text-xl font-semibold text-[var(--cream)] mb-2">
              Added to Lost City
            </h2>

            {successData && (
              <p className="text-[var(--soft)] mb-6">
                {successData.slug ? (
                  <button
                    onClick={handleViewDetails}
                    className="text-[var(--coral)] hover:text-[var(--rose)] transition-colors font-medium"
                  >
                    {successData.name}
                  </button>
                ) : (
                  <span>
                    <span className="text-[var(--cream)] font-medium">{successData.name}</span>
                    {" "}has been submitted for review.
                  </span>
                )}
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleAddAnother}
                className="flex-1 py-2.5 bg-[var(--twilight)] text-[var(--cream)] rounded-lg font-mono text-sm hover:bg-[var(--dusk)] transition-colors"
              >
                Add Another
              </button>
              {successData?.slug && (
                <button
                  onClick={handleViewDetails}
                  className="flex-1 py-2.5 bg-[var(--coral)] text-[var(--void)] rounded-lg font-mono text-sm font-medium hover:bg-[var(--rose)] transition-colors"
                >
                  View Details
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Form state */
          <>
            <h2 id="submit-venue-title" className="text-xl font-semibold text-[var(--cream)] mb-2">
              Add a Spot
            </h2>
            <p className="text-sm text-[var(--soft)] mb-6">
              Search for a place to add it to Lost City. Verified places are approved instantly.
            </p>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-[var(--coral)]/10 border border-[var(--coral)] text-[var(--coral)] font-mono text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Place Search */}
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

              {/* Selected place details */}
              {selectedPlace?.google_place_id && (
                <div className="p-3 rounded-lg bg-[var(--neon-green)]/10 border border-[var(--neon-green)]/20">
                  <div className="flex items-start gap-3">
                    <svg
                      className="w-5 h-5 text-[var(--neon-green)] flex-shrink-0 mt-0.5"
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-sm text-[var(--neon-green)] font-medium">Instant Approval</div>
                      <div className="text-[var(--cream)] font-medium mt-1">{selectedPlace.name}</div>
                      {selectedPlace.address && (
                        <div className="font-mono text-xs text-[var(--muted)] mt-0.5">{selectedPlace.address}</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Venue already exists */}
              {selectedPlace?.venue_id && (
                <div className="p-3 rounded-lg bg-[var(--neon-cyan)]/10 border border-[var(--neon-cyan)]/20">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-[var(--neon-cyan)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <div className="font-mono text-sm text-[var(--neon-cyan)] font-medium">Already on Lost City</div>
                      <div className="font-mono text-xs text-[var(--muted)] mt-0.5">This place is already in our database</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Optional fields */}
              {selectedPlace?.google_place_id && !selectedPlace?.venue_id && (
                <div className="border-t border-[var(--twilight)] pt-4">
                  <h3 className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-3">
                    Additional Details (Optional)
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-1.5">Type</label>
                      <select
                        value={venueType}
                        onChange={(e) => setVenueType(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm focus:outline-none focus:border-[var(--coral)] transition-colors"
                      >
                        <option value="">Select type</option>
                        {VENUE_TYPES.map((t) => (
                          <option key={t.id} value={t.id}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="mt-3">
                    <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-1.5">Website</label>
                    <input
                      type="url"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="https://..."
                      className="w-full px-3 py-2.5 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)] transition-colors"
                    />
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-lg font-mono text-sm text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !selectedPlace?.google_place_id || !!selectedPlace?.venue_id}
                  className="flex-1 py-2.5 rounded-lg bg-[var(--coral)] text-[var(--void)] font-mono text-sm font-medium hover:bg-[var(--rose)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? "Adding..." : "Add Spot"}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
      </div>
    </div>
  );

  if (typeof document !== "undefined") {
    return createPortal(modalContent, document.body);
  }

  return null;
}
