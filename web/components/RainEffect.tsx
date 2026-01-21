"use client";

import { useState, useEffect } from "react";

/**
 * Rain overlay effect that creates an atmospheric rainy night feel.
 * Reads from localStorage for enabled state.
 * CSS handles reduced-motion preferences.
 */
export default function RainEffect() {
  const [isEnabled, setIsEnabled] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check localStorage for setting
    const stored = localStorage.getItem("lostcity-visual-settings");
    if (stored) {
      try {
        const settings = JSON.parse(stored);
        setIsEnabled(settings.rainEnabled !== false);
      } catch (e) {
        // Fallback to legacy key
        const legacy = localStorage.getItem("lostcity-rain-enabled");
        if (legacy !== null) {
          setIsEnabled(legacy === "true");
        }
      }
    }

    // Listen for changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "lostcity-visual-settings" && e.newValue) {
        try {
          const settings = JSON.parse(e.newValue);
          setIsEnabled(settings.rainEnabled !== false);
        } catch (e) {
          // ignore
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // Don't render until mounted to avoid hydration mismatch
  if (!mounted) {
    return <div className="rain-overlay" aria-hidden="true" />;
  }

  if (!isEnabled) {
    return null;
  }

  return <div className="rain-overlay" aria-hidden="true" />;
}

/**
 * Hook to toggle rain effect preference.
 * Returns [isEnabled, toggle] tuple.
 */
export function useRainToggle(): [boolean, () => void] {
  const [isEnabled, setIsEnabled] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("lostcity-visual-settings");
    if (stored) {
      try {
        const settings = JSON.parse(stored);
        setIsEnabled(settings.rainEnabled !== false);
      } catch (e) {
        // Fallback to legacy key
        const legacy = localStorage.getItem("lostcity-rain-enabled");
        if (legacy !== null) {
          setIsEnabled(legacy === "true");
        }
      }
    }
  }, []);

  const toggle = () => {
    const newValue = !isEnabled;
    setIsEnabled(newValue);

    // Update in new settings format
    try {
      const stored = localStorage.getItem("lostcity-visual-settings");
      const settings = stored ? JSON.parse(stored) : {};
      settings.rainEnabled = newValue;
      localStorage.setItem("lostcity-visual-settings", JSON.stringify(settings));
    } catch (e) {
      // Fallback
      localStorage.setItem("lostcity-rain-enabled", String(newValue));
    }

    // Dispatch custom event for other components to listen
    window.dispatchEvent(new CustomEvent("rain-toggle", { detail: newValue }));
  };

  return [isEnabled, toggle];
}
