import { describe, expect, it } from "vitest";
import {
  getVolunteerThisWeekItems,
  isVolunteerCommunityEvent,
} from "./VolunteerThisWeekCard";
import type { CityPulseSection } from "@/lib/city-pulse/types";

function isoDate(daysFromToday: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  return date.toISOString().slice(0, 10);
}

function buildSections(): CityPulseSection[] {
  return [
    {
      id: "this-week",
      type: "this_week",
      title: "This Week",
      priority: "primary",
      items: [
        {
          item_type: "event",
          event: {
            id: 1,
            title: "Food Pantry Shift",
            start_date: isoDate(1),
            start_time: "09:00:00",
            is_all_day: false,
            is_free: true,
            price_min: null,
            price_max: null,
            category: "community",
            tags: ["volunteer"],
            image_url: null,
            description: "Pack food boxes.",
            venue: { id: 10, name: "Pantry", neighborhood: "Downtown" },
          },
        },
        {
          item_type: "event",
          event: {
            id: 2,
            title: "City council meeting",
            start_date: isoDate(2),
            start_time: "18:00:00",
            is_all_day: false,
            is_free: true,
            price_min: null,
            price_max: null,
            category: "government",
            tags: ["council"],
            image_url: null,
            description: "Agenda review.",
            venue: { id: 11, name: "City Hall", neighborhood: "Downtown" },
          },
        },
        {
          item_type: "event",
          event: {
            id: 3,
            title: "Park cleanup",
            start_date: isoDate(10),
            start_time: "10:00:00",
            is_all_day: false,
            is_free: true,
            price_min: null,
            price_max: null,
            category: "community",
            tags: ["volunteer"],
            image_url: null,
            description: "Cleanup day.",
            venue: { id: 12, name: "Grant Park", neighborhood: "Grant Park" },
          },
        },
      ],
    },
    {
      id: "coming-up",
      type: "coming_up",
      title: "Coming Up",
      priority: "secondary",
      items: [
        {
          item_type: "event",
          event: {
            id: 1,
            title: "Food Pantry Shift",
            start_date: isoDate(1),
            start_time: "09:00:00",
            is_all_day: false,
            is_free: true,
            price_min: null,
            price_max: null,
            category: "community",
            tags: ["volunteer"],
            image_url: null,
            description: "Duplicate row should dedupe.",
            venue: { id: 10, name: "Pantry", neighborhood: "Downtown" },
          },
        },
      ],
    },
  ];
}

describe("VolunteerThisWeekCard helpers", () => {
  it("detects volunteer/community events from stable category or tags", () => {
    expect(
      isVolunteerCommunityEvent({
        id: 1,
        title: "Shift",
        start_date: isoDate(1),
        start_time: "09:00:00",
        is_all_day: false,
        is_free: true,
        price_min: null,
        price_max: null,
        category: "community",
        tags: ["service"],
        image_url: null,
        description: null,
        venue: null,
      }),
    ).toBe(true);

    expect(
      isVolunteerCommunityEvent({
        id: 2,
        title: "Meeting",
        start_date: isoDate(1),
        start_time: "09:00:00",
        is_all_day: false,
        is_free: true,
        price_min: null,
        price_max: null,
        category: "government",
        tags: ["agenda"],
        image_url: null,
        description: null,
        venue: null,
      }),
    ).toBe(false);

    expect(
      isVolunteerCommunityEvent({
        id: 3,
        title: "Neighborhood planning meeting",
        start_date: isoDate(1),
        start_time: "18:00:00",
        is_all_day: false,
        is_free: true,
        price_min: null,
        price_max: null,
        category: "community",
        tags: ["government", "public-meeting", "civic-engagement"],
        image_url: null,
        description: null,
        venue: null,
      }),
    ).toBe(false);

    expect(
      isVolunteerCommunityEvent({
        id: 4,
        title: "Community Development/Human Services Committee — Regular Committee Meeting",
        start_date: isoDate(1),
        start_time: "13:30:00",
        is_all_day: false,
        is_free: true,
        price_min: null,
        price_max: null,
        category: "community",
        tags: ["government", "public-meeting", "civic-engagement", "atlanta"],
        genres: ["volunteer"],
        image_url: null,
        description: null,
        venue: null,
      }),
    ).toBe(false);
  });

  it("returns only deduped volunteer events within the next 7 days", () => {
    const items = getVolunteerThisWeekItems(buildSections());
    expect(items.map((item) => item.id)).toEqual([1]);
  });

  it("dedupes mirrored volunteer listings by normalized title and start slot", () => {
    const sections: CityPulseSection[] = [
      {
        id: "this-week",
        type: "this_week",
        title: "This Week",
        priority: "primary",
        items: [
          {
            item_type: "event",
            event: {
              id: 11,
              title: "Volunteer: Altar Of Grace Pantry",
              start_date: isoDate(1),
              start_time: "09:00:00",
              is_all_day: false,
              is_free: true,
              price_min: null,
              price_max: null,
              category: "community",
              tags: ["volunteer"],
              genres: ["volunteer"],
              image_url: null,
              description: "Source A",
              venue: { id: 1, name: "Pantry A", neighborhood: "Downtown" },
            },
          },
          {
            item_type: "event",
            event: {
              id: 12,
              title: "Volunteer:   Altar Of Grace Pantry",
              start_date: isoDate(1),
              start_time: "09:00:00",
              is_all_day: false,
              is_free: true,
              price_min: null,
              price_max: null,
              category: "community",
              tags: ["volunteer", "volunteer-opportunity"],
              genres: ["support"],
              image_url: null,
              description: "Source B",
              venue: { id: 2, name: "Pantry B", neighborhood: "Midtown" },
            },
          },
        ],
      },
    ];

    const items = getVolunteerThisWeekItems(sections);
    expect(items).toHaveLength(1);
    expect(items[0]?.id).toBe(11);
  });
});
