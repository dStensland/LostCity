import { describe, expect, it, vi } from "vitest";

const getSearchSuggestionsWithFallbackMock = vi.fn();

vi.mock("@/lib/search-suggestions", () => ({
  getSearchSuggestionsWithFallback: getSearchSuggestionsWithFallbackMock,
}));

describe("runSearchPreview", () => {
  it("returns direct query fallback results for multi-word queries without suggestions", async () => {
    getSearchSuggestionsWithFallbackMock.mockResolvedValueOnce([]);

    const { runSearchPreview } = await import("@/lib/search-preview");

    const result = await runSearchPreview({
      query: "Afrobeat Night",
      limit: 8,
      requestedTypes: ["event", "venue"],
      portalId: "11111111-1111-1111-1111-111111111111",
      portalSlug: "atlanta",
      portalCity: "Atlanta",
    });

    expect(result.total).toBe(2);
    expect(result.results[0]).toMatchObject({
      type: "event",
      title: "Afrobeat Night",
      href: "/atlanta?view=find&type=events&search=Afrobeat%20Night",
    });
    expect(result.results[1]).toMatchObject({
      type: "venue",
      title: "Afrobeat Night",
      subtitle: "Search places",
      href: "/atlanta?view=find&type=destinations&search=Afrobeat%20Night",
    });
  });

  it("routes direct query fallback to classes when findType is classes", async () => {
    getSearchSuggestionsWithFallbackMock.mockResolvedValueOnce([]);

    const { runSearchPreview } = await import("@/lib/search-preview");

    const result = await runSearchPreview({
      query: "Pottery Wheel",
      limit: 8,
      requestedTypes: ["event"],
      portalId: "11111111-1111-1111-1111-111111111111",
      portalSlug: "atlanta",
      portalCity: "Atlanta",
      findType: "classes",
    });

    expect(result.total).toBe(1);
    expect(result.results[0]).toMatchObject({
      type: "event",
      title: "Pottery Wheel",
      subtitle: "Search classes",
      href: "/atlanta?view=find&type=classes&search=Pottery%20Wheel",
    });
  });
});
