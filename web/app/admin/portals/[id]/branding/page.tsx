"use client";

import { usePortalEdit } from "@/lib/admin/portal-edit-context";
import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClass } from "@/lib/css-utils";

export default function PortalBrandingPage() {
  const {
    portal,
    loading,
    saving,
    error,
    success,
    setError,
    setSuccess,
    name,
    tagline,
    branding,
    setBranding,
    handleSave,
  } = usePortalEdit();

  if (loading || !portal) return null;

  // Preview CSS
  const previewBgClass = createCssVarClass("--preview-bg", branding.background_color || "#0a0a12", "preview-bg");
  const previewBorderClass = createCssVarClass("--preview-border", branding.secondary_color || "#2a2a4a", "preview-border");
  const previewPrimaryClass = createCssVarClass("--preview-primary", branding.primary_color || "#E87B6B", "preview-primary");
  const previewSecondaryClass = createCssVarClass("--preview-secondary", branding.secondary_color || "#2a2a4a", "preview-secondary");
  const previewButtonTextClass = createCssVarClass("--preview-button-text", branding.background_color || "#0a0a12", "preview-button-text");

  const previewCss = [
    previewBgClass?.css,
    previewBorderClass?.css,
    previewPrimaryClass?.css,
    previewSecondaryClass?.css,
    previewButtonTextClass?.css,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div className="space-y-6">
      <ScopedStyles css={previewCss} />

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

      {/* Theme Mode */}
      <section className="bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg p-6">
        <h2 className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-4">Theme Mode</h2>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="theme_mode"
              value="dark"
              checked={!branding.theme_mode || branding.theme_mode === "dark"}
              onChange={() => setBranding({ ...branding, theme_mode: "dark" })}
              className="w-4 h-4 text-[var(--coral)] border-[var(--twilight)] bg-[var(--night)] focus:ring-[var(--coral)]"
            />
            <span className="font-mono text-sm text-[var(--cream)]">Dark</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="theme_mode"
              value="light"
              checked={branding.theme_mode === "light"}
              onChange={() => setBranding({ ...branding, theme_mode: "light" })}
              className="w-4 h-4 text-[var(--coral)] border-[var(--twilight)] bg-[var(--night)] focus:ring-[var(--coral)]"
            />
            <span className="font-mono text-sm text-[var(--cream)]">Light</span>
          </label>
        </div>
      </section>

      {/* Colors */}
      <section className="bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg p-6">
        <h2 className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-4">Colors</h2>

        <div className="grid grid-cols-3 gap-4 mb-4">
          {[
            { key: "background_color" as const, label: "Background", placeholder: branding.theme_mode === "light" ? "#ffffff" : "#0a0a12" },
            { key: "text_color" as const, label: "Text", placeholder: branding.theme_mode === "light" ? "#1a1a1a" : "#f5f0eb" },
            { key: "muted_color" as const, label: "Muted", placeholder: "#888888" },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">{label}</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={branding[key] || placeholder}
                  onChange={(e) => setBranding({ ...branding, [key]: e.target.value })}
                  className="w-10 h-10 rounded border border-[var(--twilight)] cursor-pointer bg-transparent"
                />
                <input
                  type="text"
                  value={branding[key] || ""}
                  onChange={(e) => setBranding({ ...branding, [key]: e.target.value || undefined })}
                  placeholder={placeholder}
                  className="flex-1 px-2 py-1 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-xs text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-4">
          {[
            { key: "primary_color" as const, label: "Primary/Button", placeholder: "#E87B6B" },
            { key: "accent_color" as const, label: "Accent", placeholder: "#00d4ff" },
            { key: "secondary_color" as const, label: "Border", placeholder: "#2a2a4a" },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">{label}</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={branding[key] || placeholder}
                  onChange={(e) => setBranding({ ...branding, [key]: e.target.value })}
                  className="w-10 h-10 rounded border border-[var(--twilight)] cursor-pointer bg-transparent"
                />
                <input
                  type="text"
                  value={branding[key] || ""}
                  onChange={(e) => setBranding({ ...branding, [key]: e.target.value || undefined })}
                  placeholder={placeholder}
                  className="flex-1 px-2 py-1 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-xs text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Images */}
      <section className="bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg p-6">
        <h2 className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-4">Images</h2>
        <div className="space-y-3">
          <div>
            <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Logo URL</label>
            <input
              type="text"
              value={branding.logo_url || ""}
              onChange={(e) => setBranding({ ...branding, logo_url: e.target.value || undefined })}
              placeholder="https://example.com/logo.png"
              className="w-full px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
            />
          </div>

          <div>
            <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Hero Image URL</label>
            <input
              type="text"
              value={branding.hero_image_url || ""}
              onChange={(e) => setBranding({ ...branding, hero_image_url: e.target.value || undefined })}
              placeholder="https://example.com/hero.jpg"
              className="w-full px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Favicon URL</label>
              <input
                type="text"
                value={branding.favicon_url || ""}
                onChange={(e) => setBranding({ ...branding, favicon_url: e.target.value || undefined })}
                placeholder="https://example.com/favicon.ico"
                className="w-full px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
              />
            </div>
            <div>
              <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">OG Image URL</label>
              <input
                type="text"
                value={branding.og_image_url || ""}
                onChange={(e) => setBranding({ ...branding, og_image_url: e.target.value || undefined })}
                placeholder="https://example.com/og.png"
                className="w-full px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Typography */}
      <section className="bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg p-6">
        <h2 className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-4">Typography</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Heading Font</label>
            <select
              value={branding.font_heading || ""}
              onChange={(e) => setBranding({ ...branding, font_heading: e.target.value || undefined })}
              className="w-full px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
            >
              <option value="">Default (Playfair Display)</option>
              <option value="Playfair Display">Playfair Display</option>
              <option value="Cormorant Garamond">Cormorant Garamond</option>
              <option value="Libre Baskerville">Libre Baskerville</option>
              <option value="Space Grotesk">Space Grotesk</option>
              <option value="Outfit">Outfit</option>
              <option value="Syne">Syne</option>
            </select>
          </div>
          <div>
            <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Body Font</label>
            <select
              value={branding.font_body || ""}
              onChange={(e) => setBranding({ ...branding, font_body: e.target.value || undefined })}
              className="w-full px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
            >
              <option value="">Default (Inter)</option>
              <option value="Inter">Inter</option>
              <option value="DM Sans">DM Sans</option>
              <option value="Space Grotesk">Space Grotesk</option>
              <option value="IBM Plex Sans">IBM Plex Sans</option>
              <option value="Work Sans">Work Sans</option>
              <option value="Nunito">Nunito</option>
            </select>
          </div>
        </div>
      </section>

      {/* Live Preview */}
      {(branding.primary_color || branding.secondary_color || branding.background_color) && (
        <section className="bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg p-6">
          <h2 className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-4">Preview</h2>
          <div
            className={`p-4 rounded-lg border bg-[var(--preview-bg)] border-[var(--preview-border)] ${
              previewBgClass?.className ?? ""
            } ${previewBorderClass?.className ?? ""} ${previewPrimaryClass?.className ?? ""} ${
              previewSecondaryClass?.className ?? ""
            } ${previewButtonTextClass?.className ?? ""}`}
          >
            <div className="font-serif text-lg mb-2 text-[var(--preview-primary)]">
              {name || "Portal Name"}
            </div>
            <div className="font-mono text-sm text-[var(--preview-secondary)]">
              {tagline || "Portal tagline goes here"}
            </div>
            <button className="mt-3 px-4 py-1.5 rounded font-mono text-xs bg-[var(--preview-primary)] text-[var(--preview-button-text)]">
              Sample Button
            </button>
          </div>
        </section>
      )}

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
