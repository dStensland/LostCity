import { describe, expect, it } from "vitest";
import { buildFeedRequestPlan } from "@/lib/feed-request-plan";

describe("feed-request-plan", () => {
  it("enables supplemental work and sections only for the default personalized browse state", () => {
    expect(
      buildFeedRequestPlan({
        personalized: true,
        hasCategories: false,
        hasSearchQuery: false,
        hasTags: false,
        hasNeighborhoods: false,
        hasDateFilter: false,
        freeOnly: false,
        hasCursor: false,
      }),
    ).toEqual({
      shouldFetchTrending: true,
      shouldRunSupplementalQueries: true,
      shouldRestrictToPersonalizedMatches: true,
      shouldBuildSections: true,
    });
  });

  it("skips trending and section building for cursor pages", () => {
    expect(
      buildFeedRequestPlan({
        personalized: true,
        hasCategories: false,
        hasSearchQuery: false,
        hasTags: false,
        hasNeighborhoods: false,
        hasDateFilter: false,
        freeOnly: false,
        hasCursor: true,
      }),
    ).toEqual({
      shouldFetchTrending: false,
      shouldRunSupplementalQueries: true,
      shouldRestrictToPersonalizedMatches: true,
      shouldBuildSections: false,
    });
  });

  it("disables supplemental work for explicit browse filters that change the feed mode", () => {
    expect(
      buildFeedRequestPlan({
        personalized: true,
        hasCategories: false,
        hasSearchQuery: false,
        hasTags: false,
        hasNeighborhoods: false,
        hasDateFilter: true,
        freeOnly: false,
        hasCursor: false,
      }),
    ).toEqual({
      shouldFetchTrending: true,
      shouldRunSupplementalQueries: false,
      shouldRestrictToPersonalizedMatches: true,
      shouldBuildSections: false,
    });
  });

  it("turns off all personalized branches when personalized mode is disabled", () => {
    expect(
      buildFeedRequestPlan({
        personalized: false,
        hasCategories: false,
        hasSearchQuery: false,
        hasTags: false,
        hasNeighborhoods: false,
        hasDateFilter: false,
        freeOnly: false,
        hasCursor: false,
      }),
    ).toEqual({
      shouldFetchTrending: true,
      shouldRunSupplementalQueries: false,
      shouldRestrictToPersonalizedMatches: false,
      shouldBuildSections: false,
    });
  });
});
