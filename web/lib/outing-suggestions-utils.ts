// ---------------------------------------------------------------------------
// Outing Suggestions — shared types (client-safe)
// ---------------------------------------------------------------------------

export type SuggestionCategory = "food" | "drinks" | "events" | "activity" | "sight";

export type OutingSuggestion = {
  type: "venue" | "event" | "special";
  id: number;
  title: string;
  venue: {
    id: number;
    name: string;
    slug: string;
    lat: number | null;
    lng: number | null;
    place_type: string | null;
  };
  suggested_time: string;
  distance_km: number;
  walking_minutes: number;
  reason: string;
  category: SuggestionCategory;
  image_url: string | null;
  active_special?: { title: string; type: string } | null;
};

export type OutingSuggestionsResponse = {
  before: OutingSuggestion[];
  after: OutingSuggestion[];
  target_time_before: string;
  target_time_after: string;
};

// ---------------------------------------------------------------------------
// Intent-driven labels — map generic categories to context-aware intents
// ---------------------------------------------------------------------------

export type IntentSlot = "before" | "after";

/** Map suggestion category → user-friendly intent label based on time context */
export function getIntentLabel(
  category: SuggestionCategory,
  slot: IntentSlot,
  anchorHour: number,
): string {
  switch (category) {
    case "food":
      if (slot === "before") {
        // Arrival is ~75-90 min before anchor, so meal time ≈ anchorHour - 1
        const mealHour = anchorHour - 1;
        if (mealHour < 11) return "Brunch";
        if (mealHour < 17) return "Lunch";
        return "Dinner";
      }
      if (anchorHour >= 21) return "Late Bite";
      return "Dinner";
    case "drinks":
      if (slot === "after" && anchorHour >= 22) return "Nightcap";
      return "Drinks";
    case "events":
      if (anchorHour >= 21) return "Late Night";
      return "Shows";
    case "activity":
      return "Activity";
    case "sight":
      return "Explore";
  }
}

/** Pick smart default category filter for a slot based on time context */
export function getSmartDefault(
  slot: IntentSlot,
  anchorHour: number,
  available: SuggestionCategory[],
): SuggestionCategory | null {
  if (available.length <= 1) return null;

  if (slot === "before") {
    // Before events: people usually want dinner
    if (available.includes("food")) return "food";
  } else {
    // After evening events: drinks first, then shows
    if (anchorHour >= 17 && available.includes("drinks")) return "drinks";
    // After daytime events: shows or food
    if (available.includes("events")) return "events";
    if (available.includes("food")) return "food";
  }
  return null;
}
