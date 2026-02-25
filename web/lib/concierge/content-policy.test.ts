import { describe, expect, it } from "vitest";
import type { Portal } from "@/lib/portal-context";
import type { FeedSection } from "@/lib/forth-types";
import { applyConciergeContentPolicy } from "@/lib/concierge/content-policy";

const portal = {
  id: "portal-1",
  slug: "forth",
  name: "FORTH Hotel",
  tagline: null,
  portal_type: "business",
  status: "active",
  visibility: "public",
  filters: { city: "Atlanta" },
  branding: {},
  settings: { vertical: "hotel" },
} as unknown as Portal;

function section(events: FeedSection["events"]): FeedSection {
  return {
    title: "Tonight",
    slug: "tonight",
    events,
  };
}

describe("concierge content policy", () => {
  it("removes hard-excluded low-fit clinic content when better options exist", () => {
    const sections = [
      section([
        {
          id: "clinic",
          title: "Mobile Vaccine Clinic",
          start_date: "2026-02-20",
          start_time: "10:00:00",
          category: "community",
        },
        {
          id: "jazz",
          title: "Rooftop Jazz Night",
          start_date: "2026-02-20",
          start_time: "20:00:00",
          category: "music",
        },
        {
          id: "dinner",
          title: "Chef Dinner Tasting",
          start_date: "2026-02-20",
          start_time: "19:30:00",
          category: "food_drink",
        },
      ]),
    ];

    const result = applyConciergeContentPolicy(portal, sections, "evening");
    const events = result.aroundSections[0]?.events || [];

    expect(events.some((event) => event.id === "clinic")).toBe(false);
    expect(events.some((event) => event.id === "jazz")).toBe(true);
    expect(events.some((event) => event.id === "dinner")).toBe(true);
  });

  it("falls back gracefully instead of returning empty sections", () => {
    const sections = [
      section([
        {
          id: "single",
          title: "Only Event Available",
          start_date: "2026-02-20",
          start_time: "12:00:00",
          category: "learning",
        },
        {
          id: "single-2",
          title: "Second Event Available",
          start_date: "2026-02-20",
          start_time: "13:00:00",
          category: "learning",
        },
      ]),
    ];

    const result = applyConciergeContentPolicy(portal, sections, "morning");
    expect(result.aroundSections).toHaveLength(1);
    expect(result.aroundSections[0].events.length).toBeGreaterThanOrEqual(2);
  });

  it("applies planner policy as softer fallback", () => {
    const sections = [
      {
        title: "Coming Up",
        slug: "coming-up",
        events: [
          {
            id: "community-1",
            title: "Community Workshop",
            start_date: "2026-02-22",
            start_time: "09:00:00",
            category: "community",
          },
          {
            id: "music-1",
            title: "Late Show",
            start_date: "2026-02-22",
            start_time: "21:00:00",
            category: "music",
          },
          {
            id: "film-1",
            title: "Cinema Night",
            start_date: "2026-02-22",
            start_time: "18:00:00",
            category: "film",
          },
        ],
      },
    ];

    const result = applyConciergeContentPolicy(portal, sections, "afternoon");
    expect(result.plannerSections).toHaveLength(1);
    expect(result.plannerSections[0].events.length).toBeGreaterThanOrEqual(2);
  });
});
