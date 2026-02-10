"use client";

import { useState } from "react";
import { VisualPresetId, VISUAL_PRESETS } from "@/lib/visual-presets";
import { VerticalId } from "@/lib/vertical-templates";

type PortalSection = {
  slug: string;
  title: string;
  description?: string;
  section_type: "auto" | "curated";
};

type PortalDraft = {
  id?: string;
  name: string;
  slug: string;
  tagline: string;
  portal_type: "city" | "event" | "business" | "personal";
  vertical?: VerticalId;
  city?: string;
  neighborhoods: string[];
  categories: string[];
  geo_radius?: number;
  visual_preset: VisualPresetId;
  primary_color?: string;
  logo_url?: string;
  theme_mode: "light" | "dark";
  sections: PortalSection[];
};

type Props = {
  draft: PortalDraft;
  onBack: () => void;
  onLaunch: () => void;
};

export function ReviewStep({ draft, onBack, onLaunch }: Props) {
  const [launching, setLaunching] = useState(false);

  const handleLaunch = async () => {
    setLaunching(true);
    await onLaunch();
    setLaunching(false);
  };

  const preset = VISUAL_PRESETS[draft.visual_preset];
  const previewUrl = draft.id ? `/${draft.slug}?preview=true` : null;

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-[var(--cream)] mb-2">Review & Launch</h2>
        <p className="font-mono text-sm text-[var(--muted)]">
          Review your portal configuration before launching
        </p>
      </div>

      <div className="space-y-6">
        {/* Preview Link */}
        {previewUrl && (
          <div className="p-4 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg">
            <div className="font-mono text-xs text-[var(--muted)] uppercase mb-2">Preview URL</div>
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-sm text-[var(--coral)] hover:opacity-80 transition-opacity"
            >
              {typeof window !== "undefined" ? window.location.origin : ""}{previewUrl}
            </a>
          </div>
        )}

        {/* Summary Cards */}
        <div className="space-y-4">
          {/* Identity */}
          <SummaryCard title="Identity">
            <SummaryRow label="Name" value={draft.name} />
            <SummaryRow label="Slug" value={`/${draft.slug}`} />
            {draft.tagline && <SummaryRow label="Tagline" value={draft.tagline} />}
            <SummaryRow label="Type" value={draft.portal_type} />
            {draft.vertical && <SummaryRow label="Vertical" value={draft.vertical} />}
          </SummaryCard>

          {/* Audience */}
          <SummaryCard title="Audience">
            {draft.city && <SummaryRow label="City" value={draft.city} />}
            {draft.geo_radius && <SummaryRow label="Radius" value={`${draft.geo_radius}km`} />}
            {draft.neighborhoods.length > 0 && (
              <SummaryRow label="Neighborhoods" value={`${draft.neighborhoods.length} selected`} />
            )}
            {draft.categories.length > 0 && (
              <SummaryRow
                label="Categories"
                value={draft.categories.map((c) => c.replace("_", " ")).join(", ")}
              />
            )}
          </SummaryCard>

          {/* Branding */}
          <SummaryCard title="Branding">
            <SummaryRow label="Visual Preset" value={preset.name} />
            <SummaryRow label="Theme" value={draft.theme_mode} />
            {draft.primary_color && (
              <div className="flex items-center justify-between py-2 border-b border-[var(--twilight)] last:border-0">
                <span className="font-mono text-xs text-[var(--muted)]">Primary Color</span>
                <div className="flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded border border-[var(--twilight)]"
                    style={{ backgroundColor: draft.primary_color }}
                  />
                  <span className="font-mono text-sm text-[var(--cream)]">{draft.primary_color}</span>
                </div>
              </div>
            )}
            {draft.logo_url && <SummaryRow label="Logo" value="Uploaded" />}
          </SummaryCard>

          {/* Sections */}
          <SummaryCard title="Content Sections">
            {draft.sections.length === 0 ? (
              <p className="font-mono text-xs text-[var(--muted)] italic">No sections configured</p>
            ) : (
              <div className="space-y-2">
                {draft.sections.map((section, index) => (
                  <div
                    key={section.slug}
                    className="flex items-start gap-2 p-2 bg-[var(--night)] rounded"
                  >
                    <span className="font-mono text-xs text-[var(--muted)] w-6">{index + 1}.</span>
                    <div className="flex-1">
                      <div className="font-sans text-sm text-[var(--cream)]">{section.title}</div>
                      <div className="font-mono text-xs text-[var(--muted)]">
                        {section.description}
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded font-mono text-[0.65rem] ${
                        section.section_type === "auto"
                          ? "bg-blue-500/20 text-blue-400"
                          : "bg-purple-500/20 text-purple-400"
                      }`}
                    >
                      {section.section_type}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </SummaryCard>
        </div>

        {/* Launch Note */}
        <div className="p-4 bg-[var(--coral)]/10 border border-[var(--coral)]/30 rounded-lg">
          <div className="flex gap-3">
            <svg
              className="w-5 h-5 text-[var(--coral)] flex-shrink-0 mt-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <div className="font-mono text-sm text-[var(--cream)] font-medium mb-1">
                Ready to Launch
              </div>
              <div className="font-mono text-xs text-[var(--muted)]">
                Your portal will be activated and publicly accessible at{" "}
                <span className="text-[var(--cream)]">/{draft.slug}</span>. You can continue to
                customize it in the portal settings.
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex justify-between pt-4">
          <button
            onClick={onBack}
            className="px-6 py-3 border border-[var(--twilight)] text-[var(--soft)] font-mono text-sm font-medium rounded-lg hover:text-[var(--cream)] hover:border-[var(--twilight)]/60 transition-colors"
          >
            Back
          </button>
          <button
            onClick={handleLaunch}
            disabled={launching}
            className="px-6 py-3 bg-[var(--coral)] text-[var(--void)] font-mono text-sm font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {launching ? "Launching..." : "Launch Portal"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg p-4">
      <h3 className="font-mono text-xs text-[var(--muted)] uppercase mb-3">{title}</h3>
      <div className="space-y-0">{children}</div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-[var(--twilight)] last:border-0">
      <span className="font-mono text-xs text-[var(--muted)]">{label}</span>
      <span className="font-mono text-sm text-[var(--cream)]">{value}</span>
    </div>
  );
}
