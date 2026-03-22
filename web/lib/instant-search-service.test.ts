import { beforeEach, describe, expect, it, vi } from "vitest";

const getSearchSuggestionsWithFallbackMock = vi.fn();
const instantSearchMock = vi.fn();

vi.mock("@/lib/search-suggestions", () => ({
  getSearchSuggestionsWithFallback: getSearchSuggestionsWithFallbackMock,
}));

vi.mock("@/lib/unified-search", () => ({
  instantSearch: instantSearchMock,
}));

const timing = {
  measure: async <T>(_: string, fn: () => Promise<T> | T) => await fn(),
};

describe("buildInstantSearchPayload", () => {
  beforeEach(() => {
    getSearchSuggestionsWithFallbackMock.mockReset();
    instantSearchMock.mockReset();
  });

  it("returns direct-query fallback results without invoking RPC search when fast-path suggestions are empty", async () => {
    getSearchSuggestionsWithFallbackMock.mockResolvedValueOnce([]);

    const { buildInstantSearchPayload } = await import("@/lib/instant-search-service");

    const payload = await buildInstantSearchPayload({
      query: "Afrobeat",
      limit: 8,
      portalId: "11111111-1111-1111-1111-111111111111",
      portalSlug: "atlanta",
      portalCity: "Atlanta",
      viewMode: "find",
      findType: "events",
      timing,
    });

    expect(payload.suggestions.slice(0, 2)).toMatchObject([
      {
        type: "event",
        title: "Afrobeat",
        subtitle: "Search events",
        href: "/atlanta?view=happening&search=Afrobeat",
      },
      {
        type: "venue",
        title: "Afrobeat",
        subtitle: "Search places",
        href: "/atlanta?view=places&search=Afrobeat",
      },
    ]);
    expect(instantSearchMock).not.toHaveBeenCalled();
  });

  it("keeps suggestion results and appends a direct-query fallback instead of invoking RPC search", async () => {
    getSearchSuggestionsWithFallbackMock.mockResolvedValueOnce([
      { text: "The Midnight", type: "event", frequency: 4 },
    ]);

    const { buildInstantSearchPayload } = await import("@/lib/instant-search-service");

    const payload = await buildInstantSearchPayload({
      query: "synthwave",
      limit: 8,
      portalId: "11111111-1111-1111-1111-111111111111",
      portalSlug: "atlanta",
      portalCity: "Atlanta",
      viewMode: "find",
      findType: "events",
      timing,
    });

    expect(payload.suggestions.slice(0, 2)).toMatchObject([
      {
        type: "event",
        title: "The Midnight",
      },
      {
        type: "event",
        title: "synthwave",
        subtitle: "Search events",
        href: "/atlanta?view=happening&search=synthwave",
      },
    ]);
    expect(instantSearchMock).not.toHaveBeenCalled();
  });

  it("promotes the direct event search CTA for multi-word event queries", async () => {
    getSearchSuggestionsWithFallbackMock.mockResolvedValueOnce([
      { text: "music", type: "category", frequency: 20 },
      { text: "live-music", type: "tag", frequency: 12 },
    ]);

    const { buildInstantSearchPayload } = await import("@/lib/instant-search-service");

    const payload = await buildInstantSearchPayload({
      query: "live music tonight",
      limit: 8,
      portalId: "11111111-1111-1111-1111-111111111111",
      portalSlug: "atlanta",
      portalCity: "Atlanta",
      viewMode: "find",
      findType: "events",
      timing,
    });

    expect(payload.suggestions[0]).toMatchObject({
      type: "event",
      title: "live music tonight",
      subtitle: "Search events",
      href: "/atlanta?view=happening&search=live%20music%20tonight",
    });
    expect(instantSearchMock).not.toHaveBeenCalled();
  });

  it("keeps canonical neighborhood suggestions ahead of event matches for shorthand location queries", async () => {
    getSearchSuggestionsWithFallbackMock.mockResolvedValueOnce([
      { text: "Little Five Points", type: "neighborhood", frequency: 3, similarity: 0.35 },
      { text: "Little 5 Points Halloween Festival & Parade", type: "event", frequency: 6, similarity: 0.91 },
      { text: "Queer Craft Night @ Java Lords - Little 5 Points", type: "event", frequency: 4, similarity: 0.82 },
    ]);

    const { buildInstantSearchPayload } = await import("@/lib/instant-search-service");

    const payload = await buildInstantSearchPayload({
      query: "l5p",
      limit: 8,
      portalId: "11111111-1111-1111-1111-111111111111",
      portalSlug: "atlanta",
      portalCity: "Atlanta",
      viewMode: "find",
      findType: "events",
      timing,
    });

    expect(payload.suggestions[0]).toMatchObject({
      type: "neighborhood",
      title: "Little Five Points",
      href: "/atlanta?view=happening&neighborhoods=Little%20Five%20Points",
    });
    expect(payload.suggestions[1]).toMatchObject({
      type: "event",
      title: "Little 5 Points Halloween Festival & Parade",
    });
    expect(instantSearchMock).not.toHaveBeenCalled();
  });

  it("demotes generic vibe suggestions behind event-intent results for multi-word event queries", async () => {
    getSearchSuggestionsWithFallbackMock.mockResolvedValueOnce([
      { text: "Live Music: DJ Night", type: "event", frequency: 5 },
      { text: "live-music", type: "vibe", frequency: 250 },
      { text: "music", type: "category", frequency: 20 },
    ]);

    const { buildInstantSearchPayload } = await import("@/lib/instant-search-service");

    const payload = await buildInstantSearchPayload({
      query: "live music tonight",
      limit: 8,
      portalId: "11111111-1111-1111-1111-111111111111",
      portalSlug: "atlanta",
      portalCity: "Atlanta",
      viewMode: "find",
      findType: "events",
      timing,
    });

    expect(payload.suggestions.slice(0, 3)).toMatchObject([
      {
        type: "event",
        title: "live music tonight",
        subtitle: "Search events",
      },
      {
        type: "event",
        title: "Live Music: DJ Night",
      },
      {
        type: "category",
        title: "music",
      },
    ]);
  });
});
