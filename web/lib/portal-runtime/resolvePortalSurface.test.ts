import { resolvePortalSurface } from "./resolvePortalSurface";

describe("resolvePortalSurface", () => {
  it("detects canonical explore paths", () => {
    expect(
      resolvePortalSurface({
        pathname: "/atlanta/explore",
        searchParams: new URLSearchParams("lane=events"),
      }),
    ).toEqual({
      surface: "explore",
      isLegacyExplore: false,
    });
  });

  it("detects legacy explore query entrypoints", () => {
    expect(
      resolvePortalSurface({
        pathname: "/atlanta",
        searchParams: new URLSearchParams("view=find&lane=events"),
      }),
    ).toEqual({
      surface: "explore",
      isLegacyExplore: true,
    });
  });

  it("detects detail surfaces from child segments", () => {
    expect(
      resolvePortalSurface({
        pathname: "/atlanta/events/123",
        searchParams: new URLSearchParams(),
      }),
    ).toEqual({
      surface: "detail",
      isLegacyExplore: false,
    });
  });

  it("detects community surfaces from child segments", () => {
    expect(
      resolvePortalSurface({
        pathname: "/atlanta/community-hub",
        searchParams: new URLSearchParams(),
      }),
    ).toEqual({
      surface: "community",
      isLegacyExplore: false,
    });
  });

  it("treats best-of routes as community surfaces", () => {
    expect(
      resolvePortalSurface({
        pathname: "/atlanta/best-of",
        searchParams: new URLSearchParams(),
      }),
    ).toEqual({
      surface: "community",
      isLegacyExplore: false,
    });
  });

  it("treats curations and saved routes as community surfaces", () => {
    expect(
      resolvePortalSurface({
        pathname: "/atlanta/curations",
        searchParams: new URLSearchParams(),
      }),
    ).toEqual({
      surface: "community",
      isLegacyExplore: false,
    });

    expect(
      resolvePortalSurface({
        pathname: "/romp/saved",
        searchParams: new URLSearchParams(),
      }),
    ).toEqual({
      surface: "community",
      isLegacyExplore: false,
    });
  });

  it("treats canonical map routes as explore surfaces", () => {
    expect(
      resolvePortalSurface({
        pathname: "/romp/map",
        searchParams: new URLSearchParams(),
      }),
    ).toEqual({
      surface: "explore",
      isLegacyExplore: false,
    });
  });

  it("treats groups routes as community surfaces", () => {
    expect(
      resolvePortalSurface({
        pathname: "/atlanta/groups/state-legislature",
        searchParams: new URLSearchParams(),
      }),
    ).toEqual({
      surface: "community",
      isLegacyExplore: false,
    });
  });
});
