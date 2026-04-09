"use client";

import { useMemo } from "react";
import ShaderCanvas from "./ShaderCanvas";
import { WARPED_NOISE_FRAG } from "@/lib/shaders/warped-noise";

interface WarpedNoiseBackgroundProps {
  /** Primary color as [r, g, b] in 0-1 range */
  color1?: [number, number, number];
  /** Secondary color as [r, g, b] in 0-1 range */
  color2?: [number, number, number];
  /** Speed multiplier (default 1.0) */
  speed?: number;
  /** Brightness multiplier (default 0.4 — subtle for backgrounds) */
  intensity?: number;
  /** Resolution scale (default 0.5 — half res for performance) */
  resolutionScale?: number;
  className?: string;
}

/** Convert hex color to [r, g, b] in 0-1 range */
export function hexToVec3(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

const DEFAULT_COLOR1 = hexToVec3("#FF6B7A"); // coral
const DEFAULT_COLOR2 = hexToVec3("#4A1942"); // deep purple

export default function WarpedNoiseBackground({
  color1 = DEFAULT_COLOR1,
  color2 = DEFAULT_COLOR2,
  speed = 1.0,
  intensity = 0.4,
  resolutionScale = 0.5,
  className = "absolute inset-0 -z-10",
}: WarpedNoiseBackgroundProps) {
  const uniforms = useMemo(
    () => ({
      u_color1: color1,
      u_color2: color2,
      u_speed: speed,
      u_intensity: intensity,
    }),
    [color1, color2, speed, intensity],
  );

  return (
    <ShaderCanvas
      fragmentShader={WARPED_NOISE_FRAG}
      uniforms={uniforms}
      resolutionScale={resolutionScale}
      className={className}
      fallbackGradient={`radial-gradient(ellipse at 30% 40%, rgba(${Math.round(color1[0] * 255)},${Math.round(color1[1] * 255)},${Math.round(color1[2] * 255)},0.15), transparent 60%)`}
    />
  );
}
