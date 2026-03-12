import { describe, expect, it } from "vitest";
import {
  getEventLedVenueCandidateLimit,
  shouldUseEventLedSpotsDiscovery,
} from "@/lib/spots-request-plan";

describe("spots request plan", () => {
  it("uses event-led discovery for unfiltered default spot browsing", () => {
    expect(
      shouldUseEventLedSpotsDiscovery({
        hasCenter: false,
        hasSearch: false,
        sortBy: null,
        hasPriceLevel: false,
        venueTypesCount: 0,
        neighborhoodsCount: 0,
        vibesCount: 0,
        genresCount: 0,
        cuisinesCount: 0,
      }),
    ).toBe(true);
  });

  it("disables event-led discovery for filtered or geo-sorted requests", () => {
    expect(
      shouldUseEventLedSpotsDiscovery({
        hasCenter: true,
        hasSearch: false,
        sortBy: "distance",
        hasPriceLevel: false,
        venueTypesCount: 0,
        neighborhoodsCount: 0,
        vibesCount: 0,
        genresCount: 0,
        cuisinesCount: 0,
      }),
    ).toBe(false);

    expect(
      shouldUseEventLedSpotsDiscovery({
        hasCenter: false,
        hasSearch: true,
        sortBy: null,
        hasPriceLevel: false,
        venueTypesCount: 0,
        neighborhoodsCount: 0,
        vibesCount: 0,
        genresCount: 0,
        cuisinesCount: 0,
      }),
    ).toBe(false);
  });

  it("scales event-led venue candidate limits conservatively", () => {
    expect(getEventLedVenueCandidateLimit(24, false)).toBe(192);
    expect(getEventLedVenueCandidateLimit(24, true)).toBe(288);
    expect(getEventLedVenueCandidateLimit(100, true)).toBe(480);
  });
});
