import { describe, it, expect } from "vitest";
import {
  buildBestOfUrl,
  buildCommunityHubUrl,
  buildCommunityOrgUrl,
  buildCurationsUrl,
  buildDogMapUrl,
  buildExploreUrl,
  buildFindUrl,
  buildSavedUrl,
} from "@/lib/find-url";

describe("buildExploreUrl", () => {
  it("builds base explore URL with no params", () => {
    expect(buildExploreUrl({ portalSlug: "atlanta" })).toBe("/atlanta/explore");
  });

  it("builds lane URL", () => {
    expect(buildExploreUrl({ portalSlug: "atlanta", lane: "events" })).toBe(
      "/atlanta/explore?lane=events"
    );
  });

  it("builds search URL with canonical param name", () => {
    expect(
      buildExploreUrl({ portalSlug: "atlanta", lane: "events", search: "jazz" })
    ).toBe("/atlanta/explore?lane=events&search=jazz");
  });

  it("builds date filter URL", () => {
    expect(
      buildExploreUrl({ portalSlug: "atlanta", lane: "events", date: "today" })
    ).toBe("/atlanta/explore?lane=events&date=today");
  });

  it("builds categories filter URL", () => {
    expect(
      buildExploreUrl({ portalSlug: "atlanta", lane: "events", categories: "music" })
    ).toBe("/atlanta/explore?lane=events&categories=music");
  });

  it("builds price filter URL", () => {
    expect(
      buildExploreUrl({ portalSlug: "atlanta", lane: "events", price: "free" })
    ).toBe("/atlanta/explore?lane=events&price=free");
  });

  it("encodes search values", () => {
    expect(
      buildExploreUrl({ portalSlug: "atlanta", lane: "events", search: "live jazz & blues" })
    ).toBe("/atlanta/explore?lane=events&search=live+jazz+%26+blues");
  });

  it("omits undefined params", () => {
    expect(
      buildExploreUrl({ portalSlug: "atlanta", lane: "events", search: undefined })
    ).toBe("/atlanta/explore?lane=events");
  });

  it("supports extra params for canonical surface links", () => {
    expect(
      buildExploreUrl({
        portalSlug: "atlanta",
        lane: "places",
        extraParams: {
          venue_type: "restaurant",
          open_now: true,
          tab: "eat-drink",
        },
      })
    ).toBe(
      "/atlanta/explore?lane=places&venue_type=restaurant&open_now=true&tab=eat-drink"
    );
  });
});

describe("buildFindUrl compatibility alias", () => {
  it("still emits canonical /explore URLs", () => {
    expect(buildFindUrl({ portalSlug: "atlanta", lane: "places" })).toBe(
      "/atlanta/explore?lane=places"
    );
  });
});

describe("community and utility route builders", () => {
  it("builds canonical community hub URLs", () => {
    expect(buildCommunityHubUrl({ portalSlug: "atlanta" })).toBe("/atlanta/community-hub");
    expect(buildCommunityHubUrl({ portalSlug: "atlanta", search: "film club" })).toBe(
      "/atlanta/community-hub?search=film+club"
    );
  });

  it("builds canonical curations URLs", () => {
    expect(buildCurationsUrl({ portalSlug: "atlanta" })).toBe("/atlanta/curations");
  });

  it("builds canonical best-of URLs", () => {
    expect(buildBestOfUrl({ portalSlug: "atlanta" })).toBe("/atlanta/best-of");
    expect(buildBestOfUrl({ portalSlug: "atlanta", categorySlug: "best-brunch" })).toBe(
      "/atlanta/best-of/best-brunch"
    );
  });

  it("builds canonical community org URLs", () => {
    expect(buildCommunityOrgUrl({ portalSlug: "atlanta", orgSlug: "atl-sketch-club" })).toBe(
      "/atlanta/community/atl-sketch-club"
    );
  });

  it("builds canonical saved URLs", () => {
    expect(buildSavedUrl({ portalSlug: "atlanta" })).toBe("/atlanta/saved");
  });

  it("builds canonical dog map URLs", () => {
    expect(buildDogMapUrl({ portalSlug: "romp" })).toBe("/romp/map");
  });
});
