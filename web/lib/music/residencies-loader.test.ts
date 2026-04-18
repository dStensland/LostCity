import { describe, expect, it } from "vitest";
import {
  mapNextEventToVenue,
  type ResidencyNextEventRow,
} from "./residencies-loader";

function makeRow(
  overrides: Partial<ResidencyNextEventRow["place"]> = {},
  eventOverrides: Partial<Omit<ResidencyNextEventRow, "place">> = {},
): ResidencyNextEventRow {
  return {
    id: 101,
    start_date: "2026-04-20",
    start_time: "21:00",
    doors_time: null,
    ...eventOverrides,
    place: {
      id: 7,
      name: "Eddie's Attic",
      slug: "eddies-attic",
      neighborhood: "Decatur",
      image_url: null,
      hero_image_url: null,
      short_description: "Listening-room folk since 1992.",
      music_programming_style: "listening_room",
      music_venue_formats: ["seated"],
      capacity: 180,
      ...overrides,
    },
  };
}

describe("mapNextEventToVenue", () => {
  it("classifies a curated venue as editorial with intimate capacity band", () => {
    const venue = mapNextEventToVenue(makeRow());
    expect(venue.id).toBe(7);
    expect(venue.slug).toBe("eddies-attic");
    expect(venue.display_tier).toBe("editorial");
    expect(venue.capacity_band).toBe("intimate");
    expect(venue.editorial_line).toBe("Listening-room folk since 1992.");
    expect(venue.music_venue_formats).toEqual(["seated"]);
  });

  it("classifies a large-capacity venue without style as marquee/theater", () => {
    const venue = mapNextEventToVenue(
      makeRow({
        music_programming_style: null,
        capacity: 1500,
      }),
    );
    expect(venue.display_tier).toBe("marquee");
    expect(venue.capacity_band).toBe("theater");
  });

  it("falls back to additional / null band when nothing is known", () => {
    const venue = mapNextEventToVenue(
      makeRow({
        music_programming_style: null,
        capacity: null,
        music_venue_formats: null,
      }),
    );
    expect(venue.display_tier).toBe("additional");
    expect(venue.capacity_band).toBeNull();
    expect(venue.music_venue_formats).toEqual([]);
  });
});
