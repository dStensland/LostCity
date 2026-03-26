/**
 * Per-neighborhood color palette + type shared between server and client.
 *
 * Rich jewel tones that read well on dark basemaps. Hash-indexed by name
 * so every neighborhood always gets the same color.
 */

export type NeighborhoodActivity = {
  name: string;
  slug: string;
  tier: number | null;
  eventsTodayCount: number;
  eventsWeekCount: number;
  venueCount: number;
  editorialMentionCount: number;
  occasionTypes: number;
  activityScore: number;
  topCategories: string[];
  goingCount: number;
  activeHangsCount: number;
};

export const NEIGHBORHOOD_COLORS = [
  "#7C5CFC",  // electric purple
  "#FF6B7A",  // coral
  "#00D9A0",  // neon green
  "#FFB74D",  // warm amber
  "#4FC3F7",  // sky blue
  "#E855A0",  // magenta
  "#26C6DA",  // teal
  "#AED581",  // lime
  "#FF8A65",  // peach/terracotta
  "#BA68C8",  // lavender
  "#4DB6AC",  // seafoam
  "#FFD54F",  // gold
];

export function getNeighborhoodColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return NEIGHBORHOOD_COLORS[Math.abs(hash) % NEIGHBORHOOD_COLORS.length];
}
