"use client";

import { useState, useEffect } from "react";
import type { AmbientEffect, IntensityLevel, SpeedLevel } from "@/lib/visual-presets";

export interface DesignOverrides {
  ambientEffect?: AmbientEffect;
  intensity?: IntensityLevel;
  animationSpeed?: SpeedLevel;
  animationsEnabled?: boolean;
  primaryColor?: string;
  secondaryColor?: string;
  logoUrl?: string;
}

/**
 * Hook to access design tester overrides across components
 *
 * This allows any component to read the current design tester settings
 * and react to changes in real-time.
 */
export function useDesignOverrides(): DesignOverrides {
  const [overrides, setOverrides] = useState<DesignOverrides>({});

  useEffect(() => {
    const loadOverrides = () => {
      if (typeof window === "undefined") return;
      const stored = sessionStorage.getItem("designTesterOverrides");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setOverrides(parsed);
        } catch {
          // Ignore parse errors
          setOverrides({});
        }
      } else {
        setOverrides({});
      }
    };

    loadOverrides();

    const handleOverrideChange = () => {
      loadOverrides();
    };

    window.addEventListener("designOverridesChanged", handleOverrideChange);
    return () => window.removeEventListener("designOverridesChanged", handleOverrideChange);
  }, []);

  return overrides;
}

/**
 * Hook to get the current logo URL with design tester overrides applied
 */
export function useLogoUrl(defaultUrl?: string): string | undefined {
  const overrides = useDesignOverrides();
  return overrides.logoUrl || defaultUrl;
}
