import { describe, expect, it } from "vitest";
import {
  getPortalFeedDateRange,
  isPortalCommunityActionSection,
  isPortalSectionVisible,
} from "@/lib/portal-feed-section-rules";

describe("portal-feed-section-rules", () => {
  it("evaluates section visibility against date, day, and time windows", () => {
    expect(
      isPortalSectionVisible(
        {
          schedule_start: "2026-03-01",
          schedule_end: "2026-03-31",
          show_on_days: ["monday"],
          show_after_time: "09:00",
          show_before_time: "17:00",
        },
        new Date("2026-03-09T14:30:00"),
      ),
    ).toBe(true);

    expect(
      isPortalSectionVisible(
        {
          schedule_start: "2026-03-10",
          schedule_end: null,
          show_on_days: null,
          show_after_time: null,
          show_before_time: null,
        },
        new Date("2026-03-09T14:30:00"),
      ),
    ).toBe(false);
  });

  it("builds weekend and rolling date ranges", () => {
    expect(
      getPortalFeedDateRange("this_weekend", new Date("2026-03-09T12:00:00")),
    ).toEqual({
      start: "2026-03-13",
      end: "2026-03-15",
    });

    expect(
      getPortalFeedDateRange("next_7_days", new Date("2026-03-09T12:00:00")),
    ).toEqual({
      start: "2026-03-09",
      end: "2026-03-16",
    });
  });

  it("detects community-action sections from categories, tags, and text hints", () => {
    expect(
      isPortalCommunityActionSection({
        slug: "neighborhood-volunteer",
        title: "Neighborhood Volunteer",
        auto_filter: {
          categories: ["community"],
        },
      }),
    ).toBe(true);

    expect(
      isPortalCommunityActionSection({
        slug: "plain-events",
        title: "Plain Events",
        auto_filter: {
          tags: ["music"],
        },
      }),
    ).toBe(false);

    expect(
      isPortalCommunityActionSection({
        slug: "get-involved",
        title: "Get Involved",
        auto_filter: {},
      }),
    ).toBe(true);
  });
});
