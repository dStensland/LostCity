import { describe, expect, it } from "vitest";
import {
  buildScreeningBundle,
  fetchScreeningBundleFromTables,
  isScreeningLikeEvent,
} from "@/lib/screenings";

describe("screenings", () => {
  it("recognizes screening-like events from film metadata and showtime tags", () => {
    expect(
      isScreeningLikeEvent({
        id: 1,
        title: "Sinners",
        start_date: "2026-04-10",
        start_time: "19:00:00",
        end_time: null,
        image_url: null,
        source_url: null,
        ticket_url: null,
        category_id: "film",
      }),
    ).toBe(true);

    expect(
      isScreeningLikeEvent({
        id: 2,
        title: "Author Talk",
        start_date: "2026-04-10",
        start_time: "19:00:00",
        end_time: null,
        image_url: null,
        source_url: null,
        ticket_url: null,
        tags: ["community"],
      }),
    ).toBe(false);
  });

  it("builds additive title, run, and time layers from showtime events", () => {
    const bundle = buildScreeningBundle(
      [
        {
          id: 10,
          title: "Sinners",
          start_date: "2026-04-10",
          start_time: "19:00:00",
          end_time: "21:10:00",
          image_url: "https://example.com/sinners.jpg",
          source_url: "https://example.com/showtime-1",
          ticket_url: "https://example.com/tickets-1",
          source_id: 88,
          tags: ["showtime", "imax"],
          category_id: "film",
          series_id: "film-sinners",
          series: {
            id: "film-sinners",
            slug: "sinners",
            title: "Sinners",
            series_type: "film",
            image_url: "https://example.com/poster.jpg",
            genres: ["thriller"],
          },
        },
        {
          id: 11,
          title: "Sinners",
          start_date: "2026-04-10",
          start_time: "21:45:00",
          end_time: "23:55:00",
          image_url: "https://example.com/sinners.jpg",
          source_url: "https://example.com/showtime-2",
          ticket_url: "https://example.com/tickets-2",
          source_id: 88,
          tags: ["showtime"],
          category_id: "film",
          series_id: "film-sinners",
          series: {
            id: "film-sinners",
            slug: "sinners",
            title: "Sinners",
            series_type: "film",
            image_url: "https://example.com/poster.jpg",
            genres: ["thriller"],
          },
        },
      ],
      { placeId: 44 },
    );

    expect(bundle.titles).toHaveLength(1);
    expect(bundle.runs).toHaveLength(1);
    expect(bundle.times).toHaveLength(2);
    expect(bundle.titles[0]).toMatchObject({
      canonical_title: "Sinners",
      kind: "film",
      genres: ["thriller"],
    });
    expect(bundle.runs[0]).toMatchObject({
      place_id: 44,
      start_date: "2026-04-10",
      end_date: "2026-04-10",
      is_special_event: false,
    });
    expect(bundle.times.map((time) => time.start_time)).toEqual([
      "19:00:00",
      "21:45:00",
    ]);
    expect(bundle.times[0].format_labels).toEqual(["IMAX"]);
  });

  it("marks non-showtime screenings as special events", () => {
    const bundle = buildScreeningBundle(
      [
        {
          id: 12,
          title: "Opening Night: Shorts Block",
          start_date: "2026-05-01",
          start_time: "18:30:00",
          end_time: "20:00:00",
          image_url: null,
          description: "Festival kickoff.",
          source_url: "https://example.com/program",
          ticket_url: null,
          tags: ["festival"],
          category_id: "film",
          series: {
            id: "aff-opening-night",
            slug: "opening-night",
            title: "Opening Night: Shorts Block",
            series_type: "festival_program",
            image_url: null,
            festival: {
              id: "atlanta-film-festival",
              name: "Atlanta Film Festival",
            },
          },
        },
      ],
      { placeId: 44 },
    );

    expect(bundle.titles[0]?.kind).toBe("festival_screening_block");
    expect(bundle.runs[0]?.is_special_event).toBe(true);
  });

  it("returns null when screening tables are unavailable", async () => {
    const bundle = await fetchScreeningBundleFromTables(
      {
        from: () => ({
          select: () => ({
            eq: () =>
              Promise.resolve({
                data: null,
                error: { code: "42P01", message: 'relation "screening_runs" does not exist' },
              }),
          }),
        }),
      },
      { placeId: 44 },
    );

    expect(bundle).toBeNull();
  });

  it("hydrates a bundle from screening tables when rows exist", async () => {
    const tables = {
      screening_runs: [
        {
          id: "run-1",
          screening_title_id: "title-1",
          place_id: 44,
          festival_id: null,
          label: "Sinners",
          start_date: "2026-04-10",
          end_date: "2026-04-12",
          source_id: 88,
          buy_url: "https://example.com/tickets",
          info_url: "https://example.com/info",
          is_special_event: false,
        },
      ],
      screening_titles: [
        {
          id: "title-1",
          canonical_title: "Sinners",
          slug: "sinners",
          kind: "film",
          poster_image_url: "https://example.com/poster.jpg",
          synopsis: "A thriller.",
          genres: ["thriller"],
          tmdb_id: 101,
          imdb_id: "tt123",
          festival_work_key: null,
        },
      ],
      screening_times: [
        {
          id: "time-2",
          screening_run_id: "run-1",
          event_id: 101,
          start_date: "2026-04-10",
          start_time: "21:30:00",
          end_time: "23:50:00",
          ticket_url: "https://example.com/tickets/late",
          source_url: "https://example.com/showtime/late",
          format_labels: [],
          status: "scheduled",
        },
        {
          id: "time-1",
          screening_run_id: "run-1",
          event_id: 100,
          start_date: "2026-04-10",
          start_time: "19:00:00",
          end_time: "21:20:00",
          ticket_url: "https://example.com/tickets/early",
          source_url: "https://example.com/showtime/early",
          format_labels: ["IMAX"],
          status: "scheduled",
        },
      ],
    };

    const bundle = await fetchScreeningBundleFromTables(
      {
        from: (table: string) => ({
          select: () => ({
            eq: () =>
              Promise.resolve({ data: tables[table as keyof typeof tables], error: null }),
            in: () =>
              Promise.resolve({ data: tables[table as keyof typeof tables], error: null }),
            order: () => Promise.resolve({ data: tables[table as keyof typeof tables], error: null }),
          }),
        }),
      },
      { placeId: 44 },
    );

    expect(bundle).not.toBeNull();
    expect(bundle?.titles[0]?.canonical_title).toBe("Sinners");
    expect(bundle?.runs[0]?.id).toBe("run-1");
    expect(bundle?.times.map((time) => time.id)).toEqual(["time-1", "time-2"]);
  });
});
