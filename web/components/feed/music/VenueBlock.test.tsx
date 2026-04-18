import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { VenueBlock } from "./VenueBlock";
import type { MusicShowPayload, MusicVenuePayload } from "@/lib/music/types";

function mkVenue(overrides: Partial<MusicVenuePayload> = {}): MusicVenuePayload {
  return {
    id: 42,
    name: "Terminal West",
    slug: "terminal-west",
    neighborhood: "West Midtown",
    image_url: null,
    hero_image_url: null,
    music_programming_style: "curated_indie",
    music_venue_formats: [],
    capacity: 700,
    editorial_line: null,
    display_tier: "editorial",
    capacity_band: "club",
    ...overrides,
  };
}

function mkShow(overrides: Partial<MusicShowPayload> = {}): MusicShowPayload {
  return {
    id: 1001,
    title: "Kishi Bashi",
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
    venue: mkVenue(),
    artists: [
      { id: "a1", slug: "kishi-bashi", name: "Kishi Bashi", is_headliner: true, billing_order: 1 },
    ],
    ...overrides,
  };
}

describe("VenueBlock", () => {
  it("renders venue name in uppercase mono with a spot link", () => {
    render(
      <VenueBlock
        venue={mkVenue()}
        shows={[mkShow()]}
        portalSlug="atlanta"
      />,
    );
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/atlanta?spot=terminal-west");
    expect(screen.getByText("Terminal West")).toBeInTheDocument();
  });

  it("formats showtime as 12-hour without AM/PM", () => {
    render(
      <VenueBlock
        venue={mkVenue()}
        shows={[mkShow({ start_time: "20:00" })]}
        portalSlug="atlanta"
      />,
    );
    expect(screen.getByText("8:00")).toBeInTheDocument();
  });

  it("renders headliner cream + support with '+' prefix in soft", () => {
    const shows = [
      mkShow({ id: 1, artists: [{ id: "h", slug: "h", name: "Wild Pink", is_headliner: true, billing_order: 1 }] }),
      mkShow({ id: 2, start_time: "22:00", artists: [{ id: "s", slug: "s", name: "Cusses", is_headliner: true, billing_order: 1 }] }),
    ];
    render(<VenueBlock venue={mkVenue()} shows={shows} portalSlug="atlanta" />);
    expect(screen.getByText("Wild Pink")).toBeInTheDocument();
    // Second show is rendered with "+ {name}" prefix
    expect(screen.getByText("+ Cusses")).toBeInTheDocument();
  });

  it("renders kicker with the requested tone color", () => {
    render(
      <VenueBlock
        venue={mkVenue()}
        shows={[mkShow()]}
        portalSlug="atlanta"
        kicker={{ label: "SOLD OUT TONIGHT", tone: "coral" }}
      />,
    );
    const kicker = screen.getByText("SOLD OUT TONIGHT");
    expect(kicker.className).toContain("text-[var(--coral)]");
  });

  it("does NOT render a kicker DOM element when kicker is null", () => {
    const { container } = render(
      <VenueBlock venue={mkVenue()} shows={[mkShow()]} portalSlug="atlanta" />,
    );
    // The marquee row should only contain the venue-name span
    expect(container.textContent).not.toMatch(/SOLD OUT|RESIDENCY|FREE|LATE/);
  });

  it("renders '+N more' link when shows exceed maxVisibleShows", () => {
    const shows = [
      mkShow({ id: 1 }),
      mkShow({ id: 2 }),
      mkShow({ id: 3 }),
      mkShow({ id: 4 }),
    ];
    render(<VenueBlock venue={mkVenue()} shows={shows} portalSlug="atlanta" />);
    expect(screen.getByText("+2 more →")).toBeInTheDocument();
  });

  it("returns null when shows array is empty", () => {
    const { container } = render(
      <VenueBlock venue={mkVenue()} shows={[]} portalSlug="atlanta" />,
    );
    expect(container.firstChild).toBeNull();
  });
});
