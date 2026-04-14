import { describe, it, expect } from "vitest";
import {
  buildEventUrl,
  buildSpotUrl,
  buildSeriesUrl,
  buildFestivalUrl,
  buildExhibitionUrl,
  buildArtistUrl,
  buildOrgUrl,
} from "@/lib/entity-urls";

describe("entity-urls", () => {
  describe("buildEventUrl", () => {
    it("returns overlay URL in feed context", () => {
      expect(buildEventUrl(123, "atlanta", "feed")).toBe("/atlanta?event=123");
    });
    it("returns canonical URL in page context", () => {
      expect(buildEventUrl(123, "atlanta", "page")).toBe("/atlanta/events/123");
    });
  });

  describe("buildSpotUrl", () => {
    it("returns overlay URL in feed context", () => {
      expect(buildSpotUrl("the-earl", "atlanta", "feed")).toBe("/atlanta?spot=the-earl");
    });
    it("returns canonical URL in page context", () => {
      expect(buildSpotUrl("the-earl", "atlanta", "page")).toBe("/atlanta/spots/the-earl");
    });
  });

  describe("buildSeriesUrl", () => {
    it("returns /series/ for recurring shows", () => {
      expect(buildSeriesUrl("tuesday-jazz", "atlanta")).toBe("/atlanta/series/tuesday-jazz");
    });
    it("returns /series/ when no seriesType provided", () => {
      expect(buildSeriesUrl("tuesday-jazz", "atlanta")).toBe("/atlanta/series/tuesday-jazz");
    });
    it("returns /showtimes/ for film type", () => {
      expect(buildSeriesUrl("nosferatu", "atlanta", "film")).toBe("/atlanta/showtimes/nosferatu");
    });
    it("returns /series/ for non-film types", () => {
      expect(buildSeriesUrl("tuesday-jazz", "atlanta", "recurring_show")).toBe("/atlanta/series/tuesday-jazz");
    });
  });

  describe("buildFestivalUrl", () => {
    it("returns canonical festival URL", () => {
      expect(buildFestivalUrl("shaky-knees", "atlanta")).toBe("/atlanta/festivals/shaky-knees");
    });
  });

  describe("buildExhibitionUrl", () => {
    it("returns canonical exhibition URL", () => {
      expect(buildExhibitionUrl("picasso-blue", "arts")).toBe("/arts/exhibitions/picasso-blue");
    });
  });

  describe("buildArtistUrl", () => {
    it("returns canonical artist URL", () => {
      expect(buildArtistUrl("big-boi", "atlanta")).toBe("/atlanta/artists/big-boi");
    });
  });

  describe("buildOrgUrl", () => {
    it("returns org overlay URL", () => {
      expect(buildOrgUrl("dad-garage", "atlanta")).toBe("/atlanta?org=dad-garage");
    });
  });
});
