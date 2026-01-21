"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";

type VisualSettings = {
  rainEnabled: boolean;
  cursorGlowEnabled: boolean;
  reducedMotion: boolean;
};

const STORAGE_KEY = "lostcity-visual-settings";

const defaultSettings: VisualSettings = {
  rainEnabled: true,
  cursorGlowEnabled: true,
  reducedMotion: false,
};

export default function AppearancePage() {
  const [settings, setSettings] = useState<VisualSettings>(defaultSettings);
  const [mounted, setMounted] = useState(false);
  const [saved, setSaved] = useState(false);

  // Load settings on mount
  useEffect(() => {
    setMounted(true);

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setSettings({
          ...defaultSettings,
          ...parsed,
          reducedMotion: prefersReducedMotion || parsed.reducedMotion,
        });
      } else {
        setSettings({
          ...defaultSettings,
          reducedMotion: prefersReducedMotion,
        });
      }
    } catch (e) {
      console.error("Failed to load settings:", e);
    }
  }, []);

  const updateSetting = <K extends keyof VisualSettings>(key: K, value: VisualSettings[K]) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
      // Trigger storage event for other tabs/components
      window.dispatchEvent(new StorageEvent("storage", {
        key: STORAGE_KEY,
        newValue: JSON.stringify(newSettings),
      }));
    } catch (e) {
      console.error("Failed to save settings:", e);
    }

    // Show saved indicator
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!mounted) {
    return (
      <div className="min-h-screen">
        <PageHeader />
        <main className="max-w-2xl mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-8 w-48 bg-[var(--twilight)] rounded mb-8" />
            <div className="space-y-4">
              <div className="h-20 bg-[var(--twilight)] rounded-lg" />
              <div className="h-20 bg-[var(--twilight)] rounded-lg" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <PageHeader />

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-serif text-2xl text-[var(--cream)] italic">
            Appearance
          </h1>
          {saved && (
            <span className="px-2 py-1 text-xs font-mono text-[var(--neon-green)] bg-[var(--neon-green)]/10 rounded">
              Saved
            </span>
          )}
        </div>

        <div className="space-y-6">
          {/* Atmospheric Effects Section */}
          <section>
            <h2 className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-4">
              Atmospheric Effects
            </h2>

            <div className="space-y-3">
              {/* Rain Effect Toggle */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)]">
                <div className="flex items-center gap-3">
                  <span className="text-xl">🌧️</span>
                  <div>
                    <h3 className="font-mono text-sm font-medium text-[var(--cream)]">
                      Rain Effect
                    </h3>
                    <p className="font-mono text-xs text-[var(--muted)] mt-0.5">
                      Subtle animated rain overlay for atmosphere
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => updateSetting("rainEnabled", !settings.rainEnabled)}
                  className={`relative w-12 h-7 rounded-full transition-colors ${
                    settings.rainEnabled
                      ? "bg-[var(--coral)]"
                      : "bg-[var(--twilight)]"
                  }`}
                  aria-label={`Rain effect ${settings.rainEnabled ? "enabled" : "disabled"}`}
                >
                  <span
                    className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      settings.rainEnabled ? "left-6" : "left-1"
                    }`}
                  />
                </button>
              </div>

              {/* Cursor Glow Toggle */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)]">
                <div className="flex items-center gap-3">
                  <span className="text-xl">✨</span>
                  <div>
                    <h3 className="font-mono text-sm font-medium text-[var(--cream)]">
                      Cursor Glow
                    </h3>
                    <p className="font-mono text-xs text-[var(--muted)] mt-0.5">
                      Subtle glow effect following your cursor
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => updateSetting("cursorGlowEnabled", !settings.cursorGlowEnabled)}
                  className={`relative w-12 h-7 rounded-full transition-colors ${
                    settings.cursorGlowEnabled
                      ? "bg-[var(--coral)]"
                      : "bg-[var(--twilight)]"
                  }`}
                  aria-label={`Cursor glow ${settings.cursorGlowEnabled ? "enabled" : "disabled"}`}
                >
                  <span
                    className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      settings.cursorGlowEnabled ? "left-6" : "left-1"
                    }`}
                  />
                </button>
              </div>
            </div>
          </section>

          {/* Accessibility Section */}
          <section>
            <h2 className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-4">
              Accessibility
            </h2>

            <div className="space-y-3">
              {/* Reduced Motion Toggle */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)]">
                <div className="flex items-center gap-3">
                  <span className="text-xl">🎯</span>
                  <div>
                    <h3 className="font-mono text-sm font-medium text-[var(--cream)]">
                      Reduce Motion
                    </h3>
                    <p className="font-mono text-xs text-[var(--muted)] mt-0.5">
                      Disable animations and transitions
                    </p>
                    {window.matchMedia("(prefers-reduced-motion: reduce)").matches && (
                      <p className="font-mono text-[0.65rem] text-[var(--neon-green)] mt-1">
                        System preference detected
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => updateSetting("reducedMotion", !settings.reducedMotion)}
                  className={`relative w-12 h-7 rounded-full transition-colors ${
                    settings.reducedMotion
                      ? "bg-[var(--coral)]"
                      : "bg-[var(--twilight)]"
                  }`}
                  aria-label={`Reduced motion ${settings.reducedMotion ? "enabled" : "disabled"}`}
                >
                  <span
                    className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      settings.reducedMotion ? "left-6" : "left-1"
                    }`}
                  />
                </button>
              </div>
            </div>
          </section>

          {/* Preview Section */}
          <section>
            <h2 className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-4">
              Preview
            </h2>
            <div className="relative p-6 rounded-lg bg-[var(--card-bg)] border border-[var(--twilight)] overflow-hidden">
              {settings.rainEnabled && (
                <div className="rain-overlay absolute inset-0 rounded-lg" style={{ opacity: 0.15 }} />
              )}
              <div className="relative text-center">
                <p className="font-mono text-sm text-[var(--cream)]">
                  This is how cards will look
                </p>
                <p className="font-mono text-xs text-[var(--muted)] mt-1">
                  Rain: {settings.rainEnabled ? "On" : "Off"} ·
                  Cursor Glow: {settings.cursorGlowEnabled ? "On" : "Off"}
                </p>
              </div>
            </div>
          </section>

          {/* Back Link */}
          <div className="pt-4">
            <Link
              href="/settings"
              className="inline-flex items-center gap-2 font-mono text-sm text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Settings
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
