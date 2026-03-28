import { describe, expect, it } from "vitest";
import {
  filterVenueFeaturesForPortal,
  type VenueFeature,
} from "@/lib/place-features";

const baseFeature: VenueFeature = {
  id: 1,
  slug: "wildlife-walk",
  title: "Wildlife Walk",
  feature_type: "attraction",
  description: "A family-friendly trail feature.",
  image_url: null,
  url: "https://example.com",
  is_seasonal: false,
  start_date: null,
  end_date: null,
  price_note: null,
  is_free: false,
  sort_order: 10,
};

describe("filterVenueFeaturesForPortal", () => {
  it("keeps atlanta-owned feature packs intact outside atlanta-families", () => {
    const features = [
      baseFeature,
      {
        ...baseFeature,
        id: 2,
        slug: "birdseed-fundraiser-pick-up",
        title: "Birdseed Fundraiser Pick Up",
      },
    ];

    const result = filterVenueFeaturesForPortal(features, {
      portalSlug: "atlanta",
      venueSlug: "chattahoochee-nature-center",
    });

    expect(result).toHaveLength(2);
  });

  it("drops obviously non-outing operational rows for atlanta-families", () => {
    const features = [
      baseFeature,
      {
        ...baseFeature,
        id: 2,
        slug: "birdseed-fundraiser-pick-up",
        title: "Birdseed Fundraiser Pick Up",
      },
    ];

    const result = filterVenueFeaturesForPortal(features, {
      portalSlug: "atlanta-families",
      venueSlug: "chattahoochee-nature-center",
    });

    expect(result.map((feature) => feature.slug)).toEqual(["wildlife-walk"]);
  });

  it("applies venue-specific allowlists for mixed legacy packs", () => {
    const features = [
      baseFeature,
      {
        ...baseFeature,
        id: 2,
        slug: "unknown-admin-row",
        title: "Unknown Admin Row",
      },
      {
        ...baseFeature,
        id: 3,
        slug: "winter-gallery",
        title: "Winter Gallery",
        feature_type: "exhibition",
      },
    ];

    const result = filterVenueFeaturesForPortal(features, {
      portalSlug: "atlanta-families",
      venueSlug: "chattahoochee-nature-center",
    });

    expect(result.map((feature) => feature.slug)).toEqual([
      "wildlife-walk",
      "winter-gallery",
    ]);
  });
});
