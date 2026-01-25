"use client";

import { useState, useEffect, use, useCallback } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";
import { CATEGORIES } from "@/lib/search";

type SectionItem = {
  id: string;
  entity_type: string;
  entity_id: number;
  display_order: number;
  note: string | null;
};

type AutoFilter = {
  categories?: string[];
  is_free?: boolean;
  price_max?: number;
  date_filter?: string;
  sort_by?: string;
};

type Section = {
  id: string;
  portal_id: string;
  slug: string;
  title: string;
  description: string | null;
  section_type: "auto" | "curated" | "mixed";
  block_type: string;
  layout: string;
  max_items: number;
  auto_filter: AutoFilter | null;
  block_content: Record<string, unknown> | null;
  display_order: number;
  is_visible: boolean;
  schedule_start: string | null;
  schedule_end: string | null;
  show_on_days: string[] | null;
  show_after_time: string | null;
  show_before_time: string | null;
  items: SectionItem[];
};

type Event = {
  id: number;
  title: string;
  start_date: string;
  venue: { name: string } | null;
};

const BLOCK_TYPES = [
  { value: "event_list", label: "Event List", description: "Compact list of events" },
  { value: "event_cards", label: "Event Cards", description: "Cards with images" },
  { value: "event_carousel", label: "Carousel", description: "Horizontal scroll" },
  { value: "hero_banner", label: "Hero Banner", description: "Large featured event" },
  { value: "category_grid", label: "Category Grid", description: "Category quick links" },
  { value: "announcement", label: "Announcement", description: "Rich text content" },
  { value: "external_link", label: "External Link", description: "Link to external site" },
];

const LAYOUTS = [
  { value: "list", label: "List" },
  { value: "cards", label: "Cards" },
  { value: "carousel", label: "Carousel" },
  { value: "grid", label: "Grid" },
  { value: "featured", label: "Featured" },
];

const DATE_FILTERS = [
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "this_weekend", label: "This Weekend" },
  { value: "next_7_days", label: "Next 7 Days" },
  { value: "next_30_days", label: "Next 30 Days" },
];

const SORT_OPTIONS = [
  { value: "date", label: "By Date" },
  { value: "popularity", label: "By Popularity" },
  { value: "trending", label: "Trending" },
  { value: "random", label: "Random" },
];

const DAYS_OF_WEEK = [
  { value: "monday", label: "Mon" },
  { value: "tuesday", label: "Tue" },
  { value: "wednesday", label: "Wed" },
  { value: "thursday", label: "Thu" },
  { value: "friday", label: "Fri" },
  { value: "saturday", label: "Sat" },
  { value: "sunday", label: "Sun" },
];

