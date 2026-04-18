import { describe, expect, it } from "vitest";
import { buildShowPayload } from "./build-show-payload";
import { makeRawEventRow } from "./__fixtures__/raw-event";

describe("buildShowPayload", () => {
  it("maps a minimal row correctly", () => {
    const payload = buildShowPayload(
      makeRawEventRow({
        doors_time: "19:00",
        is_curator_pick: true,
        importance: "major",
        ticket_status: "tickets-available",
        tags: ["indie-rock"],
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
      }),
    );
    expect(payload.venue.display_tier).toBe("editorial");
    expect(payload.venue.capacity_band).toBe("intimate");
    expect(payload.genre_buckets).toEqual(["Rock"]);
    expect(payload.is_curator_pick).toBe(true);
  });

  it("orders headliner before support by billing_order", () => {
    const payload = buildShowPayload(
      makeRawEventRow({
        start_time: null,
        is_free: null,
        is_curator_pick: null,
        is_tentpole: null,
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
      }),
    );
    expect(payload.artists[0].name).toBe("Headliner");
    expect(payload.artists[1].name).toBe("Support");
  });
});
