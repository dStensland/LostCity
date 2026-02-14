"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const CATEGORIES = [
  { value: "music", label: "Music" },
  { value: "nightlife", label: "Nightlife" },
  { value: "food-drink", label: "Food & Drink" },
  { value: "arts", label: "Arts" },
  { value: "sports", label: "Sports" },
  { value: "community", label: "Community" },
  { value: "film", label: "Film" },
  { value: "theater", label: "Theater" },
  { value: "comedy", label: "Comedy" },
  { value: "markets", label: "Markets" },
  { value: "kids-family", label: "Kids & Family" },
  { value: "wellness", label: "Wellness" },
  { value: "learning", label: "Learning" },
  { value: "outdoor", label: "Outdoor" },
  { value: "tours", label: "Tours" },
];

export default function SubmitEventPage({
  params,
}: {
  params: { slug: string };
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [venue, setVenue] = useState<{
    name: string;
    slug: string;
  } | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    start_date: "",
    start_time: "",
    end_date: "",
    end_time: "",
    description: "",
    category: "",
    genre: "",
    ticket_url: "",
    image_url: "",
    is_free: false,
    price_min: "",
    price_max: "",
    price_note: "",
  });

  useEffect(() => {
    const fetchVenue = async () => {
      try {
        const response = await fetch(`/api/venues/by-slug/${params.slug}/edit`);
        if (!response.ok) {
          throw new Error("Failed to fetch venue");
        }

        const data = await response.json();
        const venueData = data.venue;

        if (!venueData) {
          setError("Venue not found");
          return;
        }

        setVenue({
          name: venueData.name,
          slug: venueData.slug,
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

    try {
      const payload = {
        ...formData,
        price_min: formData.price_min ? parseFloat(formData.price_min) : undefined,
        price_max: formData.price_max ? parseFloat(formData.price_max) : undefined,
        // Remove empty strings
        start_time: formData.start_time || undefined,
        end_date: formData.end_date || undefined,
        end_time: formData.end_time || undefined,
        description: formData.description || undefined,
        genre: formData.genre || undefined,
        ticket_url: formData.ticket_url || undefined,
        image_url: formData.image_url || undefined,
        price_note: formData.price_note || undefined,
      };

      const response = await fetch(`/api/venues/by-slug/${params.slug}/submit-event`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to submit event");
      }

      setSuccess(true);
      // Reset form
      setFormData({
        title: "",
        start_date: "",
        start_time: "",
        end_date: "",
        end_time: "",
        description: "",
        category: "",
        genre: "",
        ticket_url: "",
        image_url: "",
        is_free: false,
        price_min: "",
        price_max: "",
        price_note: "",
      });

      // Redirect after 2 seconds
      setTimeout(() => {
        router.push(`/venue/${params.slug}/dashboard`);
      }, 2000);
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
          <p className="text-[var(--muted)]">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--void)] text-[var(--cream)]">
      {/* Header */}
      <div className="border-b border-[var(--border)] bg-[var(--void-light)]">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold mb-1">Submit Event</h1>
              <p className="text-[var(--muted)] text-sm">{venue?.name}</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex gap-1">
            <Link
              href={`/venue/${params.slug}/dashboard`}
              className="px-4 py-2 rounded text-[var(--cream)] hover:bg-[var(--void)] border border-transparent hover:border-[var(--border)] transition-colors"
            >
              Overview
            </Link>
            <Link
              href={`/venue/${params.slug}/dashboard/edit`}
              className="px-4 py-2 rounded text-[var(--cream)] hover:bg-[var(--void)] border border-transparent hover:border-[var(--border)] transition-colors"
            >
              Edit Details
            </Link>
            <Link
              href={`/venue/${params.slug}/dashboard/submit-event`}
              className="px-4 py-2 rounded bg-[var(--coral)] text-[var(--void)] font-medium"
            >
              Submit Event
            </Link>
            <Link
              href={`/venue/${params.slug}/dashboard/analytics`}
              className="px-4 py-2 rounded text-[var(--cream)] hover:bg-[var(--void)] border border-transparent hover:border-[var(--border)] transition-colors"
            >
              Analytics
            </Link>
          </nav>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-3xl mx-auto px-4 py-8">
        {success && (
          <div className="mb-6 bg-[var(--neon-green)]/10 border border-[var(--neon-green)]/20 text-[var(--neon-green)] p-4 rounded">
            Event submitted successfully! Redirecting to dashboard...
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded">
              {error}
            </div>
          )}

          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium mb-2">
              Event Title <span className="text-red-400">*</span>
            </label>
            <input
              id="title"
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full bg-[var(--void-light)] border border-[var(--border)] rounded px-4 py-2 text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
              placeholder="Live Jazz Night"
            />
          </div>

          {/* Category */}
          <div>
            <label htmlFor="category" className="block text-sm font-medium mb-2">
              Category <span className="text-red-400">*</span>
            </label>
            <select
              id="category"
              required
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full bg-[var(--void-light)] border border-[var(--border)] rounded px-4 py-2 text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
            >
              <option value="">Select a category</option>
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Date and Time Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="start_date" className="block text-sm font-medium mb-2">
                Start Date <span className="text-red-400">*</span>
              </label>
              <input
                id="start_date"
                type="date"
                required
                value={formData.start_date}
                onChange={(e) =>
                  setFormData({ ...formData, start_date: e.target.value })
                }
                className="w-full bg-[var(--void-light)] border border-[var(--border)] rounded px-4 py-2 text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
              />
            </div>

            <div>
              <label htmlFor="start_time" className="block text-sm font-medium mb-2">
                Start Time
              </label>
              <input
                id="start_time"
                type="time"
                value={formData.start_time}
                onChange={(e) =>
                  setFormData({ ...formData, start_time: e.target.value })
                }
                className="w-full bg-[var(--void-light)] border border-[var(--border)] rounded px-4 py-2 text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
              />
            </div>

            <div>
              <label htmlFor="end_date" className="block text-sm font-medium mb-2">
                End Date
              </label>
              <input
                id="end_date"
                type="date"
                value={formData.end_date}
                onChange={(e) =>
                  setFormData({ ...formData, end_date: e.target.value })
                }
                className="w-full bg-[var(--void-light)] border border-[var(--border)] rounded px-4 py-2 text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
              />
            </div>

            <div>
              <label htmlFor="end_time" className="block text-sm font-medium mb-2">
                End Time
              </label>
              <input
                id="end_time"
                type="time"
                value={formData.end_time}
                onChange={(e) =>
                  setFormData({ ...formData, end_time: e.target.value })
                }
                className="w-full bg-[var(--void-light)] border border-[var(--border)] rounded px-4 py-2 text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium mb-2">
              Description
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              rows={6}
              className="w-full bg-[var(--void-light)] border border-[var(--border)] rounded px-4 py-2 text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
              placeholder="Describe your event..."
            />
          </div>

          {/* Genre */}
          <div>
            <label htmlFor="genre" className="block text-sm font-medium mb-2">
              Genre / Subcategory
            </label>
            <input
              id="genre"
              type="text"
              value={formData.genre}
              onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
              className="w-full bg-[var(--void-light)] border border-[var(--border)] rounded px-4 py-2 text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
              placeholder="Jazz, Rock, etc."
            />
          </div>

          {/* Pricing */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                id="is_free"
                type="checkbox"
                checked={formData.is_free}
                onChange={(e) =>
                  setFormData({ ...formData, is_free: e.target.checked })
                }
                className="w-4 h-4"
              />
              <label htmlFor="is_free" className="text-sm font-medium">
                This event is free
              </label>
            </div>

            {!formData.is_free && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="price_min" className="block text-sm font-medium mb-2">
                    Min Price ($)
                  </label>
                  <input
                    id="price_min"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price_min}
                    onChange={(e) =>
                      setFormData({ ...formData, price_min: e.target.value })
                    }
                    className="w-full bg-[var(--void-light)] border border-[var(--border)] rounded px-4 py-2 text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
                    placeholder="10.00"
                  />
                </div>

                <div>
                  <label htmlFor="price_max" className="block text-sm font-medium mb-2">
                    Max Price ($)
                  </label>
                  <input
                    id="price_max"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price_max}
                    onChange={(e) =>
                      setFormData({ ...formData, price_max: e.target.value })
                    }
                    className="w-full bg-[var(--void-light)] border border-[var(--border)] rounded px-4 py-2 text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
                    placeholder="25.00"
                  />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="price_note" className="block text-sm font-medium mb-2">
                Price Note
              </label>
              <input
                id="price_note"
                type="text"
                value={formData.price_note}
                onChange={(e) =>
                  setFormData({ ...formData, price_note: e.target.value })
                }
                className="w-full bg-[var(--void-light)] border border-[var(--border)] rounded px-4 py-2 text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
                placeholder="$10 cover, 2-drink minimum"
              />
            </div>
          </div>

          {/* Ticket URL */}
          <div>
            <label htmlFor="ticket_url" className="block text-sm font-medium mb-2">
              Ticket URL
            </label>
            <input
              id="ticket_url"
              type="url"
              value={formData.ticket_url}
              onChange={(e) =>
                setFormData({ ...formData, ticket_url: e.target.value })
              }
              className="w-full bg-[var(--void-light)] border border-[var(--border)] rounded px-4 py-2 text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
              placeholder="https://eventbrite.com/..."
            />
          </div>

          {/* Image URL */}
          <div>
            <label htmlFor="image_url" className="block text-sm font-medium mb-2">
              Event Image URL
            </label>
            <input
              id="image_url"
              type="url"
              value={formData.image_url}
              onChange={(e) =>
                setFormData({ ...formData, image_url: e.target.value })
              }
              className="w-full bg-[var(--void-light)] border border-[var(--border)] rounded px-4 py-2 text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
              placeholder="https://example.com/poster.jpg"
            />
          </div>

          {/* Submit Button */}
          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled={submitting || success}
              className="px-6 py-3 bg-[var(--coral)] text-[var(--void)] font-medium rounded hover:bg-[var(--coral)]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? "Submitting..." : "Submit Event"}
            </button>
            <Link
              href={`/venue/${params.slug}/dashboard`}
              className="px-6 py-3 border border-[var(--border)] rounded hover:bg-[var(--void-light)] transition-colors inline-block text-center"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
