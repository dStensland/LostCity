"use client";

import { useState } from "react";
import { VisualPresetId, VISUAL_PRESETS } from "@/lib/visual-presets";
import { applyPortalExperience, type ExperienceSpec } from "@/lib/experience-compiler";

type PortalDraft = {
  id?: string;
  visual_preset: VisualPresetId;
  primary_color?: string;
  logo_url?: string;
  theme_mode: "light" | "dark";
};

type Props = {
  draft: PortalDraft;
  updateDraft: (updates: Partial<PortalDraft>) => void;
  onNext: () => void;
  onBack: () => void;
};

// Featured presets for the wizard
const FEATURED_PRESETS: VisualPresetId[] = [
  "default",
  "cosmic_dark",
  "corporate_clean",
  "vibrant_community",
];

export function BrandingStep({ draft, updateDraft, onNext, onBack }: Props) {
  const [visualPreset, setVisualPreset] = useState<VisualPresetId>(draft.visual_preset);
  const [primaryColor, setPrimaryColor] = useState(draft.primary_color || "");
  const [logoUrl, setLogoUrl] = useState(draft.logo_url || "");
  const [themeMode, setThemeMode] = useState<"light" | "dark">(draft.theme_mode);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePresetChange = (presetId: VisualPresetId) => {
    setVisualPreset(presetId);
    const preset = VISUAL_PRESETS[presetId];
    setThemeMode(preset.theme_mode);
    // Reset custom color when changing presets
    setPrimaryColor("");
  };

  const handleNext = async () => {
    if (!draft.id) {
      setError("Portal ID missing");
      return;
    }

    setUpdating(true);
    setError(null);

    try {
      const preset = VISUAL_PRESETS[visualPreset];
      const spec: ExperienceSpec = {
        branding: {
          visual_preset: visualPreset,
          theme_mode: themeMode,
          ...preset.colors,
        },
      };

      // Override primary color if set
      if (primaryColor) {
        spec.branding!.primary_color = primaryColor;
      }

      // Add logo if set
      if (logoUrl) {
        spec.branding!.logo_url = logoUrl;
      }

      await applyPortalExperience(draft.id, spec, {
        apply: true,
        sync_sections: false,
        replace_sections: false,
      });

      updateDraft({
        visual_preset: visualPreset,
        primary_color: primaryColor,
        logo_url: logoUrl,
        theme_mode: themeMode,
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
        <h2 className="text-2xl font-semibold text-[var(--cream)] mb-2">Branding</h2>
        <p className="font-mono text-sm text-[var(--muted)]">Choose a visual style for your portal</p>
      </div>

      <div className="space-y-6">
        {/* Visual Presets */}
        <div>
          <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-3">
            Visual Preset
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {FEATURED_PRESETS.map((presetId) => {
              const preset = VISUAL_PRESETS[presetId];
              return (
                <button
                  key={presetId}
                  type="button"
                  onClick={() => handlePresetChange(presetId)}
                  className={`relative p-4 rounded-lg border-2 text-left transition-all overflow-hidden ${
                    visualPreset === presetId
                      ? "border-[var(--coral)]"
                      : "border-[var(--twilight)] hover:border-[var(--twilight)]/60"
                  }`}
                  style={{
                    backgroundColor: preset.colors.background_color,
                  }}
                >
                  {/* Preview gradient */}
                  <div
                    className="absolute inset-0 opacity-10"
                    style={{
                      background: `linear-gradient(135deg, ${preset.colors.primary_color}, ${preset.colors.secondary_color})`,
                    }}
                  />

                  {/* Content */}
                  <div className="relative z-10">
                    <div
                      className="font-sans text-sm font-medium mb-1"
                      style={{ color: preset.colors.text_color }}
                    >
                      {preset.name}
                    </div>
                    <div
                      className="font-mono text-xs mb-3"
                      style={{ color: preset.colors.muted_color }}
                    >
                      {preset.description}
                    </div>

                    {/* Color chips */}
                    <div className="flex gap-1.5">
                      <div
                        className="w-6 h-6 rounded border border-white/20"
                        style={{ backgroundColor: preset.colors.primary_color }}
                        title="Primary"
                      />
                      <div
                        className="w-6 h-6 rounded border border-white/20"
                        style={{ backgroundColor: preset.colors.secondary_color }}
                        title="Secondary"
                      />
                      <div
                        className="w-6 h-6 rounded border border-white/20"
                        style={{ backgroundColor: preset.colors.accent_color }}
                        title="Accent"
                      />
                    </div>
                  </div>

                  {visualPreset === presetId && (
                    <div className="absolute top-3 right-3 w-6 h-6 bg-[var(--coral)] rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-[var(--void)]" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Light/Dark Mode */}
        <div>
          <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-2">
            Theme Mode
          </label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setThemeMode("dark")}
              className={`flex-1 px-4 py-3 rounded-lg border-2 font-mono text-sm transition-all ${
                themeMode === "dark"
                  ? "border-[var(--coral)] bg-[var(--coral)]/5 text-[var(--cream)]"
                  : "border-[var(--twilight)] text-[var(--muted)] hover:border-[var(--twilight)]/60"
              }`}
            >
              Dark
            </button>
            <button
              type="button"
              onClick={() => setThemeMode("light")}
              className={`flex-1 px-4 py-3 rounded-lg border-2 font-mono text-sm transition-all ${
                themeMode === "light"
                  ? "border-[var(--coral)] bg-[var(--coral)]/5 text-[var(--cream)]"
                  : "border-[var(--twilight)] text-[var(--muted)] hover:border-[var(--twilight)]/60"
              }`}
            >
              Light
            </button>
          </div>
        </div>

        {/* Primary Color Override */}
        <div>
          <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-2">
            Primary Color <span className="text-[var(--muted)]/60">(optional override)</span>
          </label>
          <div className="flex gap-3">
            <input
              type="color"
              value={primaryColor || VISUAL_PRESETS[visualPreset].colors.primary_color}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="w-16 h-12 rounded border border-[var(--twilight)] bg-[var(--night)] cursor-pointer"
            />
            <input
              type="text"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              placeholder={VISUAL_PRESETS[visualPreset].colors.primary_color}
              className="flex-1 px-4 py-3 bg-[var(--night)] border border-[var(--twilight)] rounded-lg font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)] transition-colors"
            />
          </div>
        </div>

        {/* Logo URL */}
        <div>
          <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-2">
            Logo URL <span className="text-[var(--muted)]/60">(optional)</span>
          </label>
          <input
            type="text"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://example.com/logo.png"
            className="w-full px-4 py-3 bg-[var(--night)] border border-[var(--twilight)] rounded-lg font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)] transition-colors"
          />
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
            {updating ? "Saving..." : "Next: Sections"}
          </button>
        </div>
      </div>
    </div>
  );
}
