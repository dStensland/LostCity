import { describe, expect, it } from "vitest";
import {
  DEFAULT_DESTINATIONS_FILTERS,
  applyDestinationsQueryState,
  areDestinationFiltersEqual,
  inferDestinationsTab,
  parseDestinationsQueryState,
} from "@/lib/destinations-query-state";

describe("destinations-query-state", () => {
  it("parses explicit tab state and sanitizes venue types to that tab", () => {
    const state = parseDestinationsQueryState(
      "tab=nightlife&venue_type=bar,park&open_now=true&with_events=true"
    );

    expect(state.activeTab).toBe("nightlife");
    expect(state.filters.openNow).toBe(true);
    expect(state.filters.withEvents).toBe(true);
    expect(state.filters.venueTypes).toEqual(["bar"]);
  });

  it("infers a tab from venue types when tab is absent", () => {
    const tab = inferDestinationsTab(
      {
        ...DEFAULT_DESTINATIONS_FILTERS,
        venueTypes: ["museum", "gallery"],
      },
      null
    );

    expect(tab).toBe("things-to-do");
  });

  it("round-trips state back into canonical query params", () => {
    const current = new URLSearchParams("search=coffee&display=map");
    const next = applyDestinationsQueryState(current, {
      activeTab: "things-to-do",
      filters: {
        ...DEFAULT_DESTINATIONS_FILTERS,
        neighborhoods: ["Old Fourth Ward", "Inman Park"],
        venueTypes: ["museum", "gallery"],
        withEvents: true,
      },
    });

    expect(next.get("view")).toBe("find");
    expect(next.get("type")).toBe("destinations");
    expect(next.get("tab")).toBe("things-to-do");
    expect(next.get("with_events")).toBe("true");
    expect(next.get("venue_type")).toBe("gallery,museum");
    expect(next.get("neighborhoods")).toBe("Inman Park,Old Fourth Ward");
    expect(next.get("search")).toBe("coffee");
    expect(next.get("display")).toBe("map");
  });

  it("compares filter equality independent of array order", () => {
    expect(
      areDestinationFiltersEqual(
        {
          ...DEFAULT_DESTINATIONS_FILTERS,
          venueTypes: ["gallery", "museum"],
          neighborhoods: ["Old Fourth Ward", "Inman Park"],
          priceLevel: [2, 1],
        },
        {
          ...DEFAULT_DESTINATIONS_FILTERS,
          venueTypes: ["museum", "gallery"],
          neighborhoods: ["Inman Park", "Old Fourth Ward"],
          priceLevel: [1, 2],
        }
      )
    ).toBe(true);
  });
});
