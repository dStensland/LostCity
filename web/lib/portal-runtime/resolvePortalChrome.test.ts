import { resolvePortalChrome } from "./resolvePortalChrome";
import type { PortalResolvedRequest } from "./types";
import { resolvePortalRuntimePolicy } from "./resolvePortalRuntimePolicy";

const baseRequestWithoutRuntime = {
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

const baseRequest = {
  ...baseRequestWithoutRuntime,
  runtimePolicy: resolvePortalRuntimePolicy({
    surface: baseRequestWithoutRuntime.surface,
    request: baseRequestWithoutRuntime,
  }),
} satisfies PortalResolvedRequest;

describe("resolvePortalChrome", () => {
  it("suppresses generic chrome for explore", () => {
    expect(
      resolvePortalChrome({
        surface: "explore",
        request: baseRequest,
      }),
    ).toEqual({
      showHeader: false,
      showFooter: false,
      showTracker: false,
      showCannyWidget: false,
    });
  });

  it("keeps feed chrome for normal feed portals", () => {
    expect(
      resolvePortalChrome({
        surface: "feed",
        request: baseRequest,
      }),
    ).toEqual({
      showHeader: true,
      showFooter: true,
      showTracker: true,
      showCannyWidget: true,
    });
  });
});
