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
  it("renders an empty-state link when no shows tonight or late", () => {
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

  it("merges a single late-night venue as a kicker on the tonight band (no separate Late header)", () => {
    const venue1 = mkVenue(1, "The Earl", "the-earl");
    const lateVenue = mkVenue(2, "Velvet Note", "velvet-note");
    const payload: TonightPayload = {
      date: "2026-04-17",
      tonight: [{ venue: venue1, shows: [mkShow({ venue: venue1 })] }],
      late_night: [{ venue: lateVenue, shows: [mkShow({ venue: lateVenue, doors_time: "22:30" })] }],
    };
    render(<LiveTonightPlaybill payload={payload} portalSlug="atlanta" />);

    // Exactly ONE LATE label rendered — the kicker on the late venue's block.
    // No separate sub-header in the merge case.
    const lateMatches = screen.getAllByText(/LATE · AFTER 9 PM/i);
    expect(lateMatches).toHaveLength(1);

    // Both venues visible
    expect(screen.getByText("The Earl")).toBeInTheDocument();
    expect(screen.getByText("Velvet Note")).toBeInTheDocument();
  });

  it("renders a separate Late band when 2+ late venues exist", () => {
    const venue = mkVenue(1, "The Earl", "the-earl");
    const late1 = mkVenue(2, "Velvet Note", "velvet-note");
    const late2 = mkVenue(3, "Apache Cafe", "apache");
    const payload: TonightPayload = {
      date: "2026-04-17",
      tonight: [{ venue, shows: [mkShow({ venue })] }],
      late_night: [
        { venue: late1, shows: [mkShow({ venue: late1, doors_time: "22:00" })] },
        { venue: late2, shows: [mkShow({ venue: late2, doors_time: "22:30" })] },
      ],
    };
    render(<LiveTonightPlaybill payload={payload} portalSlug="atlanta" />);
    expect(screen.getByText(/Tonight ·/i)).toBeInTheDocument();
    // 2+ late venues → separate sub-band header. Per-venue LATE kickers are
    // suppressed inside the band (avoid duplicate label). Exactly ONE LATE
    // label rendered: the band sub-header itself.
    expect(screen.getAllByText(/LATE · AFTER 9 PM/i)).toHaveLength(1);
  });

  it("caps at 6 venue blocks and shows footer link with the total count", () => {
    const venues = Array.from({ length: 9 }, (_, i) =>
      mkVenue(i + 1, `Venue ${i + 1}`, `venue-${i + 1}`),
    );
    const payload: TonightPayload = {
      date: "2026-04-17",
      tonight: venues.map((venue) => ({ venue, shows: [mkShow({ venue })] })),
      late_night: [],
    };
    render(<LiveTonightPlaybill payload={payload} portalSlug="atlanta" />);

    // First 6 venues visible; rest hidden
    expect(screen.getByText("Venue 1")).toBeInTheDocument();
    expect(screen.getByText("Venue 6")).toBeInTheDocument();
    expect(screen.queryByText("Venue 7")).not.toBeInTheDocument();
    expect(screen.queryByText("Venue 9")).not.toBeInTheDocument();

    expect(screen.getByText(/See all 9 venues tonight/i)).toBeInTheDocument();
  });

  it("derives a SOLD OUT TONIGHT kicker when all of a venue's shows are sold out", () => {
    const venue = mkVenue(1, "The Earl", "the-earl");
    const payload: TonightPayload = {
      date: "2026-04-17",
      tonight: [
        { venue, shows: [mkShow({ venue, ticket_status: "sold-out" })] },
      ],
      late_night: [],
    };
    render(<LiveTonightPlaybill payload={payload} portalSlug="atlanta" />);
    expect(screen.getByText("SOLD OUT TONIGHT")).toBeInTheDocument();
  });
});
