"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Rain overlay effect that creates an atmospheric rainy night feel.
 * Reads from localStorage for enabled state.
 * CSS handles reduced-motion preferences.
 *
 * NOTE: This is the GLOBAL rain effect in the root layout.
 * When the design tester is active, this hides itself and lets
 * the AmbientBackground system handle all effects (including rain).
 */
export default function RainEffect() {
  const [isEnabled, setIsEnabled] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [designTesterActive, setDesignTesterActive] = useState(false);
  const [portalSuppressed, setPortalSuppressed] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- SSR hydration pattern
    setMounted(true);

    const syncPortalSuppression = () => {
      const body = document.body;
      const explicitVertical = body.dataset.vertical;
      const inferredVertical = document.querySelector<HTMLElement>("[data-vertical]")?.dataset.vertical;
      const vertical = explicitVertical || inferredVertical;
      const forthBg = body.dataset.forthBg;
      const forthExperience = body.dataset.forthExperience === "true";
      const hasForthExperience = Boolean(document.querySelector("[data-forth-experience='true']"));
      const isHospitalPath = pathname.startsWith("/emory-demo") || pathname.includes("/hospitals");
      const shouldSuppress =
        vertical === "film" ||
        vertical === "hotel" ||
        vertical === "hospital" ||
        forthBg === "off" ||
        forthExperience ||
        hasForthExperience ||
        isHospitalPath;
      setPortalSuppressed(shouldSuppress);
    };
    syncPortalSuppression();

    // Observe portal attributes and route-level tree changes.
    const observer = new MutationObserver(() => {
      syncPortalSuppression();
    });
    observer.observe(document.documentElement, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: ["data-vertical", "data-forth-bg", "data-forth-experience"],
    });

    // Check if design tester has overrides
    const checkDesignTester = () => {
      const stored = sessionStorage.getItem("designTesterOverrides");
      if (stored) {
        try {
          const overrides = JSON.parse(stored);
          // If design tester has any ambient effect set, hide global rain
          setDesignTesterActive(!!overrides.ambientEffect);
        } catch {
          setDesignTesterActive(false);
        }
      } else {
        setDesignTesterActive(false);
      }
    };

    checkDesignTester();

    // Listen for design tester changes
    const handleDesignChange = () => {
      checkDesignTester();
    };
    window.addEventListener("designOverridesChanged", handleDesignChange);

    // Check localStorage for setting
    const stored = localStorage.getItem("lostcity-visual-settings");
    if (stored) {
      try {
        const settings = JSON.parse(stored);
        setIsEnabled(settings.rainEnabled !== false);
      } catch {
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
        } catch {
          // ignore
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("designOverridesChanged", handleDesignChange);
      observer.disconnect();
    };
  }, [pathname]);

  // Don't render until mounted to avoid hydration mismatch.
  if (!mounted) {
    return null;
  }

  // Hide if design tester is controlling ambient effects
  if (designTesterActive) {
    return null;
  }

  // Hide for portals that explicitly suppress rain (e.g., hotel/FORTH).
  if (portalSuppressed) {
    return null;
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
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Sync with localStorage
        setIsEnabled(settings.rainEnabled !== false);
      } catch {
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
    } catch {
      // Fallback
      localStorage.setItem("lostcity-rain-enabled", String(newValue));
    }

    // Dispatch custom event for other components to listen
    window.dispatchEvent(new CustomEvent("rain-toggle", { detail: newValue }));
  };

  return [isEnabled, toggle];
}
