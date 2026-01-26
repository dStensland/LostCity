"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import UnifiedHeader from "@/components/UnifiedHeader";
import VenueAutocomplete from "@/components/VenueAutocomplete";
import ProducerAutocomplete from "@/components/ProducerAutocomplete";
import ImageUploader from "@/components/ImageUploader";
import { useAuth } from "@/lib/auth-context";
import type { EventSubmissionData, VenueSubmissionData, ProducerSubmissionData } from "@/lib/types";

const CATEGORIES = [
  { id: "music", label: "Music" },
  { id: "art", label: "Art & Gallery" },
  { id: "comedy", label: "Comedy" },
  { id: "theater", label: "Theater" },
  { id: "film", label: "Film" },
  { id: "food_drink", label: "Food & Drink" },
  { id: "nightlife", label: "Nightlife" },
  { id: "community", label: "Community" },
  { id: "fitness", label: "Fitness & Sports" },
  { id: "family", label: "Family" },
  { id: "learning", label: "Learning & Workshops" },
  { id: "other", label: "Other" },
];

export default function SubmitEventPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<{
    id: number;
    type: string;
  } | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [isAllDay, setIsAllDay] = useState(false);
  const [category, setCategory] = useState("");
  const [isFree, setIsFree] = useState(false);
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [priceNote, setPriceNote] = useState("");
  const [ticketUrl, setTicketUrl] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  // Venue state
  const [venue, setVenue] = useState<{ id: number; name: string } | null>(null);
  const [showNewVenue, setShowNewVenue] = useState(false);
  const [newVenue, setNewVenue] = useState<VenueSubmissionData>({
    name: "",
    address: "",
    neighborhood: "",
  });

  // Producer state
  const [producer, setProducer] = useState<{ id: string; name: string } | null>(null);
  const [showNewProducer, setShowNewProducer] = useState(false);
  const [newProducer, setNewProducer] = useState<ProducerSubmissionData>({
    name: "",
    website: "",
  });

  if (!user) {
    router.push("/auth/login?redirect=/submit/event");
    return null;
  }

  const handleSubmit = async (acknowledgesDuplicate = false) => {
    setError(null);
    setDuplicateWarning(null);
    setSubmitting(true);

    // Validate required fields
    if (!title.trim()) {
      setError("Event title is required");
      setSubmitting(false);
      return;
    }

    if (!startDate) {
      setError("Start date is required");
      setSubmitting(false);
      return;
    }

    if (!venue && !newVenue.name) {
      setError("Please select or add a venue");
      setSubmitting(false);
      return;
    }

    // Build submission data
    const data: EventSubmissionData = {
      title: title.trim(),
      description: description.trim() || undefined,
      start_date: startDate,
      start_time: startTime || undefined,
      end_date: endDate || undefined,
      end_time: endTime || undefined,
      is_all_day: isAllDay,
      category: category || undefined,
      is_free: isFree,
      price_min: priceMin ? parseFloat(priceMin) : undefined,
      price_max: priceMax ? parseFloat(priceMax) : undefined,
      price_note: priceNote.trim() || undefined,
      ticket_url: ticketUrl.trim() || undefined,
      source_url: sourceUrl.trim() || undefined,
      image_url: imageUrl || undefined,
    };

    // Add venue
    if (venue) {
      data.venue_id = venue.id;
    } else if (newVenue.name) {
      data.venue = newVenue;
    }

    // Add producer
    if (producer) {
      data.producer_id = producer.id;
    } else if (newProducer.name) {
      data.producer = newProducer;
    }

    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submission_type: "event",
          data,
          duplicate_acknowledged: acknowledgesDuplicate,
          image_urls: imageUrl ? [imageUrl] : undefined,
        }),
      });

      const result = await res.json();

      if (res.status === 409 && result.warning) {
        // Duplicate detected
        setDuplicateWarning(result.duplicate);
        setSubmitting(false);
        return;
      }

      if (!res.ok) {
        throw new Error(result.error || "Failed to submit event");
      }

      // Success - redirect to dashboard
      router.push("/dashboard/submissions?success=event");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit event");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen">
      <UnifiedHeader />

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
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
            Submit an Event
          </h1>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500 text-red-400 font-mono text-sm">
            {error}
          </div>
        )}

        {/* Duplicate Warning */}
        {duplicateWarning && (
          <div className="mb-6 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500">
            <p className="text-yellow-400 font-mono text-sm mb-3">
              This event may already exist. Do you want to submit it anyway?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleSubmit(true)}
                className="px-4 py-2 rounded-lg bg-yellow-500 text-black font-mono text-sm hover:bg-yellow-400 transition-colors"
              >
                Submit Anyway
              </button>
              <button
                onClick={() => setDuplicateWarning(null)}
                className="px-4 py-2 rounded-lg border border-yellow-500 text-yellow-400 font-mono text-sm hover:bg-yellow-500/10 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-6">
          {/* Title */}
          <div>
            <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
              Event Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What's the event called?"
              required
              maxLength={200}
              className="w-full px-4 py-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)] transition-colors"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell us about this event..."
              rows={4}
              maxLength={2000}
              className="w-full px-4 py-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)] transition-colors resize-none"
            />
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
                Start Date *
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                min={new Date().toISOString().split("T")[0]}
                className="w-full px-4 py-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm focus:outline-none focus:border-[var(--coral)] transition-colors"
              />
            </div>
            <div>
              <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
                Start Time
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                disabled={isAllDay}
                className="w-full px-4 py-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm focus:outline-none focus:border-[var(--coral)] transition-colors disabled:opacity-50"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate || new Date().toISOString().split("T")[0]}
                className="w-full px-4 py-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm focus:outline-none focus:border-[var(--coral)] transition-colors"
              />
            </div>
            <div>
              <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
                End Time
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                disabled={isAllDay}
                className="w-full px-4 py-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm focus:outline-none focus:border-[var(--coral)] transition-colors disabled:opacity-50"
              />
            </div>
          </div>

          {/* All Day Toggle */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isAllDay"
              checked={isAllDay}
              onChange={(e) => setIsAllDay(e.target.checked)}
              className="w-4 h-4 rounded border-[var(--twilight)] bg-[var(--dusk)] text-[var(--coral)] focus:ring-[var(--coral)]"
            />
            <label htmlFor="isAllDay" className="font-mono text-sm text-[var(--cream)]">
              All-day event
            </label>
          </div>

          {/* Venue */}
          <div>
            <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
              Venue *
            </label>
            {!showNewVenue ? (
              <VenueAutocomplete
                value={venue}
                onChange={setVenue}
                onCreateNew={(name) => {
                  setNewVenue({ ...newVenue, name });
                  setShowNewVenue(true);
                  setVenue(null);
                }}
                required
              />
            ) : (
              <div className="space-y-3 p-4 rounded-lg border border-[var(--twilight)] bg-[var(--void)]/30">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-[var(--coral)] uppercase">New Venue</span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewVenue(false);
                      setNewVenue({ name: "", address: "", neighborhood: "" });
                    }}
                    className="text-[var(--muted)] hover:text-[var(--cream)] text-sm"
                  >
                    Cancel
                  </button>
                </div>
                <input
                  type="text"
                  value={newVenue.name}
                  onChange={(e) => setNewVenue({ ...newVenue, name: e.target.value })}
                  placeholder="Venue name *"
                  required
                  className="w-full px-4 py-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)] transition-colors"
                />
                <input
                  type="text"
                  value={newVenue.address || ""}
                  onChange={(e) => setNewVenue({ ...newVenue, address: e.target.value })}
                  placeholder="Address"
                  className="w-full px-4 py-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)] transition-colors"
                />
                <input
                  type="text"
                  value={newVenue.neighborhood || ""}
                  onChange={(e) => setNewVenue({ ...newVenue, neighborhood: e.target.value })}
                  placeholder="Neighborhood (e.g., East Atlanta, Midtown)"
                  className="w-full px-4 py-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)] transition-colors"
                />
              </div>
            )}
          </div>

          {/* Category */}
          <div>
            <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm focus:outline-none focus:border-[var(--coral)] transition-colors"
            >
              <option value="">Select a category</option>
              {CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Pricing */}
          <div>
            <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
              Pricing
            </label>
            <div className="flex items-center gap-3 mb-3">
              <input
                type="checkbox"
                id="isFree"
                checked={isFree}
                onChange={(e) => setIsFree(e.target.checked)}
                className="w-4 h-4 rounded border-[var(--twilight)] bg-[var(--dusk)] text-[var(--coral)] focus:ring-[var(--coral)]"
              />
              <label htmlFor="isFree" className="font-mono text-sm text-[var(--cream)]">
                Free event
              </label>
            </div>
            {!isFree && (
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="number"
                  value={priceMin}
                  onChange={(e) => setPriceMin(e.target.value)}
                  placeholder="Min price"
                  min="0"
                  step="0.01"
                  className="w-full px-4 py-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)] transition-colors"
                />
                <input
                  type="number"
                  value={priceMax}
                  onChange={(e) => setPriceMax(e.target.value)}
                  placeholder="Max price"
                  min="0"
                  step="0.01"
                  className="w-full px-4 py-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)] transition-colors"
                />
              </div>
            )}
            <input
              type="text"
              value={priceNote}
              onChange={(e) => setPriceNote(e.target.value)}
              placeholder="Price note (e.g., 'Donation suggested')"
              className="w-full mt-3 px-4 py-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)] transition-colors"
            />
          </div>

          {/* Organizer (optional) */}
          <div>
            <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
              Organizer / Producer (optional)
            </label>
            {!showNewProducer ? (
              <ProducerAutocomplete
                value={producer}
                onChange={setProducer}
                onCreateNew={(name) => {
                  setNewProducer({ ...newProducer, name });
                  setShowNewProducer(true);
                  setProducer(null);
                }}
              />
            ) : (
              <div className="space-y-3 p-4 rounded-lg border border-[var(--twilight)] bg-[var(--void)]/30">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-[var(--coral)] uppercase">New Organization</span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewProducer(false);
                      setNewProducer({ name: "", website: "" });
                    }}
                    className="text-[var(--muted)] hover:text-[var(--cream)] text-sm"
                  >
                    Cancel
                  </button>
                </div>
                <input
                  type="text"
                  value={newProducer.name}
                  onChange={(e) => setNewProducer({ ...newProducer, name: e.target.value })}
                  placeholder="Organization name"
                  className="w-full px-4 py-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)] transition-colors"
                />
                <input
                  type="url"
                  value={newProducer.website || ""}
                  onChange={(e) => setNewProducer({ ...newProducer, website: e.target.value })}
                  placeholder="Website (optional)"
                  className="w-full px-4 py-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)] transition-colors"
                />
              </div>
            )}
          </div>

          {/* Links */}
          <div className="space-y-3">
            <div>
              <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
                Ticket Link
              </label>
              <input
                type="url"
                value={ticketUrl}
                onChange={(e) => setTicketUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-4 py-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)] transition-colors"
              />
            </div>
            <div>
              <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
                Event Website / More Info
              </label>
              <input
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-4 py-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)] transition-colors"
              />
            </div>
          </div>

          {/* Image */}
          <div>
            <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
              Event Image
            </label>
            <ImageUploader
              value={imageUrl}
              onChange={setImageUrl}
            />
          </div>

          {/* Submit */}
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
              {submitting ? "Submitting..." : "Submit Event"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
