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

const LEGACY_FIND_VIEWS = new Set(["happening", "places", "events", "spots"]);
const DISPLAY_VIEWS = new Set(["map", "calendar"]);

const TAB_TO_LANE: Record<string, string> = {
  "eat-drink": "dining",
  "things-to-do": "entertainment",
  nightlife: "nightlife",
};

const CONTENT_TO_LANE: Record<string, string> = {
  showtimes: "music",
  whats_on: "music",
};

const TYPE_TO_LANE: Record<string, string> = {
  showtimes: "music",
  whats_on: "music",
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

  // Content → lane mapping
  if (content && CONTENT_TO_LANE[content]) {
    result.set("view", "find");
    result.set("lane", CONTENT_TO_LANE[content]);
    result.delete("content");
  }

  // Type → lane mapping (only if view is now find and no lane set yet)
  if (type && TYPE_TO_LANE[type] && result.get("view") === "find" && !result.has("lane")) {
    result.set("lane", TYPE_TO_LANE[type]);
    result.delete("type");
  }

  return result;
}
