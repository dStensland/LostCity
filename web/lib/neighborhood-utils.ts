/**
 * Shared utilities for neighborhood pages and components.
 * Extracted from detail page + NeighborhoodDrillDown to eliminate duplication.
 */

/** Parse a hex color string (#RRGGBB) into RGB components. */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

/** Format a snake_case category ID into Title Case label. */
export function formatCategoryLabel(cat: string): string {
  return cat
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Categories that add noise to the vibe pills / top categories display. */
export const NOISE_CATEGORIES = new Set(["support_group", "unknown", "recreation"]);
