"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import UnifiedHeader from "@/components/UnifiedHeader";
import ImageUploader from "@/components/ImageUploader";
import { useAuth } from "@/lib/auth-context";
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

const NEIGHBORHOODS = [
  "Downtown",
  "Midtown",
  "Buckhead",
  "East Atlanta",
  "Little Five Points",
  "Inman Park",
  "Old Fourth Ward",
  "Virginia Highland",
  "Decatur",
  "West End",
  "Grant Park",
  "Cabbagetown",
  "Kirkwood",
  "Reynoldstown",
  "Edgewood",
  "Poncey-Highland",
  "Other",
];

export default function SubmitVenuePage() {
  const { user } = useAuth();
  const router = useRouter();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("Atlanta");
  const [state, setState] = useState("GA");
  const [zip, setZip] = useState("");
  const [venueType, setVenueType] = useState("");
  const [website, setWebsite] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  if (!user) {
    router.push("/auth/login?redirect=/submit/venue");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    if (!name.trim()) {
      setError("Venue name is required");
      setSubmitting(false);
      return;
    }

    const data: VenueSubmissionData = {
      name: name.trim(),
      address: address.trim() || undefined,
      neighborhood: neighborhood || undefined,
      city: city.trim() || "Atlanta",
      state: state.trim() || "GA",
      zip: zip.trim() || undefined,
      venue_type: venueType || undefined,
      website: website.trim() || undefined,
    };

    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submission_type: "venue",
          data,
          image_urls: imageUrl ? [imageUrl] : undefined,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Failed to submit venue");
      }

      router.push("/dashboard/submissions?success=venue");
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
            Add a Venue
          </h1>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500 text-red-400 font-mono text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
              Venue Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="What's this place called?"
              required
              maxLength={200}
              className="w-full px-4 py-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)] transition-colors"
            />
          </div>

          <div>
            <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
              Address
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Main St"
              className="w-full px-4 py-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)] transition-colors"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                {NEIGHBORHOODS.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
                Venue Type
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

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-1">
              <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
                City
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm focus:outline-none focus:border-[var(--coral)] transition-colors"
              />
            </div>
            <div>
              <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
                State
              </label>
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                maxLength={2}
                className="w-full px-4 py-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm focus:outline-none focus:border-[var(--coral)] transition-colors"
              />
            </div>
            <div>
              <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
                ZIP
              </label>
              <input
                type="text"
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                maxLength={10}
                className="w-full px-4 py-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm focus:outline-none focus:border-[var(--coral)] transition-colors"
              />
            </div>
          </div>

          <div>
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

          <div>
            <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
              Venue Image
            </label>
            <ImageUploader value={imageUrl} onChange={setImageUrl} />
          </div>

          <div className="flex gap-3 pt-4">
            <Link
              href="/submit"
              className="px-4 py-2.5 rounded-lg font-mono text-sm text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 sm:flex-none px-6 py-2.5 rounded-lg bg-[var(--coral)] text-[var(--void)] font-mono text-sm font-medium hover:bg-[var(--rose)] transition-colors disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit Venue"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
