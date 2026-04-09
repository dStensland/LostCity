import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveDetailPageRequest: vi.fn(),
}));

vi.mock("./resolve-detail-page-request", () => ({
  resolveDetailPageRequest: mocks.resolveDetailPageRequest,
}));

describe("resolveFilmPageRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the resolved detail request for atlanta even when the portal is not a film vertical", async () => {
    const request = {
      portal: { slug: "atlanta" },
      slug: "atlanta",
      surface: "detail",
      vertical: "city",
      effectiveVertical: "city",
      subdomainVertical: null,
      isExclusive: false,
      isHotel: false,
      isFilm: false,
      isMarketplace: false,
      isCommunity: false,
      isDog: false,
      isFamily: false,
      isAdventure: false,
      disableAmbientEffects: false,
      resolvedBranding: {},
      isLightTheme: false,
      runtimePolicy: {
        surface: "detail",
        cacheMode: "revalidate",
        revalidateSeconds: 120,
        requiresSharedChrome: true,
        supportsOverlayEntry: false,
        showTracker: true,
        showCannyWidget: false,
      },
    };
    mocks.resolveDetailPageRequest.mockResolvedValue(request);

    const { resolveFilmPageRequest } = await import("./resolve-film-page-request");
    const result = await resolveFilmPageRequest({
      portalSlug: "atlanta",
      pathname: "/atlanta/showtimes",
    });

    expect(result).toBe(request);
  });
});
