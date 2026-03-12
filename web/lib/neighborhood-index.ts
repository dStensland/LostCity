import {
  getNeighborhoodsByTier,
  type Neighborhood,
} from "@/config/neighborhoods";

export type NeighborhoodIndexEntry = {
  neighborhood: Neighborhood;
  count: number;
};

export type NeighborhoodIndexSection = {
  title: string;
  neighborhoods: NeighborhoodIndexEntry[];
};

const SECTION_LABELS: Record<1 | 2 | 3, string> = {
  1: "Popular",
  2: "More neighborhoods",
  3: "Up-and-coming",
};

function sortNeighborhoodsByCount(
  neighborhoods: Neighborhood[],
  counts: Record<string, number>,
): NeighborhoodIndexEntry[] {
  return neighborhoods
    .map((neighborhood) => ({
      neighborhood,
      count: counts[neighborhood.name] || 0,
    }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.neighborhood.name.localeCompare(b.neighborhood.name);
    });
}

export function buildNeighborhoodIndexSections(
  counts: Record<string, number>,
): NeighborhoodIndexSection[] {
  return ([1, 2, 3] as const)
    .map((tier) => ({
      title: SECTION_LABELS[tier],
      neighborhoods: sortNeighborhoodsByCount(getNeighborhoodsByTier(tier), counts),
    }))
    .filter((section) => section.neighborhoods.length > 0);
}
