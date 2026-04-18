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
import { DETAIL_ENTRY_PARAM_KEYS } from "@/app/[portal]/_surfaces/detail/detail-entry-contract";

describe("entity-urls", () => {
  describe("buildEventUrl", () => {
    it("returns overlay URL in overlay context", () => {
      expect(buildEventUrl(123, "atlanta", "overlay")).toBe("/atlanta?event=123");
    });
    it("returns canonical URL in canonical context", () => {
      expect(buildEventUrl(123, "atlanta", "canonical")).toBe("/atlanta/events/123");
    });
  });

  describe("buildSpotUrl", () => {
    it("returns overlay URL in overlay context", () => {
      expect(buildSpotUrl("the-earl", "atlanta", "overlay")).toBe("/atlanta?spot=the-earl");
    });
    it("returns canonical URL in canonical context", () => {
      expect(buildSpotUrl("the-earl", "atlanta", "canonical")).toBe("/atlanta/spots/the-earl");
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

  // ────────────────────────────────────────────────────────────────────
  // Swap-not-stack invariant
  //
  // When an overlay-producing builder is called with `existingParams`
  // that contain a sibling overlay key, the resulting URL must:
  //   1. Contain the newly-intended overlay key
  //   2. Contain NO other overlay keys (all siblings cleared)
  //   3. Preserve all non-overlay params (lane, tab, filters, etc.)
  //
  // Property-based: iterate every (priorKey, newBuilder) pair.
  // ────────────────────────────────────────────────────────────────────
  describe("swap-not-stack invariant", () => {
    type OverlayCase = {
      name: string;
      setsKey: string;
      setsValue: string;
      build: (existingParams?: URLSearchParams) => string;
    };

    const overlayBuilders: OverlayCase[] = [
      {
        name: "buildEventUrl",
        setsKey: "event",
        setsValue: "999",
        build: (p) => buildEventUrl(999, "atlanta", "overlay", p),
      },
      {
        name: "buildSpotUrl",
        setsKey: "spot",
        setsValue: "piedmont-park",
        build: (p) => buildSpotUrl("piedmont-park", "atlanta", "overlay", p),
      },
      {
        name: "buildOrgUrl",
        setsKey: "org",
        setsValue: "dad-garage",
        build: (p) => buildOrgUrl("dad-garage", "atlanta", p),
      },
    ];

    // For every overlay param that might already be set, and every
    // builder that might produce the next overlay, verify the resulting
    // URL has exactly the new key and none of the siblings.
    for (const priorKey of DETAIL_ENTRY_PARAM_KEYS) {
      for (const builder of overlayBuilders) {
        it(`${builder.name} clears prior '${priorKey}' and sets '${builder.setsKey}'`, () => {
          const existing = new URLSearchParams();
          existing.set(priorKey, "prior-value-abc");
          const url = builder.build(existing);
          const resultParams = new URL(url, "http://test").searchParams;

          // New key must be set with the expected value
          expect(resultParams.get(builder.setsKey)).toBe(builder.setsValue);

          // Every sibling overlay key (except the new one) must be absent
          for (const sibling of DETAIL_ENTRY_PARAM_KEYS) {
            if (sibling === builder.setsKey) continue;
            expect(resultParams.has(sibling)).toBe(false);
          }
        });
      }
    }

    it("preserves non-overlay params through the swap", () => {
      const existing = new URLSearchParams();
      existing.set("lane", "events");
      existing.set("tab", "tonight");
      existing.set("display", "map");
      existing.set("event", "prior-event-id");

      const url = buildSpotUrl("high-museum", "atlanta", "overlay", existing);
      const params = new URL(url, "http://test").searchParams;

      expect(params.get("spot")).toBe("high-museum");
      expect(params.has("event")).toBe(false); // swap: prior event cleared
      expect(params.get("lane")).toBe("events");
      expect(params.get("tab")).toBe("tonight");
      expect(params.get("display")).toBe("map");
    });

    it("replaces the same overlay key with a new value (self-swap)", () => {
      const existing = new URLSearchParams();
      existing.set("event", "123");
      const url = buildEventUrl(999, "atlanta", "overlay", existing);
      const params = new URL(url, "http://test").searchParams;
      expect(params.get("event")).toBe("999");
      expect(Array.from(params.keys()).filter((k) => k === "event")).toHaveLength(1);
    });

    it("works with no existingParams (first overlay open)", () => {
      const url = buildEventUrl(42, "atlanta", "overlay");
      expect(url).toBe("/atlanta?event=42");
    });

    it("canonical context ignores existingParams entirely", () => {
      const existing = new URLSearchParams();
      existing.set("spot", "prior");
      existing.set("lane", "events");
      const url = buildEventUrl(42, "atlanta", "canonical", existing);
      // Canonical URL is a different path with no query string
      expect(url).toBe("/atlanta/events/42");
    });

    it("handles multiple overlay keys set simultaneously (malformed state)", () => {
      // Defense-in-depth: if somehow the URL had more than one overlay
      // param already (e.g., from a malformed link), the builder still
      // produces a clean single-param URL.
      const existing = new URLSearchParams();
      existing.set("event", "1");
      existing.set("spot", "x");
      existing.set("org", "y");
      const url = buildSpotUrl("high-museum", "atlanta", "overlay", existing);
      const params = new URL(url, "http://test").searchParams;
      expect(params.get("spot")).toBe("high-museum");
      expect(params.has("event")).toBe(false);
      expect(params.has("org")).toBe(false);
    });
  });
});
