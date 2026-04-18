import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { LiveTonightPlaybill } from "./LiveTonightPlaybill";
import type { MusicShowPayload, MusicVenuePayload, TonightPayload } from "@/lib/music/types";

function mkVenue(id: number, name: string, slug: string): MusicVenuePayload {
  return {
    id,
    name,
    slug,
    neighborhood: null,
    image_url: null,
    hero_image_url: null,
    music_programming_style: "curated_indie",
    music_venue_formats: [],
    capacity: 300,
    editorial_line: null,
    display_tier: "editorial",
    capacity_band: "club",
  };
}

function mkShow(overrides: Partial<MusicShowPayload> & { venue: MusicVenuePayload }): MusicShowPayload {
  return {
    id: Math.random(),
    title: "Show",
    start_date: "2026-04-17",
    start_time: "20:00",
    doors_time: "19:00",
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
    artists: [{ id: "a", slug: "a", name: "Headliner", is_headliner: true, billing_order: 1 }],
    ...overrides,
  };
}

describe("LiveTonightPlaybill", () => {
  it("renders an empty-state link when no shows tonight", () => {
    const payload: TonightPayload = { date: "2026-04-17", tonight: [], late_night: [] };
    render(<LiveTonightPlaybill payload={payload} portalSlug="atlanta" />);
    expect(screen.getByRole("link").getAttribute("href")).toBe("/atlanta/explore/music");
  });

  it("renders Tonight sub-header with show count + venue count", () => {
    const venue = mkVenue(1, "The Earl", "the-earl");
    const payload: TonightPayload = {
      date: "2026-04-17",
      tonight: [{ venue, shows: [mkShow({ venue }), mkShow({ venue, id: 2 })] }],
      late_night: [],
    };
    render(<LiveTonightPlaybill payload={payload} portalSlug="atlanta" />);
    expect(screen.getByText(/2 shows/i)).toBeInTheDocument();
    expect(screen.getByText(/1 of 1 venues/i)).toBeInTheDocument();
  });

  it("ignores late_night data in feed view (no separate Late band, no merged kicker)", () => {
    const venue1 = mkVenue(1, "The Earl", "the-earl");
    const lateVenue = mkVenue(2, "Velvet Note", "velvet-note");
    const payload: TonightPayload = {
      date: "2026-04-17",
      tonight: [{ venue: venue1, shows: [mkShow({ venue: venue1 })] }],
      late_night: [{ venue: lateVenue, shows: [mkShow({ venue: lateVenue, doors_time: "22:30" })] }],
    };
    render(<LiveTonightPlaybill payload={payload} portalSlug="atlanta" />);

    // No LATE label anywhere — late shows don't render in feed view
    expect(screen.queryByText(/LATE · AFTER 9 PM/i)).not.toBeInTheDocument();
    // Late venue is not rendered
    expect(screen.queryByText("Velvet Note")).not.toBeInTheDocument();
    // Tonight venue still renders
    expect(screen.getByText("Earl")).toBeInTheDocument();
  });

  it("does NOT render any kicker labels (kickers are dropped in feed view)", () => {
    const venue = mkVenue(1, "The Earl", "the-earl");
    const payload: TonightPayload = {
      date: "2026-04-17",
      tonight: [
        { venue, shows: [mkShow({ venue, ticket_status: "sold-out" })] },
      ],
      late_night: [],
    };
    render(<LiveTonightPlaybill payload={payload} portalSlug="atlanta" />);
    // Even though all shows sold out, the SOLD OUT TONIGHT kicker is suppressed in feed view
    expect(screen.queryByText("SOLD OUT TONIGHT")).not.toBeInTheDocument();
  });

  it("caps at 4 venue rows and shows footer link with the total venue count", () => {
    const venues = Array.from({ length: 7 }, (_, i) =>
      mkVenue(i + 1, `Venue ${i + 1}`, `venue-${i + 1}`),
    );
    const payload: TonightPayload = {
      date: "2026-04-17",
      tonight: venues.map((venue) => ({ venue, shows: [mkShow({ venue })] })),
      late_night: [],
    };
    render(<LiveTonightPlaybill payload={payload} portalSlug="atlanta" />);

    // First 4 venues visible; rest hidden
    expect(screen.getByText("Venue 1")).toBeInTheDocument();
    expect(screen.getByText("Venue 4")).toBeInTheDocument();
    expect(screen.queryByText("Venue 5")).not.toBeInTheDocument();
    expect(screen.queryByText("Venue 7")).not.toBeInTheDocument();

    expect(screen.getByText(/See all 7 venues tonight/i)).toBeInTheDocument();
  });
});
