"use client";

import { useMemo } from "react";
import type { PortalAmbientConfig } from "@/lib/portal-context";

interface MeshGradientAmbientProps {
  config: Partial<PortalAmbientConfig>;
}

/**
 * Mesh Gradient Ambient Effect
 * Animated mesh/blob gradients that morph and move.
 * CSS-only for performance.
 */
export default function MeshGradientAmbient({ config }: MeshGradientAmbientProps) {
  const primaryColor = config.colors?.primary || "#E855A0";
  const secondaryColor = config.colors?.secondary || "#00D4E8";

  // Animation speed based on config
  const animationDuration = useMemo(() => {
    switch (config.animation_speed) {
      case "slow":
        return "25s";
      case "fast":
        return "10s";
      default:
        return "15s";
    }
  }, [config.animation_speed]);

  // Intensity affects opacity and blur
  const { opacity, blur } = useMemo(() => {
    switch (config.intensity) {
      case "subtle":
        return { opacity: 0.3, blur: 100 };
      case "bold":
        return { opacity: 0.7, blur: 60 };
      default:
        return { opacity: 0.5, blur: 80 };
    }
  }, [config.intensity]);

  return (
    <div
      className="ambient-layer fixed inset-0 pointer-events-none z-0 overflow-hidden"
      aria-hidden="true"
      style={{ filter: `blur(${blur}px)` }}
    >
      {/* Blob 1 - Primary color, top-left */}
      <div
        className="absolute"
        style={{
          width: "60vmax",
          height: "60vmax",
          left: "-10%",
          top: "-20%",
          borderRadius: "40% 60% 70% 30% / 40% 50% 60% 50%",
          background: primaryColor,
          opacity: opacity,
          animation: `mesh-morph-1 ${animationDuration} ease-in-out infinite`,
        }}
      />

      {/* Blob 2 - Secondary color, top-right */}
      <div
        className="absolute"
        style={{
          width: "50vmax",
          height: "50vmax",
          right: "-15%",
          top: "-10%",
          borderRadius: "60% 40% 30% 70% / 60% 30% 70% 40%",
          background: secondaryColor,
          opacity: opacity * 0.8,
          animation: `mesh-morph-2 ${animationDuration} ease-in-out infinite`,
          animationDelay: "-7s",
        }}
      />

      {/* Blob 3 - Primary color, bottom-center */}
      <div
        className="absolute"
        style={{
          width: "45vmax",
          height: "45vmax",
          left: "30%",
          bottom: "-30%",
          borderRadius: "50% 50% 70% 30% / 30% 70% 40% 60%",
          background: primaryColor,
          opacity: opacity * 0.6,
          animation: `mesh-morph-3 ${animationDuration} ease-in-out infinite`,
          animationDelay: "-3s",
        }}
      />

      {/* Blob 4 - Mixed, center */}
      <div
        className="absolute"
        style={{
          width: "40vmax",
          height: "40vmax",
          left: "50%",
          top: "40%",
          transform: "translate(-50%, -50%)",
          borderRadius: "70% 30% 50% 50% / 50% 60% 40% 50%",
          background: `linear-gradient(45deg, ${primaryColor}, ${secondaryColor})`,
          opacity: opacity * 0.4,
          animation: `mesh-morph-4 ${animationDuration} ease-in-out infinite`,
          animationDelay: "-10s",
        }}
      />

      {/* Keyframes */}
      <style>{`
        @keyframes mesh-morph-1 {
          0%, 100% {
            transform: translate(0, 0) rotate(0deg) scale(1);
            border-radius: 40% 60% 70% 30% / 40% 50% 60% 50%;
          }
          33% {
            transform: translate(5%, 5%) rotate(30deg) scale(1.1);
            border-radius: 50% 50% 40% 60% / 60% 40% 50% 50%;
          }
          66% {
            transform: translate(-3%, 2%) rotate(-20deg) scale(0.95);
            border-radius: 60% 40% 50% 50% / 40% 60% 50% 50%;
          }
        }

        @keyframes mesh-morph-2 {
          0%, 100% {
            transform: translate(0, 0) rotate(0deg) scale(1);
            border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%;
          }
          33% {
            transform: translate(-8%, 3%) rotate(-40deg) scale(1.05);
            border-radius: 40% 60% 50% 50% / 50% 50% 50% 50%;
          }
          66% {
            transform: translate(5%, -5%) rotate(20deg) scale(0.9);
            border-radius: 50% 50% 60% 40% / 40% 60% 40% 60%;
          }
        }

        @keyframes mesh-morph-3 {
          0%, 100% {
            transform: translate(0, 0) rotate(0deg) scale(1);
            border-radius: 50% 50% 70% 30% / 30% 70% 40% 60%;
          }
          50% {
            transform: translate(-10%, -5%) rotate(45deg) scale(1.15);
            border-radius: 70% 30% 40% 60% / 60% 40% 60% 40%;
          }
        }

        @keyframes mesh-morph-4 {
          0%, 100% {
            transform: translate(-50%, -50%) rotate(0deg) scale(1);
            border-radius: 70% 30% 50% 50% / 50% 60% 40% 50%;
          }
          33% {
            transform: translate(-50%, -50%) rotate(60deg) scale(1.2);
            border-radius: 50% 50% 30% 70% / 40% 50% 60% 50%;
          }
          66% {
            transform: translate(-50%, -50%) rotate(-30deg) scale(0.85);
            border-radius: 30% 70% 60% 40% / 60% 40% 50% 50%;
          }
        }
      `}</style>
    </div>
  );
}
