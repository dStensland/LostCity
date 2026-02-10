"use client";

import { useState } from "react";
import { PREFERENCE_CATEGORIES } from "@/lib/preferences";
import { PREFERENCE_NEIGHBORHOOD_NAMES } from "@/config/neighborhoods";

type PortalDraft = {
  id?: string;
  city?: string;
  neighborhoods: string[];
  categories: string[];
  geo_center?: { lat: number; lng: number };
  geo_radius?: number;
};

type Props = {
  draft: PortalDraft;
  updateDraft: (updates: Partial<PortalDraft>) => void;
  onNext: () => void;
  onBack: () => void;
};

const CITIES = [
  { value: "Atlanta", label: "Atlanta, GA", lat: 33.749, lng: -84.388 },
  { value: "Nashville", label: "Nashville, TN", lat: 36.1627, lng: -86.7816 },
  { value: "Denver", label: "Denver, CO", lat: 39.7392, lng: -104.9903 },
];

export function AudienceStep({ draft, updateDraft, onNext, onBack }: Props) {
  const [city, setCity] = useState(draft.city || "");
  const [neighborhoods, setNeighborhoods] = useState<string[]>(draft.neighborhoods || []);
  const [categories, setCategories] = useState<string[]>(draft.categories || []);
  const [radius, setRadius] = useState(draft.geo_radius || 10);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCityChange = (cityName: string) => {
    setCity(cityName);
    const selectedCity = CITIES.find((c) => c.value === cityName);
    if (selectedCity) {
      updateDraft({
        city: cityName,
        geo_center: { lat: selectedCity.lat, lng: selectedCity.lng },
      });
    }
  };

  const toggleNeighborhood = (neighborhood: string) => {
    setNeighborhoods((prev) =>
      prev.includes(neighborhood)
        ? prev.filter((n) => n !== neighborhood)
        : [...prev, neighborhood]
    );
  };

  const toggleCategory = (category: string) => {
    setCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    );
  };

  const handleNext = async () => {
    if (!draft.id) {
      setError("Portal ID missing");
      return;
    }

    setUpdating(true);
    setError(null);

    try {
      // Build filters object
      const filters: Record<string, unknown> = {};
      if (city) filters.city = city;
      if (neighborhoods.length > 0) filters.neighborhoods = neighborhoods;
      if (categories.length > 0) filters.categories = categories;
      if (draft.geo_center) {
        filters.geo_center = draft.geo_center;
        filters.geo_radius_km = radius;
      }

      // Update portal
      const res = await fetch(`/api/admin/portals/${draft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filters }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update portal");
      }

      updateDraft({
        city,
        neighborhoods,
        categories,
        geo_radius: radius,
      });

      onNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update portal");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-[var(--cream)] mb-2">Audience & Location</h2>
        <p className="font-mono text-sm text-[var(--muted)]">
          Define your geographic area and content focus
        </p>
      </div>

      <div className="space-y-6">
        {/* City */}
        <div>
          <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-2">
            City
          </label>
          <select
            value={city}
            onChange={(e) => handleCityChange(e.target.value)}
            className="w-full px-4 py-3 bg-[var(--night)] border border-[var(--twilight)] rounded-lg font-sans text-[var(--cream)] focus:outline-none focus:border-[var(--coral)] transition-colors"
          >
            <option value="">Select a city...</option>
            {CITIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        {/* Radius */}
        {draft.geo_center && (
          <div>
            <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-2">
              Radius: {radius}km
            </label>
            <input
              type="range"
              min="1"
              max="50"
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between font-mono text-xs text-[var(--muted)] mt-1">
              <span>1km</span>
              <span>50km</span>
            </div>
          </div>
        )}

        {/* Neighborhoods */}
        {city === "Atlanta" && (
          <div>
            <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-2">
              Neighborhoods <span className="text-[var(--muted)]/60">(optional)</span>
            </label>
            <div className="max-h-48 overflow-y-auto border border-[var(--twilight)] rounded-lg p-3 bg-[var(--night)]">
              <div className="grid grid-cols-2 gap-2">
                {PREFERENCE_NEIGHBORHOOD_NAMES.map((neighborhood) => (
                  <label
                    key={neighborhood}
                    className="flex items-center gap-2 cursor-pointer hover:text-[var(--cream)] transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={neighborhoods.includes(neighborhood)}
                      onChange={() => toggleNeighborhood(neighborhood)}
                      className="w-4 h-4 rounded border-[var(--twilight)] bg-[var(--night)] text-[var(--coral)] focus:ring-[var(--coral)] focus:ring-offset-0"
                    />
                    <span className="font-mono text-xs text-[var(--soft)]">{neighborhood}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Categories */}
        <div>
          <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-2">
            Category Focus <span className="text-[var(--muted)]/60">(optional)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {PREFERENCE_CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                type="button"
                onClick={() => toggleCategory(cat.value)}
                className={`px-3 py-2 rounded-full font-mono text-xs transition-all ${
                  categories.includes(cat.value)
                    ? "bg-[var(--coral)] text-[var(--void)]"
                    : "bg-[var(--twilight)] text-[var(--soft)] hover:bg-[var(--twilight)]/60"
                }`}
              >
                {cat.emoji} {cat.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="font-mono text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between pt-4">
          <button
            onClick={onBack}
            className="px-6 py-3 border border-[var(--twilight)] text-[var(--soft)] font-mono text-sm font-medium rounded-lg hover:text-[var(--cream)] hover:border-[var(--twilight)]/60 transition-colors"
          >
            Back
          </button>
          <button
            onClick={handleNext}
            disabled={updating}
            className="px-6 py-3 bg-[var(--coral)] text-[var(--void)] font-mono text-sm font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {updating ? "Saving..." : "Next: Branding"}
          </button>
        </div>
      </div>
    </div>
  );
}
