import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { LinkContextProvider } from "@/lib/link-context";
import { VenueBlock } from "./VenueBlock";
import type { MusicShowPayload, MusicVenuePayload } from "@/lib/music/types";

// VenueBlock lives inside the music feed section — overlay-capable surface.
// In production it inherits "overlay" context from PortalSurfaceChrome's
// LinkContextProvider; in tests we wrap explicitly to mirror that.
function renderInOverlay(node: ReactElement) {
  return render(<LinkContextProvider value="overlay">{node}</LinkContextProvider>);
}

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
  it("renders venue name (shortened) with caret link to spot URL", () => {
    renderInOverlay(
      <VenueBlock
        venue={mkVenue({ name: "The EARL", slug: "the-earl" })}
        shows={[mkShow()]}
        portalSlug="atlanta"
      />,
    );
    // shortVenueName strips leading "The "
    expect(screen.getByText("EARL")).toBeInTheDocument();
    // Caret arrow is the navigation target
    const caret = screen.getByRole("link", { name: /See all The EARL shows/i });
    expect(caret.getAttribute("href")).toBe("/atlanta?spot=the-earl");
  });

  it("formats showtime as 12-hour without AM/PM", () => {
    renderInOverlay(
      <VenueBlock
        venue={mkVenue()}
        shows={[mkShow({ start_time: "20:00" })]}
        portalSlug="atlanta"
      />,
    );
    expect(screen.getByText("8:00")).toBeInTheDocument();
  });

  it("renders a single row with multiple shows separated, no '+' prefix", () => {
    const shows = [
      mkShow({ id: 1, artists: [{ id: "h", slug: "h", name: "Wild Pink", is_headliner: true, billing_order: 1 }] }),
      mkShow({ id: 2, start_time: "22:00", artists: [{ id: "s", slug: "s", name: "Cusses", is_headliner: true, billing_order: 1 }] }),
    ];
    renderInOverlay(<VenueBlock venue={mkVenue()} shows={shows} portalSlug="atlanta" />);
    // Both names appear without legacy "+ " prefix
    expect(screen.getByText("Wild Pink")).toBeInTheDocument();
    expect(screen.getByText("Cusses")).toBeInTheDocument();
    expect(screen.queryByText(/\+ Cusses/)).not.toBeInTheDocument();
  });

  it("renders '+N more' text when shows exceed maxVisibleShows", () => {
    const shows = [
      mkShow({ id: 1 }),
      mkShow({ id: 2 }),
      mkShow({ id: 3 }),
      mkShow({ id: 4 }),
      mkShow({ id: 5 }),
    ];
    renderInOverlay(
      <VenueBlock
        venue={mkVenue()}
        shows={shows}
        portalSlug="atlanta"
        maxVisibleShows={3}
      />,
    );
    expect(screen.getByText("+2 more")).toBeInTheDocument();
  });

  it("does NOT render any kicker decoration (kickers are dropped in feed view)", () => {
    const { container } = renderInOverlay(
      <VenueBlock venue={mkVenue()} shows={[mkShow()]} portalSlug="atlanta" />,
    );
    // No kicker label of any tone should appear
    expect(container.textContent).not.toMatch(/SOLD OUT|RESIDENCY|FREE TONIGHT|LATE · AFTER/);
  });

  it("returns null when shows array is empty", () => {
    const { container } = renderInOverlay(
      <VenueBlock venue={mkVenue()} shows={[]} portalSlug="atlanta" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("each show title link points to the venue spot URL", () => {
    renderInOverlay(
      <VenueBlock
        venue={mkVenue({ slug: "terminal-west" })}
        shows={[mkShow()]}
        portalSlug="atlanta"
      />,
    );
    const titleLink = screen.getByRole("link", { name: "Kishi Bashi" });
    expect(titleLink.getAttribute("href")).toBe("/atlanta?spot=terminal-west");
  });
});
