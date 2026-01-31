"use client";

import { Suspense, useState, useEffect } from "react";
import { usePortalOptional, DEFAULT_PORTAL } from "@/lib/portal-context";
import { applyPreset } from "@/lib/apply-preset";
import type { AmbientEffect, IntensityLevel, SpeedLevel } from "@/lib/visual-presets";
import SubtleGlowAmbient from "./SubtleGlowAmbient";
import GradientWaveAmbient from "./GradientWaveAmbient";
import ParticleFieldAmbient from "./ParticleFieldAmbient";
import AuroraAmbient from "./AuroraAmbient";
import MeshGradientAmbient from "./MeshGradientAmbient";
import NoiseTextureAmbient from "./NoiseTextureAmbient";
import ShiftingNeighborhoodAmbient from "./ShiftingNeighborhoodAmbient";
import ConstellationAmbient from "./ConstellationAmbient";
import FlowingStreetsAmbient from "./FlowingStreetsAmbient";
import GrowingGardenAmbient from "./GrowingGardenAmbient";

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

  // State for design tester overrides
  const [overrides, setOverrides] = useState<DesignOverrides>({});

  // Listen for design override changes from DesignTesterPanel
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
        }
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

  switch (effect) {
    case "none":
      return null;
    case "subtle_glow":
      return <SubtleGlowAmbient config={ambientConfig} categoryColors={branding.category_colors} />;
    case "gradient_wave":
      return <GradientWaveAmbient config={ambientConfig} />;
    case "particle_field":
      return <ParticleFieldAmbient config={ambientConfig} />;
    case "aurora":
      return <AuroraAmbient config={ambientConfig} />;
    case "mesh_gradient":
      return <MeshGradientAmbient config={ambientConfig} />;
    case "noise_texture":
      return <NoiseTextureAmbient config={ambientConfig} />;
    case "shifting_neighborhood":
      return <ShiftingNeighborhoodAmbient config={ambientConfig} />;
    case "constellation":
      return <ConstellationAmbient config={ambientConfig} />;
    case "flowing_streets":
      return <FlowingStreetsAmbient config={ambientConfig} />;
    case "growing_garden":
      return <GrowingGardenAmbient config={ambientConfig} />;
    default:
      return <SubtleGlowAmbient config={ambientConfig} categoryColors={branding.category_colors} />;
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
