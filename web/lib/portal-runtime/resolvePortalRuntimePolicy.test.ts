import { resolvePortalRuntimePolicy } from "./resolvePortalRuntimePolicy";
import type { PortalResolvedRequest } from "./types";

const baseRequest = {
  portal: {
    id: "1",
    slug: "atlanta",
    name: "Atlanta",
    tagline: null,
    portal_type: "city",
    status: "active",
    visibility: "public",
    filters: {},
    branding: {},
    settings: {},
    scoring_config: {},
  },
  slug: "atlanta",
  surface: "feed",
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
} satisfies Omit<PortalResolvedRequest, "runtimePolicy">;

describe("resolvePortalRuntimePolicy", () => {
  it("gives explore shared chrome with no tracker", () => {
    expect(
      resolvePortalRuntimePolicy({
        surface: "explore",
        request: baseRequest,
      }),
    ).toEqual({
      surface: "explore",
      cacheMode: "revalidate",
      revalidateSeconds: 300,
      requiresSharedChrome: true,
      supportsOverlayEntry: true,
      showTracker: false,
      showCannyWidget: false,
    });
  });

  it("gives detail a shorter revalidation budget and no overlay launch ownership", () => {
    expect(
      resolvePortalRuntimePolicy({
        surface: "detail",
        request: baseRequest,
      }),
    ).toEqual({
      surface: "detail",
      cacheMode: "revalidate",
      revalidateSeconds: 120,
      requiresSharedChrome: true,
      supportsOverlayEntry: false,
      showTracker: true,
      showCannyWidget: false,
    });
  });
});
