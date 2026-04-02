import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import {
  Palette,
  CookingPot,
  HandGrabbing,
  PersonSimpleRun,
  Barbell,
  Hammer,
  Camera,
  Sparkle,
} from "@phosphor-icons/react";

export interface ClassCategory {
  slug: string;
  label: string;
  icon: PhosphorIcon;
  /** API values that map to this UI category */
  apiValues: string[];
}

/**
 * 8 UI categories (merged from 11 API categories).
 * "candle-making" + "floral" + "mixed" → "crafts"
 * "outdoor-skills" → merged into "fitness"
 */
export const CLASS_CATEGORIES: ClassCategory[] = [
  { slug: "painting", label: "Painting", icon: Palette, apiValues: ["painting"] },
  { slug: "cooking", label: "Cooking", icon: CookingPot, apiValues: ["cooking"] },
  { slug: "pottery", label: "Pottery", icon: HandGrabbing, apiValues: ["pottery"] },
  { slug: "dance", label: "Dance", icon: PersonSimpleRun, apiValues: ["dance"] },
  { slug: "fitness", label: "Fitness", icon: Barbell, apiValues: ["fitness", "outdoor-skills"] },
  { slug: "woodworking", label: "Woodworking", icon: Hammer, apiValues: ["woodworking"] },
  { slug: "photography", label: "Photography", icon: Camera, apiValues: ["photography"] },
  { slug: "crafts", label: "Crafts", icon: Sparkle, apiValues: ["candle-making", "floral", "mixed"] },
];

/** Map a raw API class_category to the merged UI category slug */
export function toUiCategory(apiCategory: string | null): string {
  if (!apiCategory) return "crafts";
  for (const cat of CLASS_CATEGORIES) {
    if (cat.apiValues.includes(apiCategory)) return cat.slug;
  }
  return "crafts";
}

/** Get the UI category metadata by slug */
export function getCategoryMeta(slug: string): ClassCategory | undefined {
  return CLASS_CATEGORIES.find((c) => c.slug === slug);
}

/** Get the API values for a UI category slug (for query filtering) */
export function getApiValues(uiSlug: string): string[] {
  const cat = getCategoryMeta(uiSlug);
  return cat?.apiValues ?? [];
}
