"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface VisualSettings {
  rainEnabled: boolean;
  cursorGlowEnabled: boolean;
  reducedMotion: boolean;
}

interface VisualSettingsContextType {
  settings: VisualSettings;
  setRainEnabled: (enabled: boolean) => void;
  setCursorGlowEnabled: (enabled: boolean) => void;
  setReducedMotion: (enabled: boolean) => void;
}

const defaultSettings: VisualSettings = {
  rainEnabled: true,
  cursorGlowEnabled: true,
  reducedMotion: false,
};

const VisualSettingsContext = createContext<VisualSettingsContextType | null>(null);

const STORAGE_KEY = "lostcity-visual-settings";

export function VisualSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<VisualSettings>(defaultSettings);
  const [mounted, setMounted] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    setMounted(true);

    // Check system preference for reduced motion
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setSettings({
          ...defaultSettings,
          ...parsed,
          // Always respect system reduced motion preference
          reducedMotion: prefersReducedMotion || parsed.reducedMotion,
        });
      } else {
        setSettings({
          ...defaultSettings,
          reducedMotion: prefersReducedMotion,
        });
      }
    } catch (e) {
      console.error("Failed to load visual settings:", e);
    }
  }, []);

  // Save settings to localStorage when they change
  useEffect(() => {
    if (mounted) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      } catch (e) {
        console.error("Failed to save visual settings:", e);
      }
    }
  }, [settings, mounted]);

  const setRainEnabled = (enabled: boolean) => {
    setSettings((prev) => ({ ...prev, rainEnabled: enabled }));
  };

  const setCursorGlowEnabled = (enabled: boolean) => {
    setSettings((prev) => ({ ...prev, cursorGlowEnabled: enabled }));
  };

  const setReducedMotion = (enabled: boolean) => {
    setSettings((prev) => ({ ...prev, reducedMotion: enabled }));
  };

  return (
    <VisualSettingsContext.Provider
      value={{
        settings,
        setRainEnabled,
        setCursorGlowEnabled,
        setReducedMotion,
      }}
    >
      {children}
    </VisualSettingsContext.Provider>
  );
}

export function useVisualSettings() {
  const context = useContext(VisualSettingsContext);
  if (!context) {
    throw new Error("useVisualSettings must be used within a VisualSettingsProvider");
  }
  return context;
}
