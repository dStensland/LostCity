"use client";

import { Suspense, useState, useEffect, lazy, ComponentType } from "react";
import dynamic from "next/dynamic";
import { usePortalOptional, DEFAULT_PORTAL } from "@/lib/portal-context";
import { applyPreset } from "@/lib/apply-preset";
import type { AmbientEffect, IntensityLevel, SpeedLevel } from "@/lib/visual-presets";

// Only load SubtleGlow eagerly since it's the default and most common
import SubtleGlowAmbient from "./SubtleGlowAmbient";

// Dynamic imports for all other effects - loaded only when needed
const GradientWaveAmbient = dynamic(() => import("./GradientWaveAmbient"), { ssr: false });
const ParticleFieldAmbient = dynamic(() => import("./ParticleFieldAmbient"), { ssr: false });
const AuroraAmbient = dynamic(() => import("./AuroraAmbient"), { ssr: false });
const MeshGradientAmbient = dynamic(() => import("./MeshGradientAmbient"), { ssr: false });
const NoiseTextureAmbient = dynamic(() => import("./NoiseTextureAmbient"), { ssr: false });
const ShiftingNeighborhoodAmbient = dynamic(() => import("./ShiftingNeighborhoodAmbient"), { ssr: false });
const ConstellationAmbient = dynamic(() => import("./ConstellationAmbient"), { ssr: false });
const FlowingStreetsAmbient = dynamic(() => import("./FlowingStreetsAmbient"), { ssr: false });
const GrowingGardenAmbient = dynamic(() => import("./GrowingGardenAmbient"), { ssr: false });
const RainAmbient = dynamic(() => import("./RainAmbient"), { ssr: false });
const FloatingLeavesAmbient = dynamic(() => import("./FloatingLeavesAmbient"), { ssr: false });
const NeonBroadwayAmbient = dynamic(() => import("./NeonBroadwayAmbient"), { ssr: false });

interface DesignOverrides {
  ambientEffect?: AmbientEffect;
  intensity?: IntensityLevel;
  animationSpeed?: SpeedLevel;
  animationsEnabled?: boolean;
}

/**
 * Smart ambient background selector that renders the appropriate effect
 * based on the portal's branding configuration.
 * Now supports real-time overrides from DesignTesterPanel.
 */
function AmbientBackgroundInner() {
  const portalContext = usePortalOptional();
  const portal = portalContext?.portal ?? DEFAULT_PORTAL;

  // State for design tester overrides - use a counter to force re-renders
  const [overrides, setOverrides] = useState<DesignOverrides>({});
  const [updateKey, setUpdateKey] = useState(0);

  // Listen for design override changes from DesignTesterPanel
  useEffect(() => {
    const loadOverrides = () => {
      if (typeof window === "undefined") return;
      const stored = sessionStorage.getItem("designTesterOverrides");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setOverrides(parsed);
          setUpdateKey(k => k + 1); // Force re-render
        } catch {
          // Ignore parse errors
        }
      } else {
        setOverrides({});
        setUpdateKey(k => k + 1);
      }
    };

    loadOverrides();

    const handleOverrideChange = () => {
      loadOverrides();
    };

    window.addEventListener("designOverridesChanged", handleOverrideChange);
    return () => window.removeEventListener("designOverridesChanged", handleOverrideChange);
  }, []);

  // Get the resolved branding with preset defaults applied
  const branding = applyPreset(portal.branding);
  let ambientConfig = branding.ambient;

  // Apply design tester overrides
  if (overrides.ambientEffect) {
    ambientConfig = { ...ambientConfig, effect: overrides.ambientEffect };
  }
  if (overrides.intensity) {
    ambientConfig = { ...ambientConfig, intensity: overrides.intensity };
  }
  if (overrides.animationSpeed) {
    ambientConfig = { ...ambientConfig, animation_speed: overrides.animationSpeed };
  }

  // If animations disabled, force effect to none
  if (overrides.animationsEnabled === false) {
    ambientConfig = { ...ambientConfig, effect: "none" };
  }

  // Check for reduced motion preference
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
    // Return a static subtle background for reduced motion
    if (ambientConfig.effect !== "none") {
      return <SubtleGlowAmbient config={{ ...ambientConfig, effect: "subtle_glow" }} categoryColors={branding.category_colors} static />;
    }
    return null;
  }

  // Determine which ambient effect to render
  const effect: AmbientEffect = ambientConfig.effect || "subtle_glow";

  // Use key to force remount when effect changes via design tester
  const componentKey = `${effect}-${updateKey}`;

  switch (effect) {
    case "none":
      return null;
    case "rain":
      return <RainAmbient key={componentKey} config={ambientConfig} />;
    case "subtle_glow":
      return <SubtleGlowAmbient key={componentKey} config={ambientConfig} categoryColors={branding.category_colors} />;
    case "gradient_wave":
      return <GradientWaveAmbient key={componentKey} config={ambientConfig} />;
    case "particle_field":
      return <ParticleFieldAmbient key={componentKey} config={ambientConfig} />;
    case "aurora":
      return <AuroraAmbient key={componentKey} config={ambientConfig} />;
    case "mesh_gradient":
      return <MeshGradientAmbient key={componentKey} config={ambientConfig} />;
    case "noise_texture":
      return <NoiseTextureAmbient key={componentKey} config={ambientConfig} />;
    case "shifting_neighborhood":
      return <ShiftingNeighborhoodAmbient key={componentKey} config={ambientConfig} />;
    case "constellation":
      return <ConstellationAmbient key={componentKey} config={ambientConfig} />;
    case "flowing_streets":
      return <FlowingStreetsAmbient key={componentKey} config={ambientConfig} />;
    case "growing_garden":
      return <GrowingGardenAmbient key={componentKey} config={ambientConfig} />;
    case "floating_leaves":
      return <FloatingLeavesAmbient key={componentKey} config={ambientConfig} />;
    case "neon_broadway":
      return <NeonBroadwayAmbient key={componentKey} config={ambientConfig} />;
    default:
      return <SubtleGlowAmbient key={componentKey} config={ambientConfig} categoryColors={branding.category_colors} />;
  }
}

/**
 * Ambient Background - Renders the appropriate ambient effect based on portal branding.
 *
 * Effect Types:
 * - none: No ambient effect
 * - subtle_glow: Current category-based glow (default)
 * - gradient_wave: Animated gradient waves
 * - particle_field: Floating CSS particles
 * - aurora: Northern lights effect
 * - mesh_gradient: Animated mesh gradients
 * - noise_texture: Subtle animated noise
 * - shifting_neighborhood: Abstract cityscape with sliding geometric buildings
 * - constellation: Dots connected by lines that fade in/out
 * - flowing_streets: Organic flowing lines like winding streets
 * - growing_garden: Botanical shapes that grow, bloom, and fade
 */
export default function AmbientBackground() {
  return (
    <Suspense fallback={null}>
      <AmbientBackgroundInner />
    </Suspense>
  );
}
