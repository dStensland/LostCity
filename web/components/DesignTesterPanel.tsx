"use client";

import { useState, useEffect, useCallback, memo } from "react";
import Image from "next/image";
import { usePortalOptional } from "@/lib/portal-context";
import type {
  AmbientEffect,
  IntensityLevel,
  SpeedLevel,
} from "@/lib/visual-presets";

interface DesignOverrides {
  ambientEffect?: AmbientEffect;
  intensity?: IntensityLevel;
  animationSpeed?: SpeedLevel;
  animationsEnabled?: boolean;
  primaryColor?: string;
  secondaryColor?: string;
  logoUrl?: string;
}

/**
 * Design Tester Panel - Developer/Admin tool for testing branding in real-time
 *
 * Features:
 * - Background animation selector (all 7 options)
 * - Logo selector/uploader
 * - Intensity slider (subtle/medium/bold)
 * - Animation speed (slow/medium/fast)
 * - Toggle animation on/off
 * - Copy config button
 *
 * Only visible in development mode or for admin users
 */
export const DesignTesterPanel = memo(function DesignTesterPanel() {
  const portalContext = usePortalOptional();
  const [isOpen, setIsOpen] = useState(false);
  const [overrides, setOverrides] = useState<DesignOverrides>({});
  const [mounted, setMounted] = useState(false);

  // Track mounted state for SSR
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- SSR hydration pattern
    setMounted(true);
  }, []);

  // Check if design tester should be enabled (only check after mount)
  const isEnabled = mounted && (
    typeof window !== "undefined" && (
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.search.includes("design=1")
    )
  );

  // Keyboard shortcut to toggle panel (Ctrl+. or Cmd+.)
  useEffect(() => {
    if (!isEnabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === ".") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isEnabled]);

  // Apply CSS overrides when settings change
  useEffect(() => {
    if (Object.keys(overrides).length === 0) return;

    const root = document.documentElement;

    // Apply color overrides
    if (overrides.primaryColor) {
      root.style.setProperty("--portal-primary", overrides.primaryColor);
      root.style.setProperty("--neon-magenta", overrides.primaryColor);
      root.style.setProperty("--coral", overrides.primaryColor);
    }

    if (overrides.secondaryColor) {
      root.style.setProperty("--portal-secondary", overrides.secondaryColor);
      root.style.setProperty("--neon-cyan", overrides.secondaryColor);
    }

    // Store overrides in sessionStorage for ambient component to read
    sessionStorage.setItem("designTesterOverrides", JSON.stringify(overrides));

    // Trigger a custom event to notify ambient components
    window.dispatchEvent(new CustomEvent("designOverridesChanged"));

    return () => {
      // Don't cleanup on unmount - allow overrides to persist during session
    };
  }, [overrides]);

  const handleAmbientChange = useCallback((effect: AmbientEffect) => {
    setOverrides((prev) => ({ ...prev, ambientEffect: effect }));
  }, []);

  const handleIntensityChange = useCallback((intensity: IntensityLevel) => {
    setOverrides((prev) => ({ ...prev, intensity }));
  }, []);

  const handleSpeedChange = useCallback((speed: SpeedLevel) => {
    setOverrides((prev) => ({ ...prev, animationSpeed: speed }));
  }, []);

  const handleToggleAnimation = useCallback(() => {
    setOverrides((prev) => ({
      ...prev,
      animationsEnabled: !(prev.animationsEnabled ?? true),
    }));
  }, []);

  const handlePrimaryColorChange = useCallback((color: string) => {
    setOverrides((prev) => ({ ...prev, primaryColor: color }));
  }, []);

  const handleSecondaryColorChange = useCallback((color: string) => {
    setOverrides((prev) => ({ ...prev, secondaryColor: color }));
  }, []);

  const handleLogoChange = useCallback((url: string) => {
    setOverrides((prev) => ({ ...prev, logoUrl: url }));
  }, []);

  const handleCopyConfig = useCallback(() => {
    const config = {
      ambient: {
        effect: overrides.ambientEffect,
        intensity: overrides.intensity,
        animation_speed: overrides.animationSpeed,
      },
      branding: {
        primary_color: overrides.primaryColor,
        secondary_color: overrides.secondaryColor,
        logo_url: overrides.logoUrl,
      },
    };

    navigator.clipboard.writeText(JSON.stringify(config, null, 2));
    alert("Configuration copied to clipboard!");
  }, [overrides]);

  const handleReset = useCallback(() => {
    setOverrides({});
    sessionStorage.removeItem("designTesterOverrides");
    window.dispatchEvent(new CustomEvent("designOverridesChanged"));

    // Reset CSS variables
    const root = document.documentElement;
    root.style.removeProperty("--portal-primary");
    root.style.removeProperty("--neon-magenta");
    root.style.removeProperty("--coral");
    root.style.removeProperty("--portal-secondary");
    root.style.removeProperty("--neon-cyan");
  }, []);

  // Don't render if not enabled
  if (!isEnabled) return null;

  const portal = portalContext?.portal;
  const currentAmbient = overrides.ambientEffect || portal?.branding?.ambient?.effect || "subtle_glow";
  const currentIntensity = overrides.intensity || portal?.branding?.ambient?.intensity || "medium";
  const currentSpeed = overrides.animationSpeed || portal?.branding?.ambient?.animation_speed || "medium";
  const animationsEnabled = overrides.animationsEnabled ?? true;
  const currentPrimaryColor = overrides.primaryColor || (portal?.branding?.primary_color as string) || "#E855A0";
  const currentSecondaryColor = overrides.secondaryColor || (portal?.branding?.secondary_color as string) || "#00D4E8";

  return (
    <div className="fixed top-4 left-4 z-[9999]">
      {/* Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-400 text-black shadow-lg ring-2 ring-yellow-300 transition-transform hover:scale-110 hover:shadow-xl"
          title="Design Tester"
        >
          <svg
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
            />
          </svg>
        </button>
      )}

      {/* Panel */}
      {isOpen && (
        <div className="w-80 rounded-lg border-2 border-yellow-400 bg-gradient-to-br from-dusk/95 to-night/95 p-4 shadow-2xl backdrop-blur-md">
          {/* Header */}
          <div className="mb-4 flex items-center justify-between border-b border-twilight/30 pb-3">
            <h3 className="text-sm font-semibold text-cream">
              Design Tester
            </h3>
            <div className="flex gap-2">
              <button
                onClick={handleReset}
                className="text-xs text-muted hover:text-cream transition-colors"
                title="Reset to defaults"
              >
                Reset
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="text-muted hover:text-cream transition-colors"
                title="Close (Ctrl+Shift+D)"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-twilight scrollbar-track-transparent">
            {/* Background Animation Selector */}
            <div>
              <label className="mb-2 block text-xs font-medium text-soft">
                Background Animation
              </label>
              <select
                value={currentAmbient}
                onChange={(e) => handleAmbientChange(e.target.value as AmbientEffect)}
                className="w-full rounded bg-twilight/50 px-3 py-2 text-sm text-cream border border-twilight/50 focus:border-neon-magenta/50 focus:outline-none focus:ring-1 focus:ring-neon-magenta/50"
              >
                <option value="none">None</option>
                <option value="rain">Rain (Neon Streaks)</option>
                <option value="subtle_glow">Subtle Glow</option>
                <option value="gradient_wave">Gradient Wave</option>
                <option value="particle_field">Particle Field</option>
                <option value="aurora">Aurora</option>
                <option value="mesh_gradient">Mesh Gradient</option>
                <option value="noise_texture">Noise Texture</option>
                <option value="shifting_neighborhood">Shifting Neighborhood</option>
                <option value="constellation">Constellation</option>
                <option value="flowing_streets">Flowing Streets</option>
                <option value="growing_garden">Growing Garden</option>
                <option value="floating_leaves">Floating Leaves</option>
              </select>
            </div>

            {/* Intensity Slider */}
            <div>
              <label className="mb-2 block text-xs font-medium text-soft">
                Intensity: <span className="text-neon-cyan">{currentIntensity}</span>
              </label>
              <div className="flex gap-2">
                {(["subtle", "medium", "bold"] as IntensityLevel[]).map((level) => (
                  <button
                    key={level}
                    onClick={() => handleIntensityChange(level)}
                    className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                      currentIntensity === level
                        ? "bg-neon-magenta text-white"
                        : "bg-twilight/50 text-muted hover:bg-twilight hover:text-cream"
                    }`}
                  >
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Animation Speed */}
            <div>
              <label className="mb-2 block text-xs font-medium text-soft">
                Animation Speed: <span className="text-neon-cyan">{currentSpeed}</span>
              </label>
              <div className="flex gap-2">
                {(["slow", "medium", "fast"] as SpeedLevel[]).map((speed) => (
                  <button
                    key={speed}
                    onClick={() => handleSpeedChange(speed)}
                    className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                      currentSpeed === speed
                        ? "bg-neon-cyan text-night"
                        : "bg-twilight/50 text-muted hover:bg-twilight hover:text-cream"
                    }`}
                  >
                    {speed.charAt(0).toUpperCase() + speed.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Toggle Animation */}
            <div>
              <label className="flex items-center justify-between">
                <span className="text-xs font-medium text-soft">
                  Animations Enabled
                </span>
                <button
                  onClick={handleToggleAnimation}
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    animationsEnabled ? "bg-neon-green" : "bg-twilight"
                  }`}
                >
                  <span
                    className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-transform ${
                      animationsEnabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </label>
            </div>

            {/* Primary Color */}
            <div>
              <label className="mb-2 block text-xs font-medium text-soft">
                Primary Color
              </label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={currentPrimaryColor}
                  onChange={(e) => handlePrimaryColorChange(e.target.value)}
                  className="h-10 w-14 rounded border border-twilight/50 bg-twilight/30 cursor-pointer"
                />
                <input
                  type="text"
                  value={currentPrimaryColor}
                  onChange={(e) => handlePrimaryColorChange(e.target.value)}
                  className="flex-1 rounded bg-twilight/50 px-3 py-2 text-sm text-cream border border-twilight/50 focus:border-neon-magenta/50 focus:outline-none focus:ring-1 focus:ring-neon-magenta/50 font-mono"
                  placeholder="#E855A0"
                />
              </div>
            </div>

            {/* Secondary Color */}
            <div>
              <label className="mb-2 block text-xs font-medium text-soft">
                Secondary Color
              </label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={currentSecondaryColor}
                  onChange={(e) => handleSecondaryColorChange(e.target.value)}
                  className="h-10 w-14 rounded border border-twilight/50 bg-twilight/30 cursor-pointer"
                />
                <input
                  type="text"
                  value={currentSecondaryColor}
                  onChange={(e) => handleSecondaryColorChange(e.target.value)}
                  className="flex-1 rounded bg-twilight/50 px-3 py-2 text-sm text-cream border border-twilight/50 focus:border-neon-cyan/50 focus:outline-none focus:ring-1 focus:ring-neon-cyan/50 font-mono"
                  placeholder="#00D4E8"
                />
              </div>
            </div>

            {/* Logo URL */}
            <div>
              <label className="mb-2 block text-xs font-medium text-soft">
                Logo URL
              </label>
              <input
                type="text"
                value={overrides.logoUrl || ""}
                onChange={(e) => handleLogoChange(e.target.value)}
                placeholder={portal?.branding?.logo_url as string || "https://..."}
                className="w-full rounded bg-twilight/50 px-3 py-2 text-sm text-cream border border-twilight/50 focus:border-neon-magenta/50 focus:outline-none focus:ring-1 focus:ring-neon-magenta/50"
              />
              {overrides.logoUrl && (
                <div className="mt-2 flex items-center justify-center rounded bg-twilight/30 p-2">
                  <Image
                    src={overrides.logoUrl}
                    alt="Logo preview"
                    width={200}
                    height={48}
                    className="max-h-12 max-w-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
              )}
            </div>

            {/* Copy Config Button */}
            <button
              onClick={handleCopyConfig}
              className="w-full rounded bg-gradient-to-r from-neon-magenta/90 to-neon-cyan/90 px-4 py-2 text-sm font-medium text-white transition-all hover:from-neon-magenta hover:to-neon-cyan hover:shadow-lg"
            >
              Copy Config JSON
            </button>

            {/* Info */}
            <div className="rounded bg-twilight/30 p-3 text-xs text-soft">
              <p className="mb-1 font-medium text-cream">Tips:</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>Changes are temporary (refresh resets)</li>
                <li>Press Ctrl+Shift+D to toggle panel</li>
                <li>Copy config to save settings</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export type { DesignOverrides };
