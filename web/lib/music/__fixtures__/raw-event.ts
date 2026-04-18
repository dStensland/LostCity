import type { RawEventRow } from "../build-show-payload";

/**
 * Factory for RawEventRow test fixtures. Overrides are shallow-merged onto
 * sensible defaults. Sibling loaders (Tasks 11-16) reuse this.
 */
export function makeRawEventRow(
  overrides: Partial<RawEventRow> = {},
): RawEventRow {
  return {
    id: 1,
    title: "Show",
    start_date: "2026-04-20",
    start_time: "20:00",
    doors_time: null,
    image_url: null,
    is_free: false,
    is_curator_pick: false,
    is_tentpole: false,
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
    event_artists: [],
    ...overrides,
  };
}
