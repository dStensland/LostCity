import { describe, expect, it } from "vitest";
import {
  buildPersonalizedFeedSections,
  rankAndFilterPersonalizedFeedEvents,
  type PersonalizedFeedEvent,
} from "@/lib/feed-personalization";

const baseEvents: PersonalizedFeedEvent[] = [
  {
    id: 1,
    title: "Jazz Night",
    start_date: "2026-03-09",
    start_time: "20:00:00",
    is_free: false,
    price_min: 20,
    category: "music",
    genres: ["jazz"],
    tags: ["live"],
    image_url: "https://example.com/jazz.jpg",
    organization_id: "org-1",
    source_id: 11,
    venue: { id: 101, name: "Blue Room", neighborhood: "Midtown" },
  },
  {
    id: 2,
    title: "Family Fair",
    start_date: "2026-03-10",
    start_time: "11:00:00",
    is_free: true,
    price_min: null,
    category: "family",
    genres: null,
    tags: ["kids"],
    image_url: null,
    organization_id: null,
    source_id: 12,
    venue: { id: 102, name: "Park", neighborhood: "Old Fourth Ward" },
  },
  {
    id: 3,
    title: "Generic Movie Showtime",
    start_date: "2026-03-09",
    start_time: "19:00:00",
    is_free: false,
    price_min: 18,
    category: "film",
    genres: null,
    tags: ["regular_showtime"],
    image_url: null,
    organization_id: null,
    source_id: 13,
    venue: { id: 103, name: "Cinema", neighborhood: "Downtown" },
  },
];

describe("feed-personalization", () => {
  it("ranks events using follow/friend/taste signals and suppresses regular showtimes", () => {
    const ranked = rankAndFilterPersonalizedFeedEvents(baseEvents, {
      now: new Date("2026-03-09T12:00:00Z"),
      favoriteCategories: ["music"],
      favoriteGenreSet: new Set(["jazz"]),
      favoriteNeighborhoods: ["Midtown"],
      needsAccessibility: [],
      needsDietary: [],
      needsFamily: [],
      followedVenueIds: [101],
      followedOrganizationIds: ["org-1"],
      sourceOrganizationMap: {},
      channelMatchesByEventId: new Map([[1, [{ channel_name: "Live Music" }]]]),
      friendsGoingMap: {
        1: [{ user_id: "u1", username: "amy", display_name: "Amy" }],
      },
      recommendationLabels: null,
      pricePreference: "budget",
      restrictToPersonalizedMatches: false,
      shouldSuppressRegularShowtime: (event) =>
        (event.tags || []).includes("regular_showtime"),
    });

    expect(ranked.map((event) => event.id)).toEqual([1, 2]);
    expect(ranked[0].reasons?.map((reason) => reason.type)).toEqual([
      "friends_going",
      "followed_venue",
      "followed_organization",
      "followed_channel",
      "neighborhood",
      "price",
      "category",
    ]);
  });

  it("restricts to personalized matches when requested", () => {
    const ranked = rankAndFilterPersonalizedFeedEvents(baseEvents, {
      now: new Date("2026-03-09T12:00:00Z"),
      favoriteCategories: ["music"],
      favoriteGenreSet: new Set(["jazz"]),
      favoriteNeighborhoods: [],
      needsAccessibility: [],
      needsDietary: [],
      needsFamily: [],
      followedVenueIds: [],
      followedOrganizationIds: [],
      sourceOrganizationMap: {},
      channelMatchesByEventId: new Map(),
      friendsGoingMap: {},
      recommendationLabels: null,
      pricePreference: null,
      restrictToPersonalizedMatches: true,
      shouldSuppressRegularShowtime: () => false,
    });

    expect(ranked.map((event) => event.id)).toEqual([1]);
  });

  it("builds personalized sections from ranked events", () => {
    const events = [
      {
        ...baseEvents[0],
        score: 90,
        reasons: [{ type: "followed_venue", label: "You follow this venue" }],
      },
      {
        ...baseEvents[1],
        score: 40,
        friends_going: [
          { user_id: "u1", username: "amy", display_name: "Amy" },
        ],
      },
      {
        ...baseEvents[0],
        id: 4,
        start_date: "2026-03-09",
        score: 35,
        reasons: [{ type: "followed_channel", label: "Matches your channels" }],
      },
      {
        ...baseEvents[1],
        id: 5,
        start_date: "2026-03-15",
        score: 5,
      },
      {
        ...baseEvents[1],
        id: 6,
        start_date: "2026-03-14",
        score: 18,
        friends_going: [
          { user_id: "u2", username: "ben", display_name: "Ben" },
        ],
      },
    ];

    const sections = buildPersonalizedFeedSections(events, {
      now: new Date("2026-03-09T12:00:00Z"),
      today: "2026-03-09",
      weekFromNow: "2026-03-16",
      favoriteCategories: ["music"],
      favoriteGenreSet: new Set(["jazz"]),
      favoriteNeighborhoods: ["Midtown"],
      needsAccessibility: [],
      needsDietary: [],
      needsFamily: ["kids"],
    });

    expect(sections.map((section) => section.id)).toEqual([
      "tonight_for_you",
      "this_week_fits_your_taste",
    ]);
  });
});
