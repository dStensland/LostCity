"use client";

import { useState, useEffect, use, useCallback } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";

type SectionItem = {
  id: string;
  entity_type: string;
  entity_id: number;
  display_order: number;
  note: string | null;
};

type Section = {
  id: string;
  portal_id: string;
  slug: string;
  title: string;
  description: string | null;
  section_type: "auto" | "curated" | "mixed";
  auto_filter: Record<string, unknown> | null;
  display_order: number;
  is_visible: boolean;
  items: SectionItem[];
};

type Event = {
  id: number;
  title: string;
  start_date: string;
  venue: { name: string } | null;
};

export default function PortalSectionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: portalId } = use(params);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New section form
  const [showNewSection, setShowNewSection] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newType, setNewType] = useState<"curated" | "auto">("curated");
  const [newDescription, setNewDescription] = useState("");

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

  async function createSection() {
    if (!newTitle || !newSlug) return;

    try {
      const res = await fetch(`/api/admin/portals/${portalId}/sections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          slug: newSlug,
          description: newDescription || null,
          section_type: newType,
          is_visible: true,
        }),
      });

      if (!res.ok) throw new Error("Failed to create section");

      setShowNewSection(false);
      setNewTitle("");
      setNewSlug("");
      setNewDescription("");
      loadSections();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
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
            <span className="text-[var(--cream)] font-mono text-sm">Sections</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-4 px-4 py-2 bg-red-500/20 border border-red-500/50 rounded text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between mb-6">
          <h1 className="font-serif text-2xl text-[var(--cream)]">Portal Sections</h1>
          <button
            onClick={() => setShowNewSection(true)}
            className="px-4 py-2 bg-[var(--coral)] text-[var(--void)] font-mono text-sm rounded hover:opacity-90"
          >
            + New Section
          </button>
        </div>

        {/* New Section Form */}
        {showNewSection && (
          <div className="mb-6 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg p-4">
            <h3 className="font-mono text-sm text-[var(--cream)] mb-4">Create New Section</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => {
                    setNewTitle(e.target.value);
                    setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
                  }}
                  placeholder="Featured Events"
                  className="w-full px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
                />
              </div>
              <div>
                <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Slug</label>
                <input
                  type="text"
                  value={newSlug}
                  onChange={(e) => setNewSlug(e.target.value)}
                  placeholder="featured-events"
                  className="w-full px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
                />
              </div>
            </div>
            <div className="mb-4">
              <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Type</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as "curated" | "auto")}
                className="w-full px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
              >
                <option value="curated">Curated (manually pick events)</option>
                <option value="auto">Auto (filter-based)</option>
              </select>
            </div>
            <div className="mb-4">
              <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Description (optional)</label>
              <input
                type="text"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Hand-picked events for this week"
                className="w-full px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={createSection}
                disabled={!newTitle || !newSlug}
                className="px-4 py-2 bg-[var(--coral)] text-[var(--void)] font-mono text-sm rounded hover:opacity-90 disabled:opacity-50"
              >
                Create
              </button>
              <button
                onClick={() => setShowNewSection(false)}
                className="px-4 py-2 text-[var(--muted)] font-mono text-sm hover:text-[var(--cream)]"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Sections List */}
        {sections.length === 0 ? (
          <div className="text-center py-12 text-[var(--muted)]">
            <p className="font-mono text-sm">No sections yet</p>
            <p className="font-mono text-xs mt-1">Create a section to start curating content</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sections.map((section) => (
              <div
                key={section.id}
                className="bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg p-4"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-serif text-lg text-[var(--cream)]">{section.title}</h3>
                      <span className={`px-2 py-0.5 rounded text-xs font-mono ${
                        section.section_type === "curated"
                          ? "bg-[var(--coral)]/20 text-[var(--coral)]"
                          : "bg-[var(--neon-cyan)]/20 text-[var(--neon-cyan)]"
                      }`}>
                        {section.section_type}
                      </span>
                      {!section.is_visible && (
                        <span className="px-2 py-0.5 rounded text-xs font-mono bg-[var(--twilight)] text-[var(--muted)]">
                          hidden
                        </span>
                      )}
                    </div>
                    {section.description && (
                      <p className="font-mono text-xs text-[var(--muted)] mt-1">{section.description}</p>
                    )}
                    <p className="font-mono text-[0.65rem] text-[var(--muted)] mt-1">
                      /{section.slug} · {section.items?.length || 0} items
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
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

                {/* Section Items */}
                {section.section_type === "curated" && (
                  <div>
                    {section.items && section.items.length > 0 ? (
                      <div className="space-y-2 mb-4">
                        {section.items
                          .sort((a, b) => a.display_order - b.display_order)
                          .map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between px-3 py-2 bg-[var(--night)] rounded"
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
                      <p className="font-mono text-xs text-[var(--muted)] mb-4">No items in this section</p>
                    )}

                    {/* Add Event */}
                    {addingToSection === section.id ? (
                      <div className="border-t border-[var(--twilight)] pt-4">
                        <div className="flex gap-2 mb-2">
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && searchEvents()}
                            placeholder="Search events..."
                            className="flex-1 px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
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
                          <div className="space-y-1">
                            {searchResults.map((event) => (
                              <button
                                key={event.id}
                                onClick={() => addEventToSection(section.id, event)}
                                className="w-full text-left px-3 py-2 bg-[var(--night)] hover:bg-[var(--twilight)] rounded"
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

                {section.section_type === "auto" && (
                  <p className="font-mono text-xs text-[var(--muted)]">
                    This section auto-populates based on filters. Edit section to configure.
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
