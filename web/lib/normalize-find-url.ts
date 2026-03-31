/**
 * Normalizes legacy Happening/Places URL parameters to the unified Find view scheme.
 *
 * Handles backwards compatibility for bookmarks and shared links using old URL patterns:
 * - ?view=happening, ?view=places, ?view=events, ?view=spots → ?view=find
 * - ?view=map, ?view=calendar → ?view=find&display=map|calendar
 * - ?tab=eat-drink etc. → ?view=find&lane=dining etc.
 * - ?content=showtimes → ?view=find&lane=music
 * - ?content=regulars → ?view=find&regulars=true
 * - ?type=showtimes etc. → lane mapping when view resolves to find
 *
 * Returns a new URLSearchParams (does not mutate the input).
 */

// "happening" and "places" are NOT normalized — they're standalone backward-compat paths.
// Only truly dead view aliases (events, spots) get normalized to find.
const LEGACY_FIND_VIEWS = new Set(["events", "spots"]);
const DISPLAY_VIEWS = new Set(["map", "calendar"]);

const TAB_TO_LANE: Record<string, string> = {
  "eat-drink": "dining",
  "things-to-do": "entertainment",
  nightlife: "nightlife",
};

const CONTENT_TO_LANE: Record<string, string> = {
  showtimes: "live-music",
  whats_on: "live-music",
};

const TYPE_TO_LANE: Record<string, string> = {
  showtimes: "live-music",
  whats_on: "live-music",
  destinations: "outdoors",
  spots: "outdoors",
};

export function normalizeFinURLParams(params: URLSearchParams): URLSearchParams {
  const result = new URLSearchParams(params.toString());
  const view = result.get("view");
  const tab = result.get("tab");
  const content = result.get("content");
  const type = result.get("type");

  // Regulars (check before content→lane mapping)
  if (content === "regulars") {
    result.set("view", "find");
    result.set("regulars", "true");
    result.delete("content");
    return result;
  }

  // Legacy view aliases → find
  if (view && LEGACY_FIND_VIEWS.has(view)) {
    result.set("view", "find");
  }

  // Display-mode views → find with display param
  if (view && DISPLAY_VIEWS.has(view)) {
    result.set("view", "find");
    result.set("display", view);
  }

  // Tab → lane mapping
  if (tab && TAB_TO_LANE[tab]) {
    result.set("view", "find");
    result.set("lane", TAB_TO_LANE[tab]);
    result.delete("tab");
  }

  // Explore shell lanes (?view=find&lane=X) — these are the new canonical URLs.
  // Don't normalize them — they're already in the right format.
  const SHELL_LANES = new Set(["events", "now-showing", "live-music", "stage", "regulars", "places", "calendar", "map"]);

  const LEGACY_LANE_MAP: Record<string, string> = {
    film: "now-showing",
    music: "live-music",
  };

  const existingLane = result.get("lane");
  if (existingLane && LEGACY_LANE_MAP[existingLane]) {
    result.set("lane", LEGACY_LANE_MAP[existingLane]);
  }

  const canonicalLane = result.get("lane");
  if (view === "find" && canonicalLane && SHELL_LANES.has(canonicalLane)) {
    // Already a valid Explore shell URL — pass through unchanged
    return result;
  }

  // Content → lane mapping (only when view is already "find" — don't override standalone "happening"/"places")
  if (content && CONTENT_TO_LANE[content] && result.get("view") === "find") {
    result.set("lane", CONTENT_TO_LANE[content]);
    result.delete("content");
  }

  // Type → lane mapping (only if view is now find and no lane set yet)
  if (type && TYPE_TO_LANE[type] && result.get("view") === "find" && !result.has("lane")) {
    result.set("lane", TYPE_TO_LANE[type]);
    result.delete("type");
  }

  // Lane → tool redirects: legacy ?view=find&lane=X → existing tool URL + from=find
  // Only for non-shell lanes (places-based categories)
  if (result.get("view") === "find" && result.has("lane")) {
    const lane = result.get("lane")!;
    if (!SHELL_LANES.has(lane)) {
      const LANE_REDIRECTS: Record<string, { view: string; tab?: string; content?: string; vertical?: string; venue_type?: string }> = {
        dining: { view: "places", tab: "eat-drink" },
        nightlife: { view: "places", tab: "nightlife" },
        arts: { view: "places", tab: "things-to-do", venue_type: "museum,gallery,arts_center,theater" },
        outdoors: { view: "places", tab: "things-to-do", venue_type: "park,trail,recreation,viewpoint,landmark" },
        entertainment: { view: "places", tab: "things-to-do", venue_type: "arcade,attraction,entertainment,escape_room,bowling,zoo,aquarium,cinema" },
      };
      const redirect = LANE_REDIRECTS[lane];
      if (redirect) {
        result.set("view", redirect.view);
        result.delete("lane");
        if (redirect.tab) result.set("tab", redirect.tab);
        if (redirect.content) result.set("content", redirect.content);
        if (redirect.vertical) result.set("vertical", redirect.vertical);
        if (redirect.venue_type) result.set("venue_type", redirect.venue_type);
        result.set("from", "find");
      }
    }
  }

  return result;
}
