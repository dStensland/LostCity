import { describe, expect, it } from "vitest";
import {
  attachPortalSocialCounts,
  buildPortalHolidayFeedSections,
  finalizePortalFeedSections,
} from "@/lib/portal-feed-finalize";

describe("portal-feed-finalize", () => {
  it("builds holiday sections from tag-indexed events", () => {
    const sections = buildPortalHolidayFeedSections(
      [
        {
          id: "holiday-1",
          display_order: -2,
          max_items: 2,
          auto_filter: { tags: ["st-patricks-day"] },
          block_type: "collapsible_events",
        },
      ],
      new Map([
        [
          "st-patricks-day",
          [
            { id: 1, title: "Iftar" },
            { id: 2, title: "Prayer" },
            { id: 3, title: "Community Meal" },
          ],
        ],
      ]),
    );

    expect(sections[0].events.map((event) => event.id)).toEqual([1, 2]);
  });

  it("sorts holiday sections, dedupes events across sections, and drops undersized event sections", () => {
    const finalized = finalizePortalFeedSections(
      [
        {
          id: "feed-a",
          block_type: "event_cards",
          events: [{ id: 2 }, { id: 3 }, { id: 6 }],
        },
        {
          id: "feed-b",
          block_type: "event_cards",
          events: [{ id: 4 }],
        },
      ],
      [
        {
          id: "holiday-b",
          block_type: "collapsible_events",
          events: [{ id: 2 }, { id: 5 }],
        },
        {
          id: "holiday-a",
          block_type: "collapsible_events",
          events: [{ id: 1 }],
        },
      ],
      new Map([
        ["holiday-a", -10],
        ["holiday-b", -5],
      ]),
    );

    expect(finalized.map((section) => section.id)).toEqual(["holiday-b", "feed-a"]);
    expect(finalized[0].events.map((event) => event.id)).toEqual([2, 5]);
    expect(finalized[1].events.map((event) => event.id)).toEqual([3, 6]);
  });

  it("keeps non-event sections and attaches social counts to each event", () => {
    const sectionsWithCounts = attachPortalSocialCounts(
      [
        {
          id: "section-a",
          block_type: "announcement",
          events: [],
        },
        {
          id: "section-b",
          block_type: "event_cards",
          events: [{ id: 10, title: "Show" }],
        },
      ],
      new Map([[10, { going: 4, interested: 2, recommendations: 1 }]]),
    );

    expect(sectionsWithCounts[0].events).toEqual([]);
    expect(sectionsWithCounts[1].events[0]).toMatchObject({
      id: 10,
      going_count: 4,
      interested_count: 2,
      recommendation_count: 1,
    });
  });
});
