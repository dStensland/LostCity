/**
 * Normalizes legacy Happening/Places URL parameters to the unified Find view scheme.
 *
 * Handles backwards compatibility for bookmarks and shared links using old URL patterns:
 * - ?view=happening → ?view=find&lane=events (plus sub-cases below)
 * - ?view=happening&content=regulars → ?view=find&lane=regulars
 * - ?view=happening&content=showtimes[&vertical=film|music] → ?view=find&lane=shows[&tab=...]
 * - ?view=happening&display=calendar → ?view=find&lane=calendar
 * - ?view=happening&display=map → ?view=find&lane=map
 * - ?view=places → ?view=find&lane=places
 * - ?view=events, ?view=spots → ?view=find
 * - ?view=map, ?view=calendar → ?view=find&display=map|calendar
 * - ?tab=eat-drink etc. → ?view=find&lane=dining etc.
 * - ?content=showtimes (standalone, no view=happening) → legacy redirect
 * - ?content=regulars (standalone, no view=happening) → ?view=find&regulars=true
 * - ?type=showtimes etc. → lane mapping when view resolves to find
 * - ?lane=now-showing → ?lane=shows&tab=film
 * - ?lane=live-music → ?lane=shows&tab=music
 * - ?lane=stage → ?lane=shows&tab=theater
 *
 * Returns a new URLSearchParams (does not mutate the input).
 */

import { SHELL_LANE_SET } from "@/lib/explore-lane-meta";

// "happening" and "places" are now normalized to the Find shell.
// Only truly dead view aliases (events, spots) are also in this set for backward compat.
const LEGACY_FIND_VIEWS = new Set(["events", "spots"]);
const DISPLAY_VIEWS = new Set(["map", "calendar"]);

const TAB_TO_LANE: Record<string, string> = {
  "eat-drink": "dining",
  "things-to-do": "entertainment",
  nightlife: "nightlife",
};

const CONTENT_TO_LANE: Record<string, string> = {
  showtimes: "shows",
  whats_on: "shows",
};

const TYPE_TO_LANE: Record<string, string> = {
  showtimes: "shows",
  whats_on: "shows",
  destinations: "outdoors",
  spots: "outdoors",
};

// Show lane consolidation: old per-vertical lanes → shows + tab
const SHOW_LANE_REDIRECTS: Record<string, string> = {
  "now-showing": "film",
  "live-music": "music",
  stage: "theater",
};

// Vertical param values that map to a tab when redirecting showtimes content
const VERTICAL_TO_TAB: Record<string, string> = {
  film: "film",
  music: "music",
};

export function normalizeFinURLParams(params: URLSearchParams): URLSearchParams {
  const result = new URLSearchParams(params.toString());
  const view = result.get("view");
  const tab = result.get("tab");
  const content = result.get("content");
  const type = result.get("type");

  // ?view=happening → ?view=find&lane=... (retire HappeningView, server-side safety net)
  if (view === "happening") {
    result.set("view", "find");
    const display = result.get("display");

    if (content === "regulars") {
      result.set("lane", "regulars");
    } else if (content === "showtimes" || type === "showtimes") {
      result.set("lane", "shows");
      const vertical = result.get("vertical");
      if (vertical && VERTICAL_TO_TAB[vertical]) {
        result.set("tab", VERTICAL_TO_TAB[vertical]);
      }
      result.delete("vertical");
    } else {
      result.set("lane", "events");
    }

    if (display === "calendar") {
      result.set("lane", "calendar");
    } else if (display === "map") {
      result.set("lane", "map");
    }

    result.delete("content");
    result.delete("display");
    result.delete("type");
    return result;
  }

  // ?view=places → ?view=find&lane=places
  if (view === "places") {
    result.set("view", "find");
    result.set("lane", "places");
    return result;
  }

  // Regulars without view=happening (standalone backward-compat)
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
  const SHELL_LANES = SHELL_LANE_SET;

  const LEGACY_LANE_MAP: Record<string, string> = {
    film: "shows",
    music: "shows",
  };

  const existingLane = result.get("lane");

  // Show lane consolidation: now-showing/live-music/stage → shows + tab
  if (existingLane && SHOW_LANE_REDIRECTS[existingLane]) {
    result.set("lane", "shows");
    result.set("tab", SHOW_LANE_REDIRECTS[existingLane]);
  } else if (existingLane && LEGACY_LANE_MAP[existingLane]) {
    result.set("lane", LEGACY_LANE_MAP[existingLane]);
  }

  const canonicalLane = result.get("lane");
  if (result.get("view") === "find" && canonicalLane && SHELL_LANES.has(canonicalLane)) {
    // Already a valid Explore shell URL — pass through unchanged
    return result;
  }

  // Content → lane mapping
  // view=happening and view=places are handled above with early returns, so this
  // safely fires for any remaining case (standalone content=showtimes, or view=find).
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
