import type { CSSProperties } from "react";

/**
 * Single source of truth for the neighborhood detail hero's composition.
 *
 * The gradient is the DESIGNED BASE — atmospheric glow keyed to the
 * neighborhood color, always rendered. If `heroImage` is provided, SmartImage
 * layers on top; otherwise the gradient stands as the full hero. There is no
 * retirement threshold (per product-designer review 2026-04-18).
 *
 * Gradient composition: a radial glow in the neighborhood color over a dark
 * base, plus a bottom vignette that fades into the page surface so a title
 * overlay reads at the bottom of the hero.
 */
export interface NeighborhoodHeroStyle {
  gradient: CSSProperties;
  imageSrc?: string;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return { r, g, b };
}

export function getNeighborhoodHeroStyle(
  color: string,
  heroImage?: string,
): NeighborhoodHeroStyle {
  const { r, g, b } = hexToRgb(color);
  const glow = `rgba(${r}, ${g}, ${b}, 0.35)`;
  const glowSoft = `rgba(${r}, ${g}, ${b}, 0.14)`;

  const gradient: CSSProperties = {
    background: [
      `radial-gradient(ellipse 80% 60% at 30% 40%, ${glow} 0%, transparent 60%)`,
      `radial-gradient(ellipse 70% 60% at 75% 55%, ${glowSoft} 0%, transparent 70%)`,
      `linear-gradient(180deg, #0F0F14 0%, #0A0D15 50%, #09090B 100%)`,
    ].join(", "),
  };

  return {
    gradient,
    imageSrc: heroImage,
  };
}
