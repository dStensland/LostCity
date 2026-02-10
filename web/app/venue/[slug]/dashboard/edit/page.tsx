"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function VenueEditPage({
  params,
}: {
  params: { slug: string };
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [venue, setVenue] = useState<{
    name: string;
    slug: string;
    claimed_by: string | null;
  } | null>(null);

  const [formData, setFormData] = useState({
    description: "",
    website: "",
    hours: "",
    image_url: "",
    accessibility_notes: "",
    phone: "",
    menu_url: "",
    reservation_url: "",
    vibes: [] as string[],
  });

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

        setVenue({
          name: venueData.name,
          slug: venueData.slug,
          claimed_by: venueData.claimed_by,
        });

        // Populate form with existing data
        setFormData({
          description: venueData.description || "",
          website: venueData.website || "",
          hours: venueData.hours_display || "",
          image_url: venueData.image_url || "",
          accessibility_notes: venueData.accessibility_notes || "",
          phone: venueData.phone || "",
          menu_url: venueData.menu_url || "",
          reservation_url: venueData.reservation_url || "",
          vibes: venueData.vibes || [],
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
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/venues/by-slug/${params.slug}/edit`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update venue");
      }

      router.push(`/venue/${params.slug}/dashboard`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSaving(false);
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
              <h1 className="text-2xl font-bold mb-1">Edit Venue Details</h1>
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
              className="px-4 py-2 rounded bg-[var(--coral)] text-[var(--void)] font-medium"
            >
              Edit Details
            </Link>
            <Link
              href={`/venue/${params.slug}/dashboard/submit-event`}
              className="px-4 py-2 rounded text-[var(--cream)] hover:bg-[var(--void)] border border-transparent hover:border-[var(--border)] transition-colors"
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
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded">
              {error}
            </div>
          )}

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
              placeholder="Tell people about your venue..."
            />
            <p className="text-xs text-[var(--muted)] mt-1">
              {formData.description.length} / 5000 characters
            </p>
          </div>

          {/* Website */}
          <div>
            <label htmlFor="website" className="block text-sm font-medium mb-2">
              Website
            </label>
            <input
              id="website"
              type="url"
              value={formData.website}
              onChange={(e) =>
                setFormData({ ...formData, website: e.target.value })
              }
              className="w-full bg-[var(--void-light)] border border-[var(--border)] rounded px-4 py-2 text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
              placeholder="https://yourwebsite.com"
            />
          </div>

          {/* Hours */}
          <div>
            <label htmlFor="hours" className="block text-sm font-medium mb-2">
              Hours
            </label>
            <textarea
              id="hours"
              value={formData.hours}
              onChange={(e) =>
                setFormData({ ...formData, hours: e.target.value })
              }
              rows={3}
              className="w-full bg-[var(--void-light)] border border-[var(--border)] rounded px-4 py-2 text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
              placeholder="Mon-Fri: 5pm-2am, Sat-Sun: 12pm-3am"
            />
          </div>

          {/* Image URL */}
          <div>
            <label htmlFor="image_url" className="block text-sm font-medium mb-2">
              Image URL
            </label>
            <input
              id="image_url"
              type="url"
              value={formData.image_url}
              onChange={(e) =>
                setFormData({ ...formData, image_url: e.target.value })
              }
              className="w-full bg-[var(--void-light)] border border-[var(--border)] rounded px-4 py-2 text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
              placeholder="https://example.com/image.jpg"
            />
          </div>

          {/* Phone */}
          <div>
            <label htmlFor="phone" className="block text-sm font-medium mb-2">
              Phone
            </label>
            <input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) =>
                setFormData({ ...formData, phone: e.target.value })
              }
              className="w-full bg-[var(--void-light)] border border-[var(--border)] rounded px-4 py-2 text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
              placeholder="(404) 555-0123"
            />
          </div>

          {/* Menu URL */}
          <div>
            <label htmlFor="menu_url" className="block text-sm font-medium mb-2">
              Menu URL
            </label>
            <input
              id="menu_url"
              type="url"
              value={formData.menu_url}
              onChange={(e) =>
                setFormData({ ...formData, menu_url: e.target.value })
              }
              className="w-full bg-[var(--void-light)] border border-[var(--border)] rounded px-4 py-2 text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
              placeholder="https://yourwebsite.com/menu"
            />
          </div>

          {/* Reservation URL */}
          <div>
            <label htmlFor="reservation_url" className="block text-sm font-medium mb-2">
              Reservation URL
            </label>
            <input
              id="reservation_url"
              type="url"
              value={formData.reservation_url}
              onChange={(e) =>
                setFormData({ ...formData, reservation_url: e.target.value })
              }
              className="w-full bg-[var(--void-light)] border border-[var(--border)] rounded px-4 py-2 text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
              placeholder="https://resy.com/yourrestaurant"
            />
          </div>

          {/* Accessibility Notes */}
          <div>
            <label
              htmlFor="accessibility_notes"
              className="block text-sm font-medium mb-2"
            >
              Accessibility Notes
            </label>
            <textarea
              id="accessibility_notes"
              value={formData.accessibility_notes}
              onChange={(e) =>
                setFormData({ ...formData, accessibility_notes: e.target.value })
              }
              rows={3}
              className="w-full bg-[var(--void-light)] border border-[var(--border)] rounded px-4 py-2 text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
              placeholder="Wheelchair accessible, elevator available, etc."
            />
          </div>

          {/* Submit Button */}
          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 bg-[var(--coral)] text-[var(--void)] font-medium rounded hover:bg-[var(--coral)]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? "Saving..." : "Save Changes"}
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
