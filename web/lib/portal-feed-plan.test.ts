import { describe, expect, it } from "vitest";
import {
  buildPortalFeedAutoSectionPlan,
  shouldSectionUseAutoEventPool,
  type PortalFeedAutoSectionInput,
} from "@/lib/portal-feed-plan";

describe("portal-feed-plan", () => {
  it("selects only eligible auto and mixed sections for the shared event pool", () => {
    expect(
      shouldSectionUseAutoEventPool({
        blockType: "cards",
        sectionType: "auto",
        maxItems: 6,
        autoFilter: {},
      }),
    ).toBe(true);

    expect(
      shouldSectionUseAutoEventPool({
        blockType: "announcement",
        sectionType: "auto",
        maxItems: 6,
        autoFilter: {},
      }),
    ).toBe(false);

    expect(
      shouldSectionUseAutoEventPool({
        blockType: "cards",
        sectionType: "mixed",
        maxItems: 6,
        autoFilter: { eventIds: [12] },
      }),
    ).toBe(false);
  });

  it("builds a stable plan for source-constrained and nightlife-heavy feeds", () => {
    const sections: PortalFeedAutoSectionInput[] = [
      {
        blockType: "cards",
        sectionType: "auto",
        maxItems: 40,
        autoFilter: {
          sourceSlugs: ["late-night", "music"],
          sourceIds: [10, 4],
          venueIds: [100],
          dateFilter: "next_30_days",
          nightlifeMode: true,
        },
      },
      {
        blockType: "list",
        sectionType: "mixed",
        maxItems: 25,
        autoFilter: {
          sourceSlugs: ["music", "comedy"],
          sourceIds: [4, 12],
          venueIds: [200, 100],
          dateFilter: "tomorrow",
        },
      },
    ];

    expect(
      buildPortalFeedAutoSectionPlan({
        sections,
        defaultLimit: 5,
        itemsPerSection: 6,
        defaultMaxEndDate: "2026-03-23",
        resolveDateRangeEnd: (filter) =>
          ({
            tomorrow: "2026-03-10",
            next_30_days: "2026-04-08",
            today: "2026-03-09",
            this_weekend: "2026-03-15",
            next_7_days: "2026-03-16",
          })[filter],
      }),
    ).toEqual({
      requestedSourceSlugs: ["comedy", "late-night", "music"],
      constrainedSourceIds: [4, 10, 12],
      constrainedVenueIds: [100, 200],
      maxEndDate: "2026-04-08",
      perBucketLimit: 130,
      hasNightlifeSection: true,
      constrainedSupplementalLimit: 90,
    });
  });

  it("applies the floor and non-nightlife ceiling for broad but non-nightlife feeds", () => {
    expect(
      buildPortalFeedAutoSectionPlan({
        sections: [
          {
            blockType: "cards",
            sectionType: "auto",
            maxItems: 3,
            autoFilter: {},
          },
        ],
        defaultLimit: 5,
        itemsPerSection: 5,
        defaultMaxEndDate: "2026-03-23",
        resolveDateRangeEnd: () => "2026-03-23",
      }),
    ).toEqual({
      requestedSourceSlugs: [],
      constrainedSourceIds: [],
      constrainedVenueIds: [],
      maxEndDate: "2026-03-23",
      perBucketLimit: 40,
      hasNightlifeSection: false,
      constrainedSupplementalLimit: 80,
    });
  });
});
