import {
  hasLegacyExploreNormalizationInput,
  isLegacyExploreRequest,
  normalizeFinURLParams,
  toCanonicalExploreUrl,
} from "../normalize-find-url";

describe("normalizeFinURLParams", () => {
  // Legacy view aliases → find
  // Note: "happening" and "places" are now fully normalized to the Find shell.
  // Only truly dead aliases (events, spots) remain in the LEGACY_FIND_VIEWS set.
  it("redirects ?view=happening to ?view=find&lane=events", () => {
    const result = normalizeFinURLParams(new URLSearchParams("view=happening"));
    expect(result.get("view")).toBe("find");
    expect(result.get("lane")).toBe("events");
  });

  it("redirects ?view=places to ?view=find&lane=places", () => {
    const result = normalizeFinURLParams(new URLSearchParams("view=places"));
    expect(result.get("view")).toBe("find");
    expect(result.get("lane")).toBe("places");
  });

  it("redirects ?view=events to ?view=find", () => {
    const result = normalizeFinURLParams(new URLSearchParams("view=events"));
    expect(result.get("view")).toBe("find");
  });

  it("redirects ?view=spots to ?view=find", () => {
    const result = normalizeFinURLParams(new URLSearchParams("view=spots"));
    expect(result.get("view")).toBe("find");
  });

  // Display mode views
  it("redirects ?view=map to ?view=find&display=map", () => {
    const result = normalizeFinURLParams(new URLSearchParams("view=map"));
    expect(result.get("view")).toBe("find");
    expect(result.get("display")).toBe("map");
  });

  it("redirects ?view=calendar to ?view=find&display=calendar", () => {
    const result = normalizeFinURLParams(new URLSearchParams("view=calendar"));
    expect(result.get("view")).toBe("find");
    expect(result.get("display")).toBe("calendar");
  });

  // Tab → lane → tool redirect (full pipeline)
  it("redirects ?tab=eat-drink to ?view=places&tab=eat-drink&from=find", () => {
    const result = normalizeFinURLParams(new URLSearchParams("tab=eat-drink"));
    expect(result.get("view")).toBe("places");
    expect(result.get("tab")).toBe("eat-drink");
    expect(result.get("from")).toBe("find");
    expect(result.has("lane")).toBe(false);
  });

  it("redirects ?tab=things-to-do to ?view=places&tab=things-to-do&from=find", () => {
    const result = normalizeFinURLParams(new URLSearchParams("tab=things-to-do"));
    expect(result.get("view")).toBe("places");
    expect(result.get("tab")).toBe("things-to-do");
    expect(result.get("from")).toBe("find");
    expect(result.has("lane")).toBe(false);
  });

  it("redirects ?tab=nightlife to ?view=places&tab=nightlife&from=find", () => {
    const result = normalizeFinURLParams(new URLSearchParams("tab=nightlife"));
    expect(result.get("view")).toBe("places");
    expect(result.get("tab")).toBe("nightlife");
    expect(result.get("from")).toBe("find");
    expect(result.has("lane")).toBe(false);
  });

  // Content → lane (standalone, no view param)
  it("redirects ?content=showtimes (standalone) to ?view=find&lane=shows", () => {
    const result = normalizeFinURLParams(new URLSearchParams("content=showtimes"));
    expect(result.get("view")).toBe("find");
    expect(result.get("lane")).toBe("shows");
    expect(result.has("content")).toBe(false);
  });

  it("redirects ?content=regulars to ?view=find&regulars=true", () => {
    const result = normalizeFinURLParams(new URLSearchParams("content=regulars"));
    expect(result.get("view")).toBe("find");
    expect(result.get("lane")).toBe("regulars");
    expect(result.has("content")).toBe(false);
  });

  // Type → lane → tool redirect (full pipeline)
  it("redirects ?view=happening&type=showtimes to ?view=find&lane=shows", () => {
    const result = normalizeFinURLParams(new URLSearchParams("view=happening&type=showtimes"));
    expect(result.get("view")).toBe("find");
    expect(result.get("lane")).toBe("shows");
    expect(result.has("content")).toBe(false);
    expect(result.has("type")).toBe(false);
  });

  it("redirects ?view=places&type=destinations to ?view=find&lane=places (places normalized to Find shell)", () => {
    const result = normalizeFinURLParams(new URLSearchParams("view=places&type=destinations"));
    expect(result.get("view")).toBe("find");
    expect(result.get("lane")).toBe("places");
  });

  // Filter preservation
  it("preserves filter params through redirects", () => {
    const result = normalizeFinURLParams(new URLSearchParams("view=events&venue_type=restaurant&neighborhoods=Midtown"));
    expect(result.get("view")).toBe("find");
    expect(result.get("venue_type")).toBe("restaurant");
    expect(result.get("neighborhoods")).toBe("Midtown");
  });

  // No-ops
  it("does not modify ?view=find without a lane", () => {
    const result = normalizeFinURLParams(new URLSearchParams("view=find"));
    expect(result.get("view")).toBe("find");
    expect(result.has("lane")).toBe(false);
  });

  it("does not modify ?view=feed", () => {
    const result = normalizeFinURLParams(new URLSearchParams("view=feed"));
    expect(result.get("view")).toBe("feed");
  });

  it("does not modify ?view=community", () => {
    const result = normalizeFinURLParams(new URLSearchParams("view=community"));
    expect(result.get("view")).toBe("community");
  });

  // Lane → tool redirects
  it("preserves from=find param when present on happening URL", () => {
    const result = normalizeFinURLParams(new URLSearchParams("view=happening&from=find"));
    expect(result.get("from")).toBe("find");
    expect(result.get("view")).toBe("find");
  });

  it("does not add from param when not present on happening URL", () => {
    const result = normalizeFinURLParams(new URLSearchParams("view=happening"));
    expect(result.has("from")).toBe(false);
  });

  it("redirects ?view=find&lane=dining to ?view=places&tab=eat-drink&from=find", () => {
    const result = normalizeFinURLParams(new URLSearchParams("view=find&lane=dining"));
    expect(result.get("view")).toBe("places");
    expect(result.get("tab")).toBe("eat-drink");
    expect(result.get("from")).toBe("find");
    expect(result.has("lane")).toBe(false);
  });

  it("redirects ?view=find&lane=music to ?view=find&lane=shows (legacy lane consolidation)", () => {
    const result = normalizeFinURLParams(new URLSearchParams("view=find&lane=music"));
    expect(result.get("view")).toBe("find");
    expect(result.get("lane")).toBe("shows");
  });

  it("redirects ?view=find&lane=arts with venue_type filter", () => {
    const result = normalizeFinURLParams(new URLSearchParams("view=find&lane=arts"));
    expect(result.get("view")).toBe("places");
    expect(result.get("tab")).toBe("things-to-do");
    expect(result.get("venue_type")).toContain("museum");
    expect(result.get("from")).toBe("find");
  });
});

