import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DoorsImminentTicker, pickImminent } from "./DoorsImminentTicker";
import type { MusicShowPayload, MusicVenuePayload, TonightPayload } from "@/lib/music/types";

function mkVenue(overrides: Partial<MusicVenuePayload> = {}): MusicVenuePayload {
  return {
    id: 1,
    name: "Smith's Olde Bar",
    slug: "smiths-olde-bar",
    neighborhood: "Morningside",
    image_url: null,
    hero_image_url: null,
    music_programming_style: "curated_indie",
    music_venue_formats: [],
    capacity: 350,
    editorial_line: null,
    display_tier: "editorial",
    capacity_band: "club",
    ...overrides,
  };
}

function mkShow(overrides: Partial<MusicShowPayload> = {}): MusicShowPayload {
  return {
    id: 1,
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
    venue: mkVenue(),
    artists: [],
    ...overrides,
  };
}

function mkPayload(
  groups: { venue: MusicVenuePayload; shows: MusicShowPayload[] }[],
): TonightPayload {
  return { date: "2026-04-17", tonight: groups, late_night: [] };
}

describe("pickImminent", () => {
  it("returns the show whose doors fall within the next 90 min", () => {
    const now = new Date("2026-04-17T18:18:00"); // 6:18 PM local
    const show = mkShow({ doors_time: "19:00", start_time: "20:00" }); // 42 min away
    const result = pickImminent(mkPayload([{ venue: mkVenue(), shows: [show] }]), now);
    expect(result).toEqual({
      venueName: "Smith's Olde Bar",
      venueSlug: "smiths-olde-bar",
      minutesAway: 42,
    });
  });

  it("returns null when no show is within 90 min", () => {
    const now = new Date("2026-04-17T17:00:00");
    const show = mkShow({ doors_time: "20:00" }); // 180 min away
    expect(pickImminent(mkPayload([{ venue: mkVenue(), shows: [show] }]), now)).toBeNull();
  });

  it("returns null when current time is at or past 9 PM cutoff", () => {
    const now = new Date("2026-04-17T21:00:00"); // exactly 9 PM
    const show = mkShow({ doors_time: "21:30" }); // 30 min away
    expect(pickImminent(mkPayload([{ venue: mkVenue(), shows: [show] }]), now)).toBeNull();
  });

  it("returns null for shows that have already started", () => {
    const now = new Date("2026-04-17T19:30:00");
    const show = mkShow({ doors_time: "19:00" }); // 30 min ago
    expect(pickImminent(mkPayload([{ venue: mkVenue(), shows: [show] }]), now)).toBeNull();
  });

  it("picks the soonest when multiple shows qualify", () => {
    const now = new Date("2026-04-17T18:00:00");
    const aisle5 = mkVenue({ id: 2, name: "Aisle 5", slug: "aisle-5" });
    const groups = [
      { venue: mkVenue(), shows: [mkShow({ doors_time: "19:00" })] }, // 60 min
      { venue: aisle5, shows: [mkShow({ id: 99, doors_time: "18:30" })] }, // 30 min
    ];
    const result = pickImminent(mkPayload(groups), now);
    expect(result?.venueName).toBe("Aisle 5");
    expect(result?.minutesAway).toBe(30);
  });

  it("falls back to start_time when doors_time is missing", () => {
    const now = new Date("2026-04-17T18:30:00");
    const show = mkShow({ doors_time: null, start_time: "19:30" }); // 60 min
    const result = pickImminent(mkPayload([{ venue: mkVenue(), shows: [show] }]), now);
    expect(result?.minutesAway).toBe(60);
  });
});

describe("DoorsImminentTicker", () => {
  it("renders 'Doors at {venue} in {N} min' + LIVE NOW when imminent", () => {
    const now = new Date("2026-04-17T18:18:00");
    const payload = mkPayload([
      { venue: mkVenue(), shows: [mkShow({ doors_time: "19:00" })] },
    ]);
    render(
      <DoorsImminentTicker payload={payload} portalSlug="atlanta" nowProvider={() => now} />,
    );
    expect(screen.getByText(/in 42 min/)).toBeInTheDocument();
    expect(screen.getByText("Smith's Olde Bar")).toBeInTheDocument();
    expect(screen.getByText("LIVE NOW")).toBeInTheDocument();
  });

  it("renders nothing when no shows are imminent", () => {
    const now = new Date("2026-04-17T15:00:00");
    const payload = mkPayload([
      { venue: mkVenue(), shows: [mkShow({ doors_time: "20:00" })] },
    ]);
    const { container } = render(
      <DoorsImminentTicker payload={payload} portalSlug="atlanta" nowProvider={() => now} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("links the venue name to the spot overlay URL", () => {
    const now = new Date("2026-04-17T18:30:00");
    const payload = mkPayload([
      { venue: mkVenue(), shows: [mkShow({ doors_time: "19:00" })] },
    ]);
    render(
      <DoorsImminentTicker payload={payload} portalSlug="atlanta" nowProvider={() => now} />,
    );
    const link = screen.getByRole("link", { name: "Smith's Olde Bar" });
    expect(link.getAttribute("href")).toBe("/atlanta?spot=smiths-olde-bar");
  });
});
