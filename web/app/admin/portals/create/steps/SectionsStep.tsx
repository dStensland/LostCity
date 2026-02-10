"use client";

import { useState } from "react";

type PortalSection = {
  slug: string;
  title: string;
  description?: string;
  section_type: "auto" | "curated";
  auto_filter?: Record<string, unknown>;
};

type PortalDraft = {
  id?: string;
  sections: PortalSection[];
};

type Props = {
  draft: PortalDraft;
  updateDraft: (updates: Partial<PortalDraft>) => void;
  onNext: () => void;
  onBack: () => void;
};

export function SectionsStep({ draft, updateDraft, onNext, onBack }: Props) {
  const [sections, setSections] = useState<PortalSection[]>(draft.sections || []);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const moveSection = (index: number, direction: "up" | "down") => {
    const newSections = [...sections];
    const targetIndex = direction === "up" ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= newSections.length) return;

    [newSections[index], newSections[targetIndex]] = [
      newSections[targetIndex],
      newSections[index],
    ];

    setSections(newSections);
  };

  const toggleSection = (section: PortalSection) => {
    const exists = sections.find((s) => s.slug === section.slug);
    if (exists) {
      setSections(sections.filter((s) => s.slug !== section.slug));
    } else {
      setSections([...sections, section]);
    }
  };

  const handleNext = async () => {
    if (!draft.id) {
      setError("Portal ID missing");
      return;
    }

    setUpdating(true);
    setError(null);

    try {
      // Create sections via API
      for (let i = 0; i < sections.length; i++) {
        const section = sections[i];
        const res = await fetch(`/api/admin/portals/${draft.id}/sections`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...section,
            display_order: i,
            is_visible: true,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || `Failed to create section: ${section.title}`);
        }
      }

      updateDraft({ sections });
      onNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create sections");
    } finally {
      setUpdating(false);
    }
  };

  // Template sections available for selection
  const availableSections: PortalSection[] = [
    {
      slug: "tonight",
      title: "Tonight",
      description: "Events happening today",
      section_type: "auto",
      auto_filter: { when: "today", sort: "start_time" },
    },
    {
      slug: "this-weekend",
      title: "This Weekend",
      description: "Events happening this weekend",
      section_type: "auto",
      auto_filter: { when: "weekend", sort: "popularity" },
    },
    {
      slug: "popular",
      title: "Popular Events",
      description: "Trending and highly-rated",
      section_type: "auto",
      auto_filter: { sort: "popularity", limit: 20 },
    },
    {
      slug: "free-events",
      title: "Free Events",
      description: "No-cost experiences",
      section_type: "auto",
      auto_filter: { price: "free", sort: "start_date" },
    },
    {
      slug: "nearby-venues",
      title: "Nearby Venues",
      description: "Places to visit nearby",
      section_type: "auto",
      auto_filter: { proximity_km: 5, sort: "distance" },
    },
    {
      slug: "our-picks",
      title: "Our Picks",
      description: "Staff recommendations",
      section_type: "curated",
    },
  ];

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-[var(--cream)] mb-2">Content Sections</h2>
        <p className="font-mono text-sm text-[var(--muted)]">
          Choose and order sections for your portal
        </p>
      </div>

      <div className="space-y-6">
        {/* Available Sections */}
        <div>
          <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-3">
            Available Sections
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {availableSections.map((section) => {
              const isSelected = sections.some((s) => s.slug === section.slug);
              return (
                <button
                  key={section.slug}
                  type="button"
                  onClick={() => toggleSection(section)}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${
                    isSelected
                      ? "border-[var(--coral)] bg-[var(--coral)]/5"
                      : "border-[var(--twilight)] hover:border-[var(--twilight)]/60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="font-sans text-sm font-medium text-[var(--cream)]">
                      {section.title}
                    </div>
                    {isSelected && (
                      <svg className="w-4 h-4 text-[var(--coral)] flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </div>
                  <div className="font-mono text-xs text-[var(--muted)]">
                    {section.description}
                  </div>
                  <div className="mt-2">
                    <span
                      className={`inline-block px-2 py-0.5 rounded font-mono text-[0.65rem] ${
                        section.section_type === "auto"
                          ? "bg-blue-500/20 text-blue-400"
                          : "bg-purple-500/20 text-purple-400"
                      }`}
                    >
                      {section.section_type === "auto" ? "Auto" : "Curated"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Sections (Reorderable) */}
        {sections.length > 0 && (
          <div>
            <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-3">
              Section Order ({sections.length} selected)
            </label>
            <div className="space-y-2">
              {sections.map((section, index) => (
                <div
                  key={section.slug}
                  className="flex items-center gap-3 p-3 bg-[var(--night)] border border-[var(--twilight)] rounded-lg"
                >
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => moveSection(index, "up")}
                      disabled={index === 0}
                      className="text-[var(--muted)] hover:text-[var(--cream)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => moveSection(index, "down")}
                      disabled={index === sections.length - 1}
                      className="text-[var(--muted)] hover:text-[var(--cream)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </div>

                  <div className="flex-1">
                    <div className="font-sans text-sm font-medium text-[var(--cream)]">
                      {section.title}
                    </div>
                    <div className="font-mono text-xs text-[var(--muted)]">
                      {section.description}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleSection(section)}
                    className="text-[var(--muted)] hover:text-red-400 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

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
            disabled={updating || sections.length === 0}
            className="px-6 py-3 bg-[var(--coral)] text-[var(--void)] font-mono text-sm font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {updating ? "Creating Sections..." : "Next: Review"}
          </button>
        </div>
      </div>
    </div>
  );
}
