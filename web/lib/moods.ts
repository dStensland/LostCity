/**
 * Mood definitions for vibe-based event filtering.
 * Each mood maps to specific vibes and categories for filtering.
 */

export type MoodId = "lowkey" | "wild" | "artsy" | "romantic" | "weird";

export interface Mood {
  id: MoodId;
  name: string;
  emoji: string;
  color: string;
  cssVar: string;
  vibes: string[];
  categories: string[];
  description: string;
}

export const MOODS: Mood[] = [
  {
    id: "lowkey",
    name: "Lowkey",
    emoji: "\u2615", // coffee cup
    color: "hsl(160, 80%, 65%)",
    cssVar: "--mood-lowkey",
    vibes: ["chill", "intimate", "casual", "relaxed"],
    categories: ["comedy", "community", "food_drink"],
    description: "Chill vibes only",
  },
  {
    id: "wild",
    name: "Wild",
    emoji: "\ud83d\udd25", // fire
    color: "hsl(290, 85%, 70%)",
    cssVar: "--mood-wild",
    vibes: ["late-night", "high-energy", "party", "dance"],
    categories: ["nightlife", "music"],
    description: "Ready to party",
  },
  {
    id: "artsy",
    name: "Artsy",
    emoji: "\ud83c\udfa8", // palette
    color: "hsl(260, 80%, 75%)",
    cssVar: "--mood-artsy",
    vibes: ["artsy", "creative", "experimental"],
    categories: ["art", "theater", "film"],
    description: "Culture & creativity",
  },
  {
    id: "romantic",
    name: "Romantic",
    emoji: "\ud83c\udf39", // rose
    color: "hsl(330, 85%, 80%)",
    cssVar: "--mood-romantic",
    vibes: ["date-spot", "intimate", "upscale", "romantic"],
    categories: [],
    description: "Date night vibes",
  },
  {
    id: "weird",
    name: "Weird",
    emoji: "\ud83d\udc7d", // alien
    color: "hsl(48, 95%, 65%)",
    cssVar: "--mood-weird",
    vibes: ["quirky", "underground", "weird", "alternative"],
    categories: [],
    description: "Off the beaten path",
  },
];

export function getMoodById(id: MoodId): Mood | undefined {
  return MOODS.find((m) => m.id === id);
}

/**
 * Check if an event matches a mood based on its vibes and category.
 */
export function eventMatchesMood(
  event: { category?: string | null; vibes?: string[] | null },
  mood: Mood
): boolean {
  // Check category match
  if (event.category && mood.categories.includes(event.category)) {
    return true;
  }

  // Check vibe match
  if (event.vibes && event.vibes.length > 0) {
    return event.vibes.some((v) => mood.vibes.includes(v.toLowerCase()));
  }

  return false;
}

/**
 * Get the primary mood that matches an event, if any.
 */
export function getEventMood(
  event: { category?: string | null; vibes?: string[] | null }
): Mood | null {
  for (const mood of MOODS) {
    if (eventMatchesMood(event, mood)) {
      return mood;
    }
  }
  return null;
}
