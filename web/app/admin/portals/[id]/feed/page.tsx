"use client";

import Link from "next/link";
import { usePortalEdit } from "@/lib/admin/portal-edit-context";

const ALL_CATEGORIES = [
  { id: "music", label: "Music" },
  { id: "film", label: "Film" },
  { id: "comedy", label: "Comedy" },
  { id: "theater", label: "Theater" },
  { id: "art", label: "Art" },
  { id: "sports", label: "Sports" },
  { id: "food_drink", label: "Food & Drink" },
  { id: "nightlife", label: "Nightlife" },
  { id: "community", label: "Community" },
  { id: "fitness", label: "Fitness" },
  { id: "family", label: "Family" },
  { id: "learning", label: "Learning" },
  { id: "dance", label: "Dance" },
  { id: "tours", label: "Tours" },
  { id: "meetup", label: "Meetup" },
  { id: "words", label: "Words" },
  { id: "religious", label: "Religious" },
  { id: "markets", label: "Markets" },
  { id: "wellness", label: "Wellness" },
  { id: "gaming", label: "Gaming" },
  { id: "outdoors", label: "Outdoors" },
  { id: "other", label: "Other" },
];

export default function PortalFeedPage() {
  const {
    portal,
    loading,
    saving,
    error,
    success,
    setError,
    setSuccess,
    filters,
    setFilters,
    feedSettings,
    setFeedSettings,
    sections,
    handleSave,
  } = usePortalEdit();

  if (loading || !portal) return null;

  return (
    <div className="space-y-6">
      {/* Messages */}
      {error && (
        <div className="p-3 bg-red-400/10 border border-red-400/30 rounded flex items-center justify-between">
          <p className="text-red-400 font-mono text-sm">{error}</p>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300 ml-4">&times;</button>
        </div>
      )}
      {success && (
        <div className="p-3 bg-green-400/10 border border-green-400/30 rounded flex items-center justify-between">
          <p className="text-green-400 font-mono text-sm">{success}</p>
          <button onClick={() => setSuccess(null)} className="text-green-400 hover:text-green-300 ml-4">&times;</button>
        </div>
      )}

      {/* Filters */}
      <section className="bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg p-6">
        <h2 className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-4">Filters</h2>
        <p className="font-mono text-xs text-[var(--soft)] mb-4">
          Define what events appear in this portal. Events matching these criteria will be shown.
        </p>

        {/* Location */}
        <div className="mb-6">
          <h3 className="font-mono text-xs text-[var(--soft)] mb-3">Location</h3>
          <div className="space-y-4">
            <div>
              <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">City</label>
              <input
                type="text"
                value={filters.city || ""}
                onChange={(e) => setFilters({ ...filters, city: e.target.value || undefined })}
                placeholder="Atlanta"
                className="w-full px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Geo Lat</label>
                <input
                  type="number"
                  step="0.0001"
                  value={filters.geo_center?.[0] ?? ""}
                  onChange={(e) => {
                    const lat = e.target.value ? parseFloat(e.target.value) : undefined;
                    if (lat !== undefined) {
                      setFilters({ ...filters, geo_center: [lat, filters.geo_center?.[1] ?? -84.388] });
                    } else {
                      const { geo_center: _, ...rest } = filters;
                      void _;
                      setFilters(rest);
                    }
                  }}
                  placeholder="33.749"
                  className="w-full px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
                />
              </div>
              <div>
                <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Geo Lng</label>
                <input
                  type="number"
                  step="0.0001"
                  value={filters.geo_center?.[1] ?? ""}
                  onChange={(e) => {
                    const lng = e.target.value ? parseFloat(e.target.value) : undefined;
                    if (lng !== undefined) {
                      setFilters({ ...filters, geo_center: [filters.geo_center?.[0] ?? 33.749, lng] });
                    } else {
                      const { geo_center: _, ...rest } = filters;
                      void _;
                      setFilters(rest);
                    }
                  }}
                  placeholder="-84.388"
                  className="w-full px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
                />
              </div>
              <div>
                <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Radius (km)</label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  max="100"
                  value={filters.geo_radius_km ?? ""}
                  onChange={(e) => setFilters({ ...filters, geo_radius_km: e.target.value ? parseInt(e.target.value) : undefined })}
                  placeholder="25"
                  className="w-full px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
                />
              </div>
            </div>

            <div>
              <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Neighborhoods (comma-separated)</label>
              <input
                type="text"
                value={filters.neighborhoods?.join(", ") || ""}
                onChange={(e) => {
                  const hoods = e.target.value.split(",").map(h => h.trim()).filter(Boolean);
                  setFilters({ ...filters, neighborhoods: hoods.length ? hoods : undefined });
                }}
                placeholder="Midtown, East Atlanta, Little Five Points"
                className="w-full px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
              />
            </div>
          </div>
        </div>

        {/* Categories */}
        <div className="mb-6">
          <h3 className="font-mono text-xs text-[var(--soft)] mb-3">Categories</h3>
          <p className="font-mono text-xs text-[var(--muted)] mb-2">
            Select categories to include. Leave all unchecked to include all categories.
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {ALL_CATEGORIES.map(cat => {
              const isChecked = filters.categories?.includes(cat.id) || false;
              return (
                <label key={cat.id} className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => {
                      const current = filters.categories || [];
                      if (e.target.checked) {
                        setFilters({ ...filters, categories: [...current, cat.id] });
                      } else {
                        const updated = current.filter(c => c !== cat.id);
                        setFilters({ ...filters, categories: updated.length ? updated : undefined });
                      }
                    }}
                    className="w-4 h-4 rounded border-[var(--twilight)] bg-[var(--night)] text-[var(--coral)] focus:ring-[var(--coral)] focus:ring-offset-0"
                  />
                  <span className={`font-mono text-xs ${isChecked ? "text-[var(--cream)]" : "text-[var(--muted)] group-hover:text-[var(--soft)]"}`}>
                    {cat.label}
                  </span>
                </label>
              );
            })}
          </div>

          <div className="mt-4">
            <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Exclude Categories</label>
            <input
              type="text"
              value={filters.exclude_categories?.join(", ") || ""}
              onChange={(e) => {
                const cats = e.target.value.split(",").map(c => c.trim()).filter(Boolean);
                setFilters({ ...filters, exclude_categories: cats.length ? cats : undefined });
              }}
              placeholder="sports, fitness"
              className="w-full px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
            />
          </div>
        </div>

        {/* Date Range */}
        <div className="mb-6">
          <h3 className="font-mono text-xs text-[var(--soft)] mb-3">Date Range</h3>
          <p className="font-mono text-xs text-[var(--muted)] mb-2">
            Optional: Limit events to a specific date window.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Start Date</label>
              <input
                type="date"
                value={filters.date_range_start || ""}
                onChange={(e) => setFilters({ ...filters, date_range_start: e.target.value || undefined })}
                className="w-full px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
              />
            </div>
            <div>
              <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">End Date</label>
              <input
                type="date"
                value={filters.date_range_end || ""}
                onChange={(e) => setFilters({ ...filters, date_range_end: e.target.value || undefined })}
                className="w-full px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
              />
            </div>
          </div>
        </div>

        {/* Price */}
        <div className="mb-6">
          <h3 className="font-mono text-xs text-[var(--soft)] mb-3">Price</h3>
          <div>
            <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">
              Maximum Price {filters.price_max ? `($${filters.price_max})` : "(no limit)"}
            </label>
            <input
              type="range"
              min="0"
              max="200"
              step="10"
              value={filters.price_max || 0}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                setFilters({ ...filters, price_max: val > 0 ? val : undefined });
              }}
              className="w-full h-2 bg-[var(--twilight)] rounded-lg appearance-none cursor-pointer accent-[var(--coral)]"
            />
            <div className="flex justify-between font-mono text-xs text-[var(--muted)] mt-1">
              <span>Any</span>
              <span>$50</span>
              <span>$100</span>
              <span>$150</span>
              <span>$200</span>
            </div>
          </div>
        </div>

        {/* Tags */}
        <div>
          <h3 className="font-mono text-xs text-[var(--soft)] mb-3">Tags</h3>
          <div>
            <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Required Tags (comma-separated)</label>
            <input
              type="text"
              value={filters.tags?.join(", ") || ""}
              onChange={(e) => {
                const tags = e.target.value.split(",").map(t => t.trim()).filter(Boolean);
                setFilters({ ...filters, tags: tags.length ? tags : undefined });
              }}
              placeholder="outdoor, family-friendly, 21+"
              className="w-full px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
            />
          </div>
        </div>
      </section>

      {/* Feed Configuration */}
      <section className="bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg p-6">
        <h2 className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-4">Feed Configuration</h2>
        <p className="font-mono text-xs text-[var(--soft)] mb-4">
          Configure how the portal feed displays content to visitors.
        </p>

        {/* Feed Type */}
        <div className="mb-6">
          <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-2">Feed Type</label>
          <div className="space-y-2">
            {[
              { value: "default" as const, label: "Default Feed", desc: "User-personalized events based on their preferences" },
              { value: "sections" as const, label: "Section-Based Feed", desc: "Display curated sections you've created" },
              { value: "custom" as const, label: "Hybrid Feed", desc: "Featured sections + personalized recommendations" },
            ].map((opt) => (
              <label key={opt.value} className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="radio"
                  name="feed_type"
                  value={opt.value}
                  checked={feedSettings.feed_type === opt.value}
                  onChange={() => setFeedSettings({ ...feedSettings, feed_type: opt.value })}
                  className="mt-1 w-4 h-4 text-[var(--coral)] border-[var(--twilight)] bg-[var(--night)] focus:ring-[var(--coral)]"
                />
                <div>
                  <div className="font-mono text-sm text-[var(--cream)] group-hover:text-[var(--coral)]">{opt.label}</div>
                  <div className="font-mono text-xs text-[var(--muted)]">{opt.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Featured Sections */}
        {(feedSettings.feed_type === "sections" || feedSettings.feed_type === "custom") && (
          <div className="mb-6 pt-4 border-t border-[var(--twilight)]">
            <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-2">Featured Sections</label>
            {sections.length === 0 ? (
              <div className="p-4 bg-[var(--night)] rounded border border-[var(--twilight)] text-center">
                <p className="font-mono text-xs text-[var(--muted)] mb-2">No sections created yet</p>
                <Link
                  href={`/admin/portals/${portal.id}/sections`}
                  className="font-mono text-xs text-[var(--coral)] hover:underline"
                >
                  Create sections first
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {sections.map((section) => {
                  const isSelected = feedSettings.featured_section_ids?.includes(section.id) || false;
                  return (
                    <label
                      key={section.id}
                      className={`flex items-center gap-3 p-3 rounded border cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-[var(--coral)]/10 border-[var(--coral)]"
                          : "bg-[var(--night)] border-[var(--twilight)] hover:border-[var(--muted)]"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          const current = feedSettings.featured_section_ids || [];
                          if (e.target.checked) {
                            setFeedSettings({ ...feedSettings, featured_section_ids: [...current, section.id] });
                          } else {
                            setFeedSettings({ ...feedSettings, featured_section_ids: current.filter((sid) => sid !== section.id) });
                          }
                        }}
                        className="w-4 h-4 rounded border-[var(--twilight)] bg-[var(--night)] text-[var(--coral)] focus:ring-[var(--coral)]"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm text-[var(--cream)]">{section.title}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-xs font-mono ${
                              section.section_type === "curated"
                                ? "bg-[var(--coral)]/20 text-[var(--coral)]"
                                : "bg-[var(--neon-cyan)]/20 text-[var(--neon-cyan)]"
                            }`}
                          >
                            {section.section_type}
                          </span>
                          {!section.is_visible && (
                            <span className="px-1.5 py-0.5 rounded text-xs font-mono bg-[var(--twilight)] text-[var(--muted)]">
                              hidden
                            </span>
                          )}
                        </div>
                        <div className="font-mono text-xs text-[var(--muted)]">/{section.slug}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Feed Options */}
        <div className="pt-4 border-t border-[var(--twilight)]">
          <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-3">Options</label>
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={feedSettings.show_activity_tab ?? true}
                onChange={(e) => setFeedSettings({ ...feedSettings, show_activity_tab: e.target.checked })}
                className="w-4 h-4 rounded border-[var(--twilight)] bg-[var(--night)] text-[var(--coral)] focus:ring-[var(--coral)]"
              />
              <span className="font-mono text-sm text-[var(--cream)]">Show Activity/Friends tab</span>
            </label>

            <div>
              <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Items per Section</label>
              <select
                value={feedSettings.items_per_section || 5}
                onChange={(e) => setFeedSettings({ ...feedSettings, items_per_section: parseInt(e.target.value) })}
                className="px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
              >
                <option value={3}>3 items</option>
                <option value={5}>5 items</option>
                <option value={10}>10 items</option>
                <option value={15}>15 items</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Save */}
      <div className="flex justify-end pt-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-[var(--coral)] text-[var(--void)] font-mono text-sm rounded hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