export default function PortalSectionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: portalId } = use(params);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // New/Edit section form
  const [showForm, setShowForm] = useState(false);
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    description: "",
    section_type: "auto" as "auto" | "curated" | "mixed",
    block_type: "event_list",
    layout: "list",
    max_items: 5,
    // Auto filter
    categories: [] as string[],
    is_free: false,
    date_filter: "",
    sort_by: "date",
    // Scheduling
    schedule_start: "",
    schedule_end: "",
    show_on_days: [] as string[],
    show_after_time: "",
    show_before_time: "",
  });

  // Event search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Event[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingToSection, setAddingToSection] = useState<string | null>(null);

  const loadSections = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/portals/${portalId}/sections`);
      if (!res.ok) throw new Error("Failed to load sections");
      const data = await res.json();
      setSections(data.sections || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [portalId]);

  useEffect(() => {
    loadSections();
  }, [loadSections]);

  function resetForm() {
    setFormData({
      title: "",
      slug: "",
      description: "",
      section_type: "auto",
      block_type: "event_list",
      layout: "list",
      max_items: 5,
      categories: [],
      is_free: false,
      date_filter: "",
      sort_by: "date",
      schedule_start: "",
      schedule_end: "",
      show_on_days: [],
      show_after_time: "",
      show_before_time: "",
    });
    setEditingSection(null);
  }

  function openNewForm() {
    resetForm();
    setShowForm(true);
  }

  function openEditForm(section: Section) {
    setEditingSection(section);
    setFormData({
      title: section.title,
      slug: section.slug,
      description: section.description || "",
      section_type: section.section_type,
      block_type: section.block_type || "event_list",
      layout: section.layout || "list",
      max_items: section.max_items || 5,
      categories: section.auto_filter?.categories || [],
      is_free: section.auto_filter?.is_free || false,
      date_filter: section.auto_filter?.date_filter || "",
      sort_by: section.auto_filter?.sort_by || "date",
      schedule_start: section.schedule_start || "",
      schedule_end: section.schedule_end || "",
      show_on_days: section.show_on_days || [],
      show_after_time: section.show_after_time?.slice(0, 5) || "",
      show_before_time: section.show_before_time?.slice(0, 5) || "",
    });
    setShowForm(true);
  }

  async function saveSection() {
    if (!formData.title || !formData.slug) return;

    setSaving(true);
    try {
      const autoFilter: AutoFilter = {};
      if (formData.categories.length > 0) autoFilter.categories = formData.categories;
      if (formData.is_free) autoFilter.is_free = true;
      if (formData.date_filter) autoFilter.date_filter = formData.date_filter;
      if (formData.sort_by) autoFilter.sort_by = formData.sort_by;

      const body = {
        title: formData.title,
        slug: formData.slug,
        description: formData.description || null,
        section_type: formData.section_type,
        block_type: formData.block_type,
        layout: formData.layout,
        max_items: formData.max_items,
        auto_filter: Object.keys(autoFilter).length > 0 ? autoFilter : null,
        schedule_start: formData.schedule_start || null,
        schedule_end: formData.schedule_end || null,
        show_on_days: formData.show_on_days.length > 0 ? formData.show_on_days : null,
        show_after_time: formData.show_after_time || null,
        show_before_time: formData.show_before_time || null,
        is_visible: true,
      };

      const url = editingSection
        ? `/api/admin/portals/${portalId}/sections/${editingSection.id}`
        : `/api/admin/portals/${portalId}/sections`;

      const res = await fetch(url, {
        method: editingSection ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error("Failed to save section");

      setShowForm(false);
      resetForm();
      loadSections();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function deleteSection(sectionId: string) {
    if (!confirm("Delete this section?")) return;

    try {
      const res = await fetch(`/api/admin/portals/${portalId}/sections/${sectionId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete section");
      loadSections();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  async function toggleVisibility(section: Section) {
    try {
      const res = await fetch(`/api/admin/portals/${portalId}/sections/${section.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_visible: !section.is_visible }),
      });

      if (!res.ok) throw new Error("Failed to update");
      loadSections();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    }
  }

  async function moveSection(sectionId: string, direction: "up" | "down") {
    const idx = sections.findIndex((s) => s.id === sectionId);
    if (idx === -1) return;
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === sections.length - 1) return;

    const newOrder = [...sections];
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]];

    // Optimistic update
    setSections(newOrder);

    try {
      await fetch(`/api/admin/portals/${portalId}/sections/${sectionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_order: swapIdx }),
      });
      await fetch(`/api/admin/portals/${portalId}/sections/${newOrder[idx].id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_order: idx }),
      });
    } catch {
      loadSections(); // Revert on error
    }
  }

  async function searchEvents() {
    if (!searchQuery.trim()) return;

    setSearching(true);
    try {
      const res = await fetch(`/api/events?search=${encodeURIComponent(searchQuery)}&limit=10`);
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setSearchResults(data.events || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }

  async function addEventToSection(sectionId: string, event: Event) {
    try {
      const res = await fetch(`/api/admin/portals/${portalId}/sections/${sectionId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity_type: "event",
          entity_id: event.id,
        }),
      });

      if (!res.ok) throw new Error("Failed to add event");
      setSearchResults([]);
      setSearchQuery("");
      setAddingToSection(null);
      loadSections();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add");
    }
  }

  async function removeItem(sectionId: string, itemId: string) {
    try {
      const res = await fetch(
        `/api/admin/portals/${portalId}/sections/${sectionId}/items?itemId=${itemId}`,
        { method: "DELETE" }
      );

      if (!res.ok) throw new Error("Failed to remove");
      loadSections();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--void)] flex items-center justify-center">
        <div className="animate-pulse text-[var(--muted)]">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--void)]">
      {/* Header */}
      <header className="border-b border-[var(--twilight)] px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Logo href="/admin" size="sm" />
            <span className="text-[var(--muted)]">/</span>
            <Link href="/admin/portals" className="text-[var(--muted)] hover:text-[var(--cream)] font-mono text-sm">
              Portals
            </Link>
            <span className="text-[var(--muted)]">/</span>
            <Link href={`/admin/portals/${portalId}`} className="text-[var(--muted)] hover:text-[var(--cream)] font-mono text-sm">
              Edit
            </Link>
            <span className="text-[var(--muted)]">/</span>
            <span className="text-[var(--cream)] font-mono text-sm">Feed Sections</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-4 px-4 py-2 bg-red-500/20 border border-red-500/50 rounded text-red-400 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">×</button>
          </div>
        )}

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--cream)]">Feed Sections</h1>
            <p className="font-mono text-xs text-[var(--muted)] mt-1">
              Configure what appears in your portal&apos;s Feed tab
            </p>
          </div>
          <button
            onClick={openNewForm}
            className="px-4 py-2 bg-[var(--coral)] text-[var(--void)] font-mono text-sm rounded hover:opacity-90"
          >
            + New Section
          </button>
        </div>

        {/* Section Form Modal */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="bg-[var(--night)] border border-[var(--twilight)] rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto m-4">
              <div className="sticky top-0 bg-[var(--night)] border-b border-[var(--twilight)] px-6 py-4 flex items-center justify-between">
                <h2 className="font-serif text-xl text-[var(--cream)]">
                  {editingSection ? "Edit Section" : "New Section"}
                </h2>
                <button
                  onClick={() => { setShowForm(false); resetForm(); }}
                  className="text-[var(--muted)] hover:text-[var(--cream)]"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Title *</label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => {
                        setFormData({
                          ...formData,
                          title: e.target.value,
                          slug: editingSection ? formData.slug : e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
                        });
                      }}
                      placeholder="Featured Events"
                      className="w-full px-3 py-2 bg-[var(--dusk)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
                    />
                  </div>
                  <div>
                    <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Slug *</label>
                    <input
                      type="text"
                      value={formData.slug}
                      onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                      placeholder="featured-events"
                      className="w-full px-3 py-2 bg-[var(--dusk)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Description</label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Hand-picked events for this week"
                    className="w-full px-3 py-2 bg-[var(--dusk)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
                  />
                </div>

                {/* Type & Display */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Section Type</label>
                    <select
                      value={formData.section_type}
                      onChange={(e) => setFormData({ ...formData, section_type: e.target.value as "auto" | "curated" | "mixed" })}
                      className="w-full px-3 py-2 bg-[var(--dusk)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
                    >
                      <option value="auto">Auto (filter-based)</option>
                      <option value="curated">Curated (manual)</option>
                      <option value="mixed">Mixed (both)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Block Type</label>
                    <select
                      value={formData.block_type}
                      onChange={(e) => setFormData({ ...formData, block_type: e.target.value })}
                      className="w-full px-3 py-2 bg-[var(--dusk)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
                    >
                      {BLOCK_TYPES.map((bt) => (
                        <option key={bt.value} value={bt.value}>{bt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Layout</label>
                    <select
                      value={formData.layout}
                      onChange={(e) => setFormData({ ...formData, layout: e.target.value })}
                      className="w-full px-3 py-2 bg-[var(--dusk)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
                    >
                      {LAYOUTS.map((l) => (
                        <option key={l.value} value={l.value}>{l.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Max Items</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={formData.max_items}
                    onChange={(e) => setFormData({ ...formData, max_items: parseInt(e.target.value) || 5 })}
                    className="w-24 px-3 py-2 bg-[var(--dusk)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
                  />
                </div>

                {/* Auto Filter Options */}
                {(formData.section_type === "auto" || formData.section_type === "mixed") && (
                  <div className="border-t border-[var(--twilight)] pt-6">
                    <h3 className="font-mono text-sm text-[var(--cream)] mb-4">Auto-Filter Settings</h3>

                    <div className="space-y-4">
                      <div>
                        <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-2">Categories</label>
                        <div className="flex flex-wrap gap-2">
                          {CATEGORIES.map((cat) => (
                            <button
                              key={cat.value}
                              type="button"
                              onClick={() => {
                                const cats = formData.categories.includes(cat.value)
                                  ? formData.categories.filter((c) => c !== cat.value)
                                  : [...formData.categories, cat.value];
                                setFormData({ ...formData, categories: cats });
                              }}
                              className={`px-2.5 py-1 rounded font-mono text-xs transition-colors ${
                                formData.categories.includes(cat.value)
                                  ? "bg-[var(--coral)] text-[var(--void)]"
                                  : "bg-[var(--dusk)] text-[var(--muted)] hover:text-[var(--cream)]"
                              }`}
                            >
                              {cat.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Date Filter</label>
                          <select
                            value={formData.date_filter}
                            onChange={(e) => setFormData({ ...formData, date_filter: e.target.value })}
                            className="w-full px-3 py-2 bg-[var(--dusk)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
                          >
                            <option value="">No filter</option>
                            {DATE_FILTERS.map((df) => (
                              <option key={df.value} value={df.value}>{df.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Sort By</label>
                          <select
                            value={formData.sort_by}
                            onChange={(e) => setFormData({ ...formData, sort_by: e.target.value })}
                            className="w-full px-3 py-2 bg-[var(--dusk)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
                          >
                            {SORT_OPTIONS.map((so) => (
                              <option key={so.value} value={so.value}>{so.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.is_free}
                          onChange={(e) => setFormData({ ...formData, is_free: e.target.checked })}
                          className="rounded border-[var(--twilight)] bg-[var(--dusk)] text-[var(--coral)] focus:ring-[var(--coral)]"
                        />
                        <span className="font-mono text-sm text-[var(--cream)]">Free events only</span>
                      </label>
                    </div>
                  </div>
                )}

                {/* Scheduling */}
                <div className="border-t border-[var(--twilight)] pt-6">
                  <h3 className="font-mono text-sm text-[var(--cream)] mb-4">Scheduling (Optional)</h3>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Show From Date</label>
                        <input
                          type="date"
                          value={formData.schedule_start}
                          onChange={(e) => setFormData({ ...formData, schedule_start: e.target.value })}
                          className="w-full px-3 py-2 bg-[var(--dusk)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
                        />
                      </div>
                      <div>
                        <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Show Until Date</label>
                        <input
                          type="date"
                          value={formData.schedule_end}
                          onChange={(e) => setFormData({ ...formData, schedule_end: e.target.value })}
                          className="w-full px-3 py-2 bg-[var(--dusk)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-2">Show On Days</label>
                      <div className="flex gap-2">
                        {DAYS_OF_WEEK.map((day) => (
                          <button
                            key={day.value}
                            type="button"
                            onClick={() => {
                              const days = formData.show_on_days.includes(day.value)
                                ? formData.show_on_days.filter((d) => d !== day.value)
                                : [...formData.show_on_days, day.value];
                              setFormData({ ...formData, show_on_days: days });
                            }}
                            className={`px-2.5 py-1 rounded font-mono text-xs transition-colors ${
                              formData.show_on_days.includes(day.value)
                                ? "bg-[var(--coral)] text-[var(--void)]"
                                : "bg-[var(--dusk)] text-[var(--muted)] hover:text-[var(--cream)]"
                            }`}
                          >
                            {day.label}
                          </button>
                        ))}
                      </div>
                      <p className="font-mono text-[0.65rem] text-[var(--muted)] mt-1">
                        Leave empty to show every day
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Show After Time</label>
                        <input
                          type="time"
                          value={formData.show_after_time}
                          onChange={(e) => setFormData({ ...formData, show_after_time: e.target.value })}
                          className="w-full px-3 py-2 bg-[var(--dusk)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
                        />
                      </div>
                      <div>
                        <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Show Before Time</label>
                        <input
                          type="time"
                          value={formData.show_before_time}
                          onChange={(e) => setFormData({ ...formData, show_before_time: e.target.value })}
                          className="w-full px-3 py-2 bg-[var(--dusk)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="sticky bottom-0 bg-[var(--night)] border-t border-[var(--twilight)] px-6 py-4 flex justify-end gap-3">
                <button
                  onClick={() => { setShowForm(false); resetForm(); }}
                  className="px-4 py-2 text-[var(--muted)] font-mono text-sm hover:text-[var(--cream)]"
                >
                  Cancel
                </button>
                <button
                  onClick={saveSection}
                  disabled={saving || !formData.title || !formData.slug}
                  className="px-4 py-2 bg-[var(--coral)] text-[var(--void)] font-mono text-sm rounded hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? "Saving..." : editingSection ? "Save Changes" : "Create Section"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Sections List */}
        {sections.length === 0 ? (
          <div className="text-center py-12 bg-[var(--dusk)] border border-[var(--twilight)] rounded-xl">
            <svg className="w-12 h-12 mx-auto text-[var(--muted)] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <p className="font-mono text-sm text-[var(--muted)]">No sections yet</p>
            <p className="font-mono text-xs text-[var(--muted)] mt-1 mb-4">Create a section to start building your feed</p>
            <button
              onClick={openNewForm}
              className="px-4 py-2 bg-[var(--coral)] text-[var(--void)] font-mono text-sm rounded hover:opacity-90"
            >
              Create First Section
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {sections
              .sort((a, b) => a.display_order - b.display_order)
              .map((section, idx) => (
                <div
                  key={section.id}
                  className={`bg-[var(--dusk)] border rounded-lg overflow-hidden ${
                    section.is_visible ? "border-[var(--twilight)]" : "border-[var(--muted)]/30 opacity-60"
                  }`}
                >
                  {/* Section Header */}
                  <div className="flex items-start gap-4 p-4">
                    {/* Reorder buttons */}
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => moveSection(section.id, "up")}
                        disabled={idx === 0}
                        className="p-1 text-[var(--muted)] hover:text-[var(--cream)] disabled:opacity-30"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => moveSection(section.id, "down")}
                        disabled={idx === sections.length - 1}
                        className="p-1 text-[var(--muted)] hover:text-[var(--cream)] disabled:opacity-30"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-serif text-lg text-[var(--cream)]">{section.title}</h3>
                        <span className={`px-2 py-0.5 rounded text-[0.6rem] font-mono uppercase ${
                          section.section_type === "curated"
                            ? "bg-[var(--coral)]/20 text-[var(--coral)]"
                            : section.section_type === "mixed"
                            ? "bg-purple-500/20 text-purple-400"
                            : "bg-[var(--neon-cyan)]/20 text-[var(--neon-cyan)]"
                        }`}>
                          {section.section_type}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[0.6rem] font-mono bg-[var(--twilight)] text-[var(--muted)]">
                          {BLOCK_TYPES.find((bt) => bt.value === section.block_type)?.label || section.block_type}
                        </span>
                        {!section.is_visible && (
                          <span className="px-2 py-0.5 rounded text-[0.6rem] font-mono bg-[var(--twilight)] text-[var(--muted)]">
                            hidden
                          </span>
                        )}
                      </div>
                      {section.description && (
                        <p className="font-mono text-xs text-[var(--muted)] mt-1">{section.description}</p>
                      )}
                      <p className="font-mono text-[0.65rem] text-[var(--muted)] mt-1">
                        /{section.slug} · {section.max_items || 5} max items
                        {section.auto_filter?.categories?.length
                          ? ` · ${section.auto_filter.categories.join(", ")}`
                          : ""}
                        {section.auto_filter?.date_filter
                          ? ` · ${DATE_FILTERS.find((df) => df.value === section.auto_filter?.date_filter)?.label}`
                          : ""}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditForm(section)}
                        className="p-2 text-[var(--muted)] hover:text-[var(--cream)]"
                        title="Edit section"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => toggleVisibility(section)}
                        className="p-2 text-[var(--muted)] hover:text-[var(--cream)]"
                        title={section.is_visible ? "Hide section" : "Show section"}
                      >
                        {section.is_visible ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        )}
                      </button>
                      <button
                        onClick={() => deleteSection(section.id)}
                        className="p-2 text-red-400 hover:text-red-300"
                        title="Delete section"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Curated Items */}
                  {(section.section_type === "curated" || section.section_type === "mixed") && (
                    <div className="border-t border-[var(--twilight)] p-4 bg-[var(--night)]/50">
                      {section.items && section.items.length > 0 ? (
                        <div className="space-y-2 mb-3">
                          {section.items
                            .sort((a, b) => a.display_order - b.display_order)
                            .map((item) => (
                              <div
                                key={item.id}
                                className="flex items-center justify-between px-3 py-2 bg-[var(--dusk)] rounded"
                              >
                                <span className="font-mono text-sm text-[var(--cream)]">
                                  {item.entity_type} #{item.entity_id}
                                </span>
                                <button
                                  onClick={() => removeItem(section.id, item.id)}
                                  className="text-[var(--muted)] hover:text-red-400"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            ))}
                        </div>
                      ) : (
                        <p className="font-mono text-xs text-[var(--muted)] mb-3">No curated items</p>
                      )}

                      {/* Add Event */}
                      {addingToSection === section.id ? (
                        <div>
                          <div className="flex gap-2 mb-2">
                            <input
                              type="text"
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && searchEvents()}
                              placeholder="Search events..."
                              className="flex-1 px-3 py-2 bg-[var(--dusk)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
                            />
                            <button
                              onClick={searchEvents}
                              disabled={searching}
                              className="px-4 py-2 bg-[var(--twilight)] text-[var(--cream)] font-mono text-sm rounded hover:bg-[var(--muted)]/20"
                            >
                              {searching ? "..." : "Search"}
                            </button>
                            <button
                              onClick={() => {
                                setAddingToSection(null);
                                setSearchResults([]);
                                setSearchQuery("");
                              }}
                              className="px-2 text-[var(--muted)] hover:text-[var(--cream)]"
                            >
                              Cancel
                            </button>
                          </div>
                          {searchResults.length > 0 && (
                            <div className="space-y-1 max-h-48 overflow-y-auto">
                              {searchResults.map((event) => (
                                <button
                                  key={event.id}
                                  onClick={() => addEventToSection(section.id, event)}
                                  className="w-full text-left px-3 py-2 bg-[var(--dusk)] hover:bg-[var(--twilight)] rounded"
                                >
                                  <div className="font-mono text-sm text-[var(--cream)]">{event.title}</div>
                                  <div className="font-mono text-xs text-[var(--muted)]">
                                    {event.start_date} {event.venue?.name && `· ${event.venue.name}`}
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => setAddingToSection(section.id)}
                          className="font-mono text-xs text-[var(--coral)] hover:underline"
                        >
                          + Add Event
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}
      </main>
    </div>
  );
}
