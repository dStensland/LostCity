"use client";

import { Suspense, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { usePortalOptional, DEFAULT_PORTAL } from "@/lib/portal-context";
import { applyPreset } from "@/lib/apply-preset";
import type { AmbientEffect } from "@/lib/visual-presets";

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

/**
 * Smart ambient background selector that renders the appropriate effect
 * based on the portal's branding configuration.
 */
function AmbientBackgroundInner() {
  const portalContext = usePortalOptional();
  const portal = portalContext?.portal ?? DEFAULT_PORTAL;
  const prefersReducedMotion = useSyncExternalStore(
    (callback) => {
      if (typeof window === "undefined" || !window.matchMedia) return () => {};
      const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      const handler = () => callback();
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener("change", handler);
      } else {
        mediaQuery.addListener(handler);
      }
      return () => {
        if (mediaQuery.removeEventListener) {
          mediaQuery.removeEventListener("change", handler);
        } else {
          mediaQuery.removeListener(handler);
        }
      };
    },
    () => {
      if (typeof window === "undefined" || !window.matchMedia) return false;
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    },
    () => false
  );

  // Get the resolved branding with preset defaults applied
  const branding = applyPreset(portal.branding);
  const ambientConfig = branding.ambient;

  // Check for reduced motion preference
  if (prefersReducedMotion) {
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
    case "rain":
      return <RainAmbient key={effect} config={ambientConfig} />;
    case "subtle_glow":
      return <SubtleGlowAmbient key={effect} config={ambientConfig} categoryColors={branding.category_colors} />;
    case "gradient_wave":
      return <GradientWaveAmbient key={effect} config={ambientConfig} />;
    case "particle_field":
      return <ParticleFieldAmbient key={effect} config={ambientConfig} />;
    case "aurora":
      return <AuroraAmbient key={effect} config={ambientConfig} />;
    case "mesh_gradient":
      return <MeshGradientAmbient key={effect} config={ambientConfig} />;
    case "noise_texture":
      return <NoiseTextureAmbient key={effect} config={ambientConfig} />;
    case "shifting_neighborhood":
      return <ShiftingNeighborhoodAmbient key={effect} config={ambientConfig} />;
    case "constellation":
      return <ConstellationAmbient key={effect} config={ambientConfig} />;
    case "flowing_streets":
      return <FlowingStreetsAmbient key={effect} config={ambientConfig} />;
    case "growing_garden":
      return <GrowingGardenAmbient key={effect} config={ambientConfig} />;
    case "floating_leaves":
      return <FloatingLeavesAmbient key={effect} config={ambientConfig} />;
    case "neon_broadway":
      return <NeonBroadwayAmbient key={effect} config={ambientConfig} />;
    default:
      return <SubtleGlowAmbient key={effect} config={ambientConfig} categoryColors={branding.category_colors} />;
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