describe("happening view normalization", () => {
  it("normalizes ?view=happening to ?view=find&lane=events", () => {
    const params = new URLSearchParams("view=happening");
    const result = normalizeFinURLParams(params);
    expect(result.get("view")).toBe("find");
    expect(result.get("lane")).toBe("events");
  });

  it("normalizes ?view=happening&content=regulars", () => {
    const params = new URLSearchParams("view=happening&content=regulars");
    const result = normalizeFinURLParams(params);
    expect(result.get("lane")).toBe("regulars");
  });

  it("normalizes ?view=happening&content=showtimes", () => {
    const params = new URLSearchParams("view=happening&content=showtimes");
    const result = normalizeFinURLParams(params);
    expect(result.get("lane")).toBe("shows");
  });

  it("normalizes ?view=happening&content=showtimes&vertical=film", () => {
    const params = new URLSearchParams("view=happening&content=showtimes&vertical=film");
    const result = normalizeFinURLParams(params);
    expect(result.get("lane")).toBe("shows");
    expect(result.get("tab")).toBe("film");
  });

  it("normalizes ?view=happening&display=calendar", () => {
    const params = new URLSearchParams("view=happening&display=calendar");
    const result = normalizeFinURLParams(params);
    expect(result.get("lane")).toBe("events");
    expect(result.get("display")).toBe("calendar");
  });

  it("normalizes ?view=happening&display=map", () => {
    const params = new URLSearchParams("view=happening&display=map");
    const result = normalizeFinURLParams(params);
    expect(result.get("lane")).toBe("events");
    expect(result.get("display")).toBe("map");
  });

  it("preserves search param", () => {
    const params = new URLSearchParams("view=happening&search=jazz");
    const result = normalizeFinURLParams(params);
    expect(result.get("search")).toBe("jazz");
    expect(result.get("lane")).toBe("events");
  });
});

describe("places view normalization", () => {
  it("normalizes ?view=places to ?view=find&lane=places", () => {
    const params = new URLSearchParams("view=places");
    const result = normalizeFinURLParams(params);
    expect(result.get("view")).toBe("find");
    expect(result.get("lane")).toBe("places");
  });
});

describe("canonical explore URL helpers", () => {
  it("converts legacy explore URLs to /explore", () => {
    expect(
      toCanonicalExploreUrl(
        "atlanta",
        new URLSearchParams("view=happening&display=calendar"),
      ),
    ).toBe("/atlanta/explore?display=calendar&lane=events");
  });

  it("treats root q as a canonical explore entry signal", () => {
    expect(toCanonicalExploreUrl("atlanta", new URLSearchParams("q=brunch"))).toBe(
      "/atlanta/explore?q=brunch",
    );
  });

  it("detects legacy explore entry signals", () => {
    expect(isLegacyExploreRequest(new URLSearchParams("view=find&lane=events"))).toBe(true);
    expect(isLegacyExploreRequest(new URLSearchParams("q=brunch"))).toBe(true);
    expect(isLegacyExploreRequest(new URLSearchParams("view=feed"))).toBe(false);
  });

  it("skips normalization for canonical explore shell params", () => {
    expect(hasLegacyExploreNormalizationInput(new URLSearchParams("lane=events"))).toBe(false);
    expect(hasLegacyExploreNormalizationInput(new URLSearchParams("q=brunch"))).toBe(false);
    expect(hasLegacyExploreNormalizationInput(new URLSearchParams("lane=shows&tab=film"))).toBe(false);
  });

  it("flags legacy-shaped explore params for normalization", () => {
    expect(hasLegacyExploreNormalizationInput(new URLSearchParams("view=find&lane=events"))).toBe(true);
    expect(hasLegacyExploreNormalizationInput(new URLSearchParams("lane=music"))).toBe(true);
    expect(hasLegacyExploreNormalizationInput(new URLSearchParams("display=calendar"))).toBe(true);
  });
});
