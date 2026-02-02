"use client";

import { useMemo } from "react";
import type { PortalAmbientConfig } from "@/lib/portal-context";

interface ParticleFieldAmbientProps {
  config: Partial<PortalAmbientConfig>;
}

/**
 * Deterministic pseudo-random number generator (seeded)
 * Uses a simple linear congruential generator for consistency
 */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

/**
 * Particle Field Ambient Effect
 * Floating particles using CSS animations.
 * Performance-optimized with CSS-only animations.
 */
export default function ParticleFieldAmbient({ config }: ParticleFieldAmbientProps) {
  const primaryColor = config.colors?.primary || "#ff00ff";
  const secondaryColor = config.colors?.secondary || "#00ffff";
  const particleCount = config.particle_count || 30;

  // Animation speed multiplier
  const speedMultiplier = useMemo(() => {
    switch (config.animation_speed) {
      case "slow":
        return 2;
      case "fast":
        return 0.5;
      default:
        return 1;
    }
  }, [config.animation_speed]);

  // Intensity affects particle size and opacity
  const { opacity, sizeMultiplier } = useMemo(() => {
    switch (config.intensity) {
      case "subtle":
        return { opacity: 0.25, sizeMultiplier: 1.5 }; // More subtle but larger
      case "bold":
        return { opacity: 0.7, sizeMultiplier: 2.5 };
      default:
        return { opacity: 0.4, sizeMultiplier: 2 };
    }
  }, [config.intensity]);

  // Generate particles with deterministic properties based on index
  const particles = useMemo(() => {
    // Use a seeded random generator for deterministic but varied particles
    const random = seededRandom(42); // Fixed seed for consistency

    return Array.from({ length: particleCount }, (_, i) => ({
      id: i,
      left: `${random() * 100}%`,
      top: `${random() * 100}%`,
      size: (8 + random() * 16) * sizeMultiplier, // Larger base size (8-24px)
      duration: (20 + random() * 30) * speedMultiplier, // Slower, more gentle
      delay: random() * -25,
      color: random() > 0.5 ? primaryColor : secondaryColor,
    }));
  }, [particleCount, primaryColor, secondaryColor, speedMultiplier, sizeMultiplier]);

  return (
    <div
      className="ambient-layer fixed inset-0 pointer-events-none z-0 overflow-hidden"
      aria-hidden="true"
    >
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute rounded-full"
          style={{
            left: particle.left,
            top: particle.top,
            width: particle.size,
            height: particle.size,
            backgroundColor: particle.color,
            opacity: opacity,
            boxShadow: `0 0 ${particle.size * 0.5}px ${particle.color}40`, // Softer glow
            animation: `particle-float ${particle.duration}s ease-in-out infinite`,
            animationDelay: `${particle.delay}s`,
          }}
        />
      ))}

      {/* Keyframes injected via style tag */}
      <style>{`
        @keyframes particle-float {
          0%, 100% {
            transform: translate(0, 0) scale(1);
            opacity: ${opacity};
          }
          25% {
            transform: translate(${20 * speedMultiplier}px, -${30 * speedMultiplier}px) scale(1.1);
            opacity: ${opacity * 0.8};
          }
          50% {
            transform: translate(${-10 * speedMultiplier}px, ${20 * speedMultiplier}px) scale(0.9);
            opacity: ${opacity * 1.2};
          }
          75% {
            transform: translate(${-20 * speedMultiplier}px, -${10 * speedMultiplier}px) scale(1.05);
            opacity: ${opacity * 0.9};
          }
        }
      `}</style>
    </div>
  );
}
