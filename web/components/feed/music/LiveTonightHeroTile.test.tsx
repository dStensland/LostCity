import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LiveTonightHeroTile } from "./LiveTonightHeroTile";
import type { MusicShowPayload, MusicVenuePayload } from "@/lib/music/types";

function mkVenue(overrides: Partial<MusicVenuePayload> = {}): MusicVenuePayload {
  return {
    id: 1,
    name: "The EARL",
    slug: "the-earl",
    neighborhood: "East Atlanta",
    image_url: null,
    hero_image_url: null,
    music_programming_style: "curated_indie",
    music_venue_formats: [],
    capacity: 300,
    editorial_line: null,
    display_tier: "editorial",
    capacity_band: "club",
    ...overrides,
  };
}

function mkShow(overrides: Partial<MusicShowPayload> = {}): MusicShowPayload {
  return {
    id: 100,
    title: "Mannequin Pussy",
    start_date: "2026-04-20",
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
    genres: ["punk", "indie rock"],
    genre_buckets: ["Rock"],
    venue: mkVenue(),
    artists: [
      { id: "a1", slug: "mannequin-pussy", name: "Mannequin Pussy", is_headliner: true, billing_order: 1 },
      { id: "a2", slug: "softcult", name: "Softcult", is_headliner: false, billing_order: 2 },
    ],
    ...overrides,
  };
}

describe("LiveTonightHeroTile", () => {
  it("renders an image when image_url is present", () => {
    const show = mkShow({ image_url: "https://example.com/show.jpg" });
    const { container } = render(
      <LiveTonightHeroTile show={show} portalSlug="atlanta" onTap={vi.fn()} />,
    );
    expect(container.querySelector("img")).toBeInTheDocument();
  });

  it("renders typographic fallback (no image) with primary genre label", () => {
    const show = mkShow({ image_url: null, venue: mkVenue({ image_url: null, hero_image_url: null }) });
    const { container } = render(
      <LiveTonightHeroTile show={show} portalSlug="atlanta" onTap={vi.fn()} />,
    );
    // No <img> rendered in typographic state
    expect(container.querySelector("img")).not.toBeInTheDocument();
    // Genre label rendered in the bottom overlay
    expect(screen.getByText("Rock")).toBeInTheDocument();
  });

  it("renders a CURATOR PICK chip when is_curator_pick", () => {
    const show = mkShow({ is_curator_pick: true });
    render(<LiveTonightHeroTile show={show} portalSlug="atlanta" onTap={vi.fn()} />);
    expect(screen.getByText("CURATOR PICK")).toBeInTheDocument();
  });

  it("renders a FESTIVAL chip when festival_id is set", () => {
    const show = mkShow({ festival_id: "festival-123" });
    render(<LiveTonightHeroTile show={show} portalSlug="atlanta" onTap={vi.fn()} />);
    expect(screen.getByText("FESTIVAL")).toBeInTheDocument();
  });

  it("uses smaller headline class for sizeVariant md", () => {
    const { container } = render(
      <LiveTonightHeroTile show={mkShow()} portalSlug="atlanta" onTap={vi.fn()} sizeVariant="md" />,
    );
    const headline = container.querySelector(".text-lg");
    expect(headline).toBeTruthy();
  });
});
