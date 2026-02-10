"use client";

import { useState, useEffect } from "react";
import { VerticalId, getVerticalTemplate } from "@/lib/vertical-templates";

type PortalDraft = {
  id?: string;
  name: string;
  slug: string;
  tagline: string;
  portal_type: "city" | "event" | "business" | "personal";
  vertical?: VerticalId;
};

type Props = {
  draft: PortalDraft;
  updateDraft: (updates: Partial<PortalDraft>) => void;
  onNext: () => void;
};

const PORTAL_TYPES = [
  { value: "city" as const, label: "City", description: "Event discovery for a city or region" },
  { value: "event" as const, label: "Event", description: "For a specific festival, conference, or event" },
  { value: "business" as const, label: "Business", description: "For hotels, venues, or commercial use" },
  { value: "personal" as const, label: "Personal", description: "Personal guide or community group" },
];

const VERTICALS = [
  { value: "city" as const, label: "City Guide", description: "Comprehensive event discovery", types: ["city"] },
  { value: "hotel" as const, label: "Hotel Concierge", description: "Guest recommendations", types: ["business"] },
  { value: "film" as const, label: "Film & Arts", description: "Screenings, galleries, performances", types: ["event"] },
  { value: "community" as const, label: "Community", description: "Neighborhood events", types: ["personal"] },
];

export function IdentityStep({ draft, updateDraft, onNext }: Props) {
  const [name, setName] = useState(draft.name);
  const [slug, setSlug] = useState(draft.slug);
  const [tagline, setTagline] = useState(draft.tagline);
  const [portalType, setPortalType] = useState(draft.portal_type);
  const [vertical, setVertical] = useState<VerticalId | undefined>(draft.vertical);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-generate slug from name
  useEffect(() => {
    if (name && !slug) {
      setSlug(name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
    }
  }, [name, slug]);

  // Filter verticals by portal type
  const availableVerticals = VERTICALS.filter((v) => v.types.includes(portalType));

  // Auto-select first vertical when type changes
  useEffect(() => {
    if (availableVerticals.length > 0 && !availableVerticals.find((v) => v.value === vertical)) {
      setVertical(availableVerticals[0].value);
    }
  }, [portalType, availableVerticals, vertical]);

  const handleNext = async () => {
    if (!name || !slug) {
      setError("Name and slug are required");
      return;
    }

    setCreating(true);
    setError(null);

    try {
      // Create portal as draft
      const res = await fetch("/api/admin/portals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug,
          tagline: tagline || null,
          portal_type: portalType,
          status: "draft",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create portal");
      }

      const data = await res.json();

      // Apply vertical template defaults
      let templateDefaults = {};
      if (vertical) {
        const template = getVerticalTemplate(vertical);
        templateDefaults = {
          categories: template.default_filters.categories || [],
          neighborhoods: template.default_filters.neighborhoods || [],
          visual_preset: template.visual_preset,
          theme_mode: template.visual_preset === "corporate_clean" ||
                      template.visual_preset === "family_friendly" ||
                      template.visual_preset === "minimal_modern" ? "light" : "dark",
          sections: template.sections,
        };
      }

      updateDraft({
        id: data.portal.id,
        name,
        slug,
        tagline,
        portal_type: portalType,
        vertical,
        ...templateDefaults,
      });

      onNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create portal");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-[var(--cream)] mb-2">Portal Identity</h2>
        <p className="font-mono text-sm text-[var(--muted)]">
          Choose a name and type for your portal
        </p>
      </div>

      <div className="space-y-6">
        {/* Portal Type */}
        <div>
          <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-2">
            Portal Type
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PORTAL_TYPES.map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => setPortalType(type.value)}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  portalType === type.value
                    ? "border-[var(--coral)] bg-[var(--coral)]/5"
                    : "border-[var(--twilight)] hover:border-[var(--twilight)]/60"
                }`}
              >
                <div className="font-sans text-sm font-medium text-[var(--cream)] mb-1">
                  {type.label}
                </div>
                <div className="font-mono text-xs text-[var(--muted)]">{type.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Vertical */}
        {availableVerticals.length > 0 && (
          <div>
            <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-2">
              Vertical Template
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {availableVerticals.map((v) => (
                <button
                  key={v.value}
                  type="button"
                  onClick={() => setVertical(v.value)}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    vertical === v.value
                      ? "border-[var(--coral)] bg-[var(--coral)]/5"
                      : "border-[var(--twilight)] hover:border-[var(--twilight)]/60"
                  }`}
                >
                  <div className="font-sans text-sm font-medium text-[var(--cream)] mb-1">
                    {v.label}
                  </div>
                  <div className="font-mono text-xs text-[var(--muted)]">{v.description}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Name */}
        <div>
          <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-2">
            Portal Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Denver"
            className="w-full px-4 py-3 bg-[var(--night)] border border-[var(--twilight)] rounded-lg font-sans text-[var(--cream)] focus:outline-none focus:border-[var(--coral)] transition-colors"
          />
        </div>

        {/* Slug */}
        <div>
          <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-2">
            URL Slug
          </label>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-[var(--muted)]">lostcity.app/</span>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              placeholder="denver"
              className="flex-1 px-4 py-3 bg-[var(--night)] border border-[var(--twilight)] rounded-lg font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)] transition-colors"
            />
          </div>
        </div>

        {/* Tagline */}
        <div>
          <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-2">
            Tagline <span className="text-[var(--muted)]/60">(optional)</span>
          </label>
          <input
            type="text"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="The real Denver, found"
            className="w-full px-4 py-3 bg-[var(--night)] border border-[var(--twilight)] rounded-lg font-sans text-[var(--cream)] focus:outline-none focus:border-[var(--coral)] transition-colors"
          />
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="font-mono text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-end pt-4">
          <button
            onClick={handleNext}
            disabled={creating || !name || !slug}
            className="px-6 py-3 bg-[var(--coral)] text-[var(--void)] font-mono text-sm font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? "Creating..." : "Next: Audience"}
          </button>
        </div>
      </div>
    </div>
  );
}
