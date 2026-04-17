import { describe, expect, it } from "vitest";
import { buildShowPayload } from "./build-show-payload";

describe("buildShowPayload", () => {
  it("maps a minimal row correctly", () => {
    const payload = buildShowPayload({
      id: 1,
      title: "Show",
      start_date: "2026-04-20",
      start_time: "20:00",
      doors_time: "19:00",
      image_url: null,
      is_free: false,
      is_curator_pick: true,
      is_tentpole: false,
      importance: "major",
      festival_id: null,
      ticket_status: "tickets-available",
      ticket_url: null,
      age_policy: null,
      featured_blurb: null,
      tags: ["indie-rock"],
      genres: null,
      place: {
        id: 5,
        name: "Venue",
        slug: "venue",
        neighborhood: "EAV",
        image_url: null,
        hero_image_url: null,
        short_description: null,
        music_programming_style: "curated_indie",
        music_venue_formats: ["standing_room"],
        capacity: 200,
      },
      event_artists: [],
    });
    expect(payload.venue.display_tier).toBe("editorial");
    expect(payload.venue.capacity_band).toBe("intimate");
    expect(payload.genre_buckets).toEqual(["Rock"]);
    expect(payload.is_curator_pick).toBe(true);
  });

  it("orders headliner before support by billing_order", () => {
    const payload = buildShowPayload({
      id: 1,
      title: "Show",
      start_date: "2026-04-20",
      start_time: null,
      doors_time: null,
      image_url: null,
      is_free: null,
      is_curator_pick: null,
      is_tentpole: null,
      importance: null,
      festival_id: null,
      ticket_status: null,
      ticket_url: null,
      age_policy: null,
      featured_blurb: null,
      tags: null,
      genres: null,
      place: {
        id: 1,
        name: "V",
        slug: "v",
        neighborhood: null,
        image_url: null,
        hero_image_url: null,
        short_description: null,
        music_programming_style: null,
        music_venue_formats: [],
        capacity: null,
      },
      event_artists: [
        {
          artist_id: "a",
          name: "Support",
          is_headliner: false,
          billing_order: 2,
          artist: null,
        },
        {
          artist_id: "b",
          name: "Headliner",
          is_headliner: true,
          billing_order: 1,
          artist: null,
        },
      ],
    });
    expect(payload.artists[0].name).toBe("Headliner");
    expect(payload.artists[1].name).toBe("Support");
  });
});
