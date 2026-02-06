"use client";

import { useId } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClass } from "@/lib/css-utils";
import type { PortalAmbientConfig } from "@/lib/portal-context";

// Default category color mapping for ambient glow
const DEFAULT_CATEGORY_COLORS: Record<string, string> = {
  music: "rgba(255, 107, 122, 0.15)",
  comedy: "rgba(255, 200, 87, 0.15)",
  art: "rgba(200, 162, 255, 0.15)",
  theater: "rgba(255, 107, 122, 0.12)",
  film: "rgba(100, 200, 255, 0.12)",
  community: "rgba(100, 255, 180, 0.12)",
  food_drink: "rgba(255, 180, 100, 0.12)",
  food: "rgba(255, 180, 100, 0.12)",
  sports: "rgba(100, 200, 100, 0.12)",
  fitness: "rgba(100, 255, 200, 0.12)",
  nightlife: "rgba(200, 100, 255, 0.15)",
  family: "rgba(255, 200, 150, 0.12)",
  default: "rgba(255, 107, 122, 0.08)",
};

interface SubtleGlowAmbientProps {
  config: Partial<PortalAmbientConfig>;
  categoryColors?: Record<string, string>;
  /** Render as static (no animations) for reduced motion */
  static?: boolean;
}

/**
 * Convert hex color to rgba
 */
function hexToRgba(hex: string, alpha: number): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return `rgba(255, 107, 122, ${alpha})`;

  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Compute the ambient color based on context
 */
function computeAmbientColor(
  pathname: string | null,
  categoryParam: string | null,
  config: Partial<PortalAmbientConfig>,
  categoryColors?: Record<string, string>
): string {
  // Build colors map with overrides
  const colors = { ...DEFAULT_CATEGORY_COLORS };
  if (categoryColors) {
    for (const [category, hexColor] of Object.entries(categoryColors)) {
      const opacity = config.intensity === "bold" ? 0.2 : config.intensity === "subtle" ? 0.08 : 0.15;
      colors[category] = hexToRgba(hexColor, opacity);
    }
  }

  let color = colors.default;

  // Use custom primary color from config if provided
  if (config.colors?.primary) {
    const opacity = config.intensity === "bold" ? 0.2 : config.intensity === "subtle" ? 0.08 : 0.15;
    color = hexToRgba(config.colors.primary, opacity);
  } else {
    // Check for category in URL params
    if (categoryParam) {
      const category = categoryParam.split(",")[0];
      if (colors[category]) {
        color = colors[category];
      }
    }

    // Check for category-specific pages
    if (pathname?.includes("/music")) {
      color = colors.music;
    } else if (pathname?.includes("/comedy")) {
      color = colors.comedy;
    } else if (pathname?.includes("/art")) {
      color = colors.art;
    } else if (pathname?.includes("/film") || pathname?.includes("/movies")) {
      color = colors.film;
    } else if (pathname?.includes("/food") || pathname?.includes("/dining")) {
      color = colors.food_drink;
    } else if (pathname?.includes("/nightlife")) {
      color = colors.nightlife;
    } else if (pathname?.includes("/sports")) {
      color = colors.sports;
    } else if (pathname?.includes("/community")) {
      color = colors.community;
    }
  }

  // Apply intensity adjustment
  if (config.intensity && config.intensity !== "medium") {
    const match = color.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
    if (match) {
      const [, r, g, b, a] = match;
      let opacity = parseFloat(a);

      if (config.intensity === "subtle") {
        opacity = opacity * 0.6;
      } else if (config.intensity === "bold") {
        opacity = Math.min(0.3, opacity * 1.5);
      }

      color = `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
  }

  return color;
}

/**
 * Subtle Glow Ambient Effect
 * Dynamic glow that changes based on current category/context.
 * Supports portal-specific category color overrides.
 */
export default function SubtleGlowAmbient({
  config,
  categoryColors,
}: SubtleGlowAmbientProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const categoryParam = searchParams?.get("categories") ?? null;

  // Compute color during render (pure function)
  const ambientColor = computeAmbientColor(pathname, categoryParam, config, categoryColors);

  // Compute a lighter version for bottom gradient
  const bottomColor = ambientColor.replace(/[\d.]+\)$/, (m) => `${parseFloat(m) * 0.5})`);
  const topClass = createCssVarClass("--subtle-glow-top", ambientColor, "subtle-glow-top");
  const bottomClass = createCssVarClass("--subtle-glow-bottom", bottomColor, "subtle-glow-bottom");
  const rawId = useId();
  const instanceClass = `subtle-glow-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const css = `
    .${instanceClass} .subtle-glow-top {
      background: radial-gradient(ellipse 80% 50% at 50% 0%, var(--subtle-glow-top), transparent);
    }
    .${instanceClass} .subtle-glow-bottom {
      background: radial-gradient(ellipse 100% 100% at 50% 100%, var(--subtle-glow-bottom), transparent);
    }
  `;
  const scopedCss = [topClass?.css, bottomClass?.css, css].filter(Boolean).join("\n");

  return (
    <div
      className={`ambient-layer fixed inset-0 pointer-events-none z-0 transition-opacity duration-500 ${instanceClass} ${
        topClass?.className ?? ""
      } ${bottomClass?.className ?? ""}`}
      aria-hidden="true"
    >
      <ScopedStyles css={scopedCss} />
      {/* Top gradient */}
      <div className="absolute top-0 left-0 right-0 h-96 subtle-glow-top" />
      {/* Bottom subtle gradient */}
      <div className="absolute bottom-0 left-0 right-0 h-48 subtle-glow-bottom" />
    </div>
  );
}
