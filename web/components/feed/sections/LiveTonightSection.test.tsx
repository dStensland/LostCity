import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LiveTonightSection } from "./LiveTonightSection";

vi.mock("@/lib/music/this-week-loader", () => ({
  loadThisWeek: vi.fn(async () => ({ shows: [] })),
}));
vi.mock("@/lib/music/tonight-loader", () => ({
  loadTonight: vi.fn(async () => ({ date: "2026-04-20", tonight: [], late_night: [] })),
}));

describe("LiveTonightSection", () => {
  it("renders nothing when there's nothing to show", async () => {
    const { container } = render(await LiveTonightSection({ portalSlug: "atlanta" }));
    expect(container.firstChild).toBeNull();
  });

  it("renders the section header when tonight has data", async () => {
    const { loadTonight } = await import("@/lib/music/tonight-loader");
    const venue = {
      id: 1, name: "Terminal West", slug: "terminal-west", neighborhood: "West Midtown",
      image_url: null, hero_image_url: null, music_programming_style: null,
      music_venue_formats: [], capacity: 600, editorial_line: null,
      display_tier: "editorial" as const, capacity_band: "club" as const,
    };
    (loadTonight as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      date: "2026-04-20",
      tonight: [
        {
          venue,
          shows: [
            {
              id: 100,
              title: "Some Band",
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
              tags: [],
              genres: [],
              genre_buckets: [],
              venue,
              artists: [],
            },
          ],
        },
      ],
      late_night: [],
    });
    render(await LiveTonightSection({ portalSlug: "atlanta" }));
    expect(screen.getByText(/Live Tonight/)).toBeInTheDocument();
  });
});
