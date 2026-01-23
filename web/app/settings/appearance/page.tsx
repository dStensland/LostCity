"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import UnifiedHeader from "@/components/UnifiedHeader";
import { useTheme } from "@/lib/theme-context";

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
  const { theme, setTheme } = useTheme();
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
        <UnifiedHeader />
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
      <UnifiedHeader />

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
          {/* Theme Section */}
          <section>
            <h2 className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-4">
              Theme
            </h2>

            <div className="grid grid-cols-3 gap-3">
              {/* Dark Theme Option */}
              <button
                onClick={() => setTheme("dark")}
                className={`relative p-4 rounded-lg border-2 transition-all ${
                  theme === "dark"
                    ? "border-[var(--coral)] bg-[var(--dusk)]"
                    : "border-[var(--twilight)] bg-[var(--dusk)]/50 hover:border-[var(--muted)]"
                }`}
              >
                <div className="flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-lg bg-[#09090B] border border-[#252530] flex items-center justify-center">
                    <svg className="w-5 h-5 text-[#FAFAF9]" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 3a9 9 0 109 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 01-4.4 2.26 5.403 5.403 0 01-3.14-9.8c-.44-.06-.9-.1-1.36-.1z" />
                    </svg>
                  </div>
                  <span className="font-mono text-xs text-[var(--cream)]">Dark</span>
                </div>
                {theme === "dark" && (
                  <div className="absolute top-2 right-2">
                    <svg className="w-4 h-4 text-[var(--coral)]" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                    </svg>
                  </div>
                )}
              </button>

              {/* Light Theme Option */}
              <button
                onClick={() => setTheme("light")}
                className={`relative p-4 rounded-lg border-2 transition-all ${
                  theme === "light"
                    ? "border-[var(--coral)] bg-[var(--dusk)]"
                    : "border-[var(--twilight)] bg-[var(--dusk)]/50 hover:border-[var(--muted)]"
                }`}
              >
                <div className="flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-lg bg-[#FAFAF9] border border-[#D6D3D1] flex items-center justify-center">
                    <svg className="w-5 h-5 text-[#CA8A04]" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 7a5 5 0 100 10 5 5 0 000-10zm0-5a1 1 0 011 1v2a1 1 0 11-2 0V3a1 1 0 011-1zm0 18a1 1 0 011 1v2a1 1 0 11-2 0v-2a1 1 0 011-1zm9-9a1 1 0 011 1h2a1 1 0 110 2h-2a1 1 0 01-1-1zm-18 0a1 1 0 011 1H3a1 1 0 110-2h2a1 1 0 011 1zm15.07-6.93a1 1 0 011.41 0l1.42 1.42a1 1 0 11-1.42 1.41l-1.41-1.41a1 1 0 010-1.42zm-12.14 0a1 1 0 011.41 1.41L5.93 6.9a1 1 0 11-1.42-1.41l1.42-1.42zm12.14 12.14a1 1 0 011.41 1.41l-1.41 1.42a1 1 0 11-1.42-1.42l1.42-1.41zm-12.14 0a1 1 0 011.41 0l-1.41 1.41a1 1 0 11-1.42-1.41l1.42-1.41z" />
                    </svg>
                  </div>
                  <span className="font-mono text-xs text-[var(--cream)]">Light</span>
                </div>
                {theme === "light" && (
                  <div className="absolute top-2 right-2">
                    <svg className="w-4 h-4 text-[var(--coral)]" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                    </svg>
                  </div>
                )}
              </button>

              {/* System Theme Option */}
              <button
                onClick={() => setTheme("system")}
                className={`relative p-4 rounded-lg border-2 transition-all ${
                  theme === "system"
                    ? "border-[var(--coral)] bg-[var(--dusk)]"
                    : "border-[var(--twilight)] bg-[var(--dusk)]/50 hover:border-[var(--muted)]"
                }`}
              >
                <div className="flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#09090B] to-[#FAFAF9] border border-[var(--twilight)] flex items-center justify-center">
                    <svg className="w-5 h-5 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <span className="font-mono text-xs text-[var(--cream)]">System</span>
                </div>
                {theme === "system" && (
                  <div className="absolute top-2 right-2">
                    <svg className="w-4 h-4 text-[var(--coral)]" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                    </svg>
                  </div>
                )}
              </button>
            </div>
          </section>

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
