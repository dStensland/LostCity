import { describe, expect, it } from "vitest";
import {
  hasBespokeFeedShell,
  coercePortalVertical,
  defaultPortalVerticalForType,
  getPortalRole,
  isFilmPortalVertical,
  isEntityFamily,
  isContentPillarVertical,
  normalizePortalVertical,
  shouldDisableAmbientEffects,
  shouldSuppressGlobalEffects,
  supportsPortalArtists,
  supportsPortalMap,
  supportsPortalSpots,
  supportsPortalWeather,
  toFeedSkeletonVertical,
} from "@/lib/portal-taxonomy";

describe("coercePortalVertical", () => {
  it("returns null for missing or unsupported values", () => {
    expect(coercePortalVertical(undefined)).toBeNull();
    expect(coercePortalVertical("unknown")).toBeNull();
  });

  it("maps aliases and preserves live verticals", () => {
    expect(coercePortalVertical("civic")).toBe("community");
    expect(coercePortalVertical("arts")).toBe("arts");
  });
});

describe("isEntityFamily", () => {
  it("recognizes declared entity families only", () => {
    expect(isEntityFamily("events")).toBe(true);
    expect(isEntityFamily("open_calls")).toBe(true);
    expect(isEntityFamily("unknown")).toBe(false);
  });
});

describe("normalizePortalVertical", () => {
  it("maps legacy aliases onto the live runtime taxonomy", () => {
    expect(normalizePortalVertical("civic")).toBe("community");
  });

  it("preserves current content-pillar verticals", () => {
    expect(normalizePortalVertical("family")).toBe("family");
    expect(normalizePortalVertical("adventure")).toBe("adventure");
    expect(normalizePortalVertical("arts")).toBe("arts");
    expect(normalizePortalVertical("sports")).toBe("sports");
  });

  it("falls back when the configured value is unknown", () => {
    expect(normalizePortalVertical("unknown", "hotel")).toBe("hotel");
  });
});

describe("defaultPortalVerticalForType", () => {
  it("keeps business portals on the community shell by default", () => {
    expect(defaultPortalVerticalForType("business")).toBe("community");
  });

  it("defaults other portal types to city", () => {
    expect(defaultPortalVerticalForType("city")).toBe("city");
    expect(defaultPortalVerticalForType("event")).toBe("city");
  });
});

describe("getPortalRole", () => {
  it("classifies live content pillars distinctly from distribution portals", () => {
    expect(getPortalRole("city")).toBe("base_city");
    expect(getPortalRole("family")).toBe("content_pillar");
    expect(getPortalRole("arts")).toBe("content_pillar");
    expect(getPortalRole("hotel")).toBe("distribution");
  });
});

describe("phase 1 runtime helpers", () => {
  it("identifies current content pillars and bespoke feed shells", () => {
    expect(isContentPillarVertical("community")).toBe(true);
    expect(isContentPillarVertical("sports")).toBe(true);
    expect(isContentPillarVertical("hotel")).toBe(false);
    expect(hasBespokeFeedShell("family")).toBe(true);
    expect(hasBespokeFeedShell("adventure")).toBe(false);
  });

  it("drives shared ambient and skeleton behavior", () => {
    expect(shouldDisableAmbientEffects("film")).toBe(true);
    expect(shouldDisableAmbientEffects("arts")).toBe(false);
    expect(shouldSuppressGlobalEffects("arts")).toBe(true);
    expect(shouldSuppressGlobalEffects("family")).toBe(false);
    expect(toFeedSkeletonVertical("marketplace")).toBe("marketplace");
    expect(toFeedSkeletonVertical("community")).toBe("city");
  });

  it("centralizes module support and film-specific routing predicates", () => {
    expect(isFilmPortalVertical("film")).toBe(true);
    expect(isFilmPortalVertical("arts")).toBe(false);
    expect(supportsPortalSpots("film")).toBe(false);
    expect(supportsPortalSpots("community")).toBe(true);
    expect(supportsPortalArtists("film")).toBe(true);
    expect(supportsPortalArtists("family")).toBe(false);
    expect(supportsPortalWeather("dog")).toBe(false);
    expect(supportsPortalWeather("arts")).toBe(true);
    expect(supportsPortalMap("hotel")).toBe(false);
    expect(supportsPortalMap("city")).toBe(true);
  });
});
