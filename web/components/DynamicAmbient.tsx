"use client";

import { useState, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// Category color mapping for ambient glow
const CATEGORY_AMBIENT_COLORS: Record<string, string> = {
  music: "rgba(255, 107, 122, 0.15)", // coral/pink
  comedy: "rgba(255, 200, 87, 0.15)", // gold
  art: "rgba(200, 162, 255, 0.15)", // lavender
  theater: "rgba(255, 107, 122, 0.12)", // coral
  film: "rgba(100, 200, 255, 0.12)", // cyan
  community: "rgba(100, 255, 180, 0.12)", // green
  food_drink: "rgba(255, 180, 100, 0.12)", // orange
  food: "rgba(255, 180, 100, 0.12)", // orange
  sports: "rgba(100, 200, 100, 0.12)", // green
  fitness: "rgba(100, 255, 200, 0.12)", // teal
  nightlife: "rgba(200, 100, 255, 0.15)", // purple
  family: "rgba(255, 200, 150, 0.12)", // warm
  default: "rgba(255, 107, 122, 0.08)", // default coral
};

/**
 * Dynamic ambient glow that changes based on current category/context
 * Reads from URL params or page context to determine color
 */
export default function DynamicAmbient() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [ambientColor, setAmbientColor] = useState(CATEGORY_AMBIENT_COLORS.default);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    // Determine ambient color based on context
    let newColor = CATEGORY_AMBIENT_COLORS.default;

    // Check for category in URL params
    const categoryParam = searchParams.get("categories");
    if (categoryParam) {
      const category = categoryParam.split(",")[0]; // Use first category
      if (CATEGORY_AMBIENT_COLORS[category]) {
        newColor = CATEGORY_AMBIENT_COLORS[category];
      }
    }

    // Check for category-specific pages
    if (pathname.includes("/music")) {
      newColor = CATEGORY_AMBIENT_COLORS.music;
    } else if (pathname.includes("/comedy")) {
      newColor = CATEGORY_AMBIENT_COLORS.comedy;
    } else if (pathname.includes("/art")) {
      newColor = CATEGORY_AMBIENT_COLORS.art;
    } else if (pathname.includes("/film") || pathname.includes("/movies")) {
      newColor = CATEGORY_AMBIENT_COLORS.film;
    } else if (pathname.includes("/food") || pathname.includes("/dining")) {
      newColor = CATEGORY_AMBIENT_COLORS.food_drink;
    } else if (pathname.includes("/nightlife")) {
      newColor = CATEGORY_AMBIENT_COLORS.nightlife;
    } else if (pathname.includes("/sports")) {
      newColor = CATEGORY_AMBIENT_COLORS.sports;
    } else if (pathname.includes("/community")) {
      newColor = CATEGORY_AMBIENT_COLORS.community;
    }

    // Only update if color changed
    if (newColor !== ambientColor) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional transition animation
      setIsTransitioning(true);
      setTimeout(() => {
        setAmbientColor(newColor);
        setIsTransitioning(false);
      }, 150);
    }
  }, [pathname, searchParams, ambientColor]);

  return (
    <div
      className="fixed inset-0 pointer-events-none z-0 transition-opacity duration-500"
      style={{ opacity: isTransitioning ? 0 : 1 }}
      aria-hidden="true"
    >
      {/* Top gradient */}
      <div
        className="absolute top-0 left-0 right-0 h-96"
        style={{
          background: `radial-gradient(ellipse 80% 50% at 50% 0%, ${ambientColor}, transparent)`,
        }}
      />
      {/* Bottom subtle gradient */}
      <div
        className="absolute bottom-0 left-0 right-0 h-48"
        style={{
          background: `radial-gradient(ellipse 100% 100% at 50% 100%, ${ambientColor.replace("0.1", "0.05")}, transparent)`,
        }}
      />
    </div>
  );
}

/**
 * Hook to get ambient color for a specific category
 */
export function useAmbientColor(category: string | null): string {
  if (!category) return CATEGORY_AMBIENT_COLORS.default;
  return CATEGORY_AMBIENT_COLORS[category] || CATEGORY_AMBIENT_COLORS.default;
}
