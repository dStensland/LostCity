"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const PLANNING_SERVICE_STYLE_OPTIONS = [
  { value: "", label: "Unknown" },
  { value: "quick_service", label: "Quick service" },
  { value: "casual_dine_in", label: "Casual dine-in" },
  { value: "full_service", label: "Full service" },
  { value: "tasting_menu", label: "Tasting menu" },
  { value: "bar_food", label: "Bar food" },
  { value: "coffee_dessert", label: "Coffee / dessert" },
] as const;

type TriStateBoolean = "unknown" | "yes" | "no";

function toTriStateBoolean(value: boolean | null | undefined): TriStateBoolean {
  if (value === true) return "yes";
  if (value === false) return "no";
  return "unknown";
}

function fromTriStateBoolean(value: TriStateBoolean): boolean | null {
  if (value === "yes") return true;
  if (value === "no") return false;
  return null;
}

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
    service_style: "",
    meal_duration_min_minutes: "",
    meal_duration_max_minutes: "",
    walk_in_wait_minutes: "",
    payment_buffer_minutes: "",
    accepts_reservations: "unknown" as TriStateBoolean,
    reservation_recommended: "unknown" as TriStateBoolean,
    planning_notes: "",
    vibes: [] as string[],
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
          service_style: venueData.service_style || "",
          meal_duration_min_minutes:
            venueData.meal_duration_min_minutes != null
              ? String(venueData.meal_duration_min_minutes)
              : "",
          meal_duration_max_minutes:
            venueData.meal_duration_max_minutes != null
              ? String(venueData.meal_duration_max_minutes)
              : "",
          walk_in_wait_minutes:
            venueData.walk_in_wait_minutes != null
              ? String(venueData.walk_in_wait_minutes)
              : "",
          payment_buffer_minutes:
            venueData.payment_buffer_minutes != null
              ? String(venueData.payment_buffer_minutes)
              : "",
          accepts_reservations: toTriStateBoolean(venueData.accepts_reservations),
          reservation_recommended: toTriStateBoolean(
            venueData.reservation_recommended
          ),
          planning_notes: venueData.planning_notes || "",
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
      const payload = {
        ...formData,
        service_style: formData.service_style || null,
        meal_duration_min_minutes: formData.meal_duration_min_minutes
          ? Number(formData.meal_duration_min_minutes)
          : null,
        meal_duration_max_minutes: formData.meal_duration_max_minutes
          ? Number(formData.meal_duration_max_minutes)
          : null,
        walk_in_wait_minutes: formData.walk_in_wait_minutes
          ? Number(formData.walk_in_wait_minutes)
          : null,
        payment_buffer_minutes: formData.payment_buffer_minutes
          ? Number(formData.payment_buffer_minutes)
          : null,
        accepts_reservations: fromTriStateBoolean(formData.accepts_reservations),
        reservation_recommended: fromTriStateBoolean(
          formData.reservation_recommended
        ),
        planning_notes: formData.planning_notes || null,
      };

      const response = await fetch(`/api/venues/by-slug/${params.slug}/edit`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
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

          {/* Planning Metadata */}
          <div className="rounded border border-[var(--border)] bg-[var(--void-light)]/50 p-4 space-y-4">
            <div>
              <h2 className="text-sm font-semibold">Planning Metadata</h2>
              <p className="text-xs text-[var(--muted)] mt-1">
                Help us estimate on-time dining windows before nearby shows.
              </p>
            </div>

            <div>
              <label htmlFor="service_style" className="block text-sm font-medium mb-2">
                Service Style
              </label>
              <select
                id="service_style"
                value={formData.service_style}
                onChange={(e) =>
                  setFormData({ ...formData, service_style: e.target.value })
                }
                className="w-full bg-[var(--void-light)] border border-[var(--border)] rounded px-4 py-2 text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
              >
                {PLANNING_SERVICE_STYLE_OPTIONS.map((option) => (
                  <option key={option.value || "unknown"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="meal_duration_min_minutes" className="block text-sm font-medium mb-2">
                  Meal Duration Min (minutes)
                </label>
                <input
                  id="meal_duration_min_minutes"
                  type="number"
                  min={15}
                  max={360}
                  value={formData.meal_duration_min_minutes}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      meal_duration_min_minutes: e.target.value,
                    })
                  }
                  className="w-full bg-[var(--void-light)] border border-[var(--border)] rounded px-4 py-2 text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
                  placeholder="60"
                />
              </div>
              <div>
                <label htmlFor="meal_duration_max_minutes" className="block text-sm font-medium mb-2">
                  Meal Duration Max (minutes)
                </label>
                <input
                  id="meal_duration_max_minutes"
                  type="number"
                  min={15}
                  max={480}
                  value={formData.meal_duration_max_minutes}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      meal_duration_max_minutes: e.target.value,
                    })
                  }
                  className="w-full bg-[var(--void-light)] border border-[var(--border)] rounded px-4 py-2 text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
                  placeholder="90"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="walk_in_wait_minutes" className="block text-sm font-medium mb-2">
                  Walk-in Wait (minutes)
                </label>
                <input
                  id="walk_in_wait_minutes"
                  type="number"
                  min={0}
                  max={240}
                  value={formData.walk_in_wait_minutes}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      walk_in_wait_minutes: e.target.value,
                    })
                  }
                  className="w-full bg-[var(--void-light)] border border-[var(--border)] rounded px-4 py-2 text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
                  placeholder="15"
                />
              </div>
              <div>
                <label htmlFor="payment_buffer_minutes" className="block text-sm font-medium mb-2">
                  Payment Buffer (minutes)
                </label>
                <input
                  id="payment_buffer_minutes"
                  type="number"
                  min={0}
                  max={60}
                  value={formData.payment_buffer_minutes}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      payment_buffer_minutes: e.target.value,
                    })
                  }
                  className="w-full bg-[var(--void-light)] border border-[var(--border)] rounded px-4 py-2 text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
                  placeholder="10"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="accepts_reservations" className="block text-sm font-medium mb-2">
                  Accepts Reservations
                </label>
                <select
                  id="accepts_reservations"
                  value={formData.accepts_reservations}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      accepts_reservations: e.target.value as TriStateBoolean,
                    })
                  }
                  className="w-full bg-[var(--void-light)] border border-[var(--border)] rounded px-4 py-2 text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
                >
                  <option value="unknown">Unknown</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
              <div>
                <label htmlFor="reservation_recommended" className="block text-sm font-medium mb-2">
                  Reservation Recommended
                </label>
                <select
                  id="reservation_recommended"
                  value={formData.reservation_recommended}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      reservation_recommended: e.target.value as TriStateBoolean,
                    })
                  }
                  className="w-full bg-[var(--void-light)] border border-[var(--border)] rounded px-4 py-2 text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
                >
                  <option value="unknown">Unknown</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="planning_notes" className="block text-sm font-medium mb-2">
                Planning Notes
              </label>
              <textarea
                id="planning_notes"
                value={formData.planning_notes}
                onChange={(e) =>
                  setFormData({ ...formData, planning_notes: e.target.value })
                }
                rows={3}
                className="w-full bg-[var(--void-light)] border border-[var(--border)] rounded px-4 py-2 text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
                placeholder="e.g. Kitchen can slow down after 7:30 PM on weekends."
              />
              <p className="text-xs text-[var(--muted)] mt-1">
                {formData.planning_notes.length} / 1000 characters
              </p>
            </div>
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
