import { describe, expect, it } from "vitest";
import {
  capacityBand,
  classifyMusicVenue,
  filterGhostVenues,
  GHOST_VENUE_LOOKBACK_DAYS,
} from "./classification";

describe("classifyMusicVenue", () => {
  it("returns editorial when programming_style is set", () => {
    expect(classifyMusicVenue({ music_programming_style: "listening_room", capacity: 200 })).toBe("editorial");
    expect(classifyMusicVenue({ music_programming_style: "curated_indie", capacity: 5000 })).toBe("editorial");
  });

  it("returns marquee when style null AND capacity >= 1000", () => {
    expect(classifyMusicVenue({ music_programming_style: null, capacity: 1000 })).toBe("marquee");
    expect(classifyMusicVenue({ music_programming_style: null, capacity: 2600 })).toBe("marquee");
  });

  it("returns additional otherwise", () => {
    expect(classifyMusicVenue({ music_programming_style: null, capacity: 999 })).toBe("additional");
    expect(classifyMusicVenue({ music_programming_style: null, capacity: null })).toBe("additional");
    expect(classifyMusicVenue({ music_programming_style: null, capacity: 300 })).toBe("additional");
  });
});

describe("capacityBand", () => {
  it("bands correctly", () => {
    expect(capacityBand(null)).toBeNull();
    expect(capacityBand(150)).toBe("intimate");
    expect(capacityBand(299)).toBe("intimate");
    expect(capacityBand(300)).toBe("club");
    expect(capacityBand(999)).toBe("club");
    expect(capacityBand(1000)).toBe("theater");
    expect(capacityBand(3000)).toBe("theater");
    expect(capacityBand(3001)).toBe("arena");
    expect(capacityBand(21000)).toBe("arena");
  });
});

describe("GHOST_VENUE_LOOKBACK_DAYS", () => {
  it("is 14 — matches spec §2 ghost venue policy", () => {
    expect(GHOST_VENUE_LOOKBACK_DAYS).toBe(14);
  });
});

describe("filterGhostVenues", () => {
  const group = (slug: string, count: number) => ({
    venue: { slug } as { slug: string },
    shows: Array(count).fill(null) as unknown[],
  });

  it("keeps venues with events", () => {
    expect(filterGhostVenues([group("eddies-attic", 3)])).toHaveLength(1);
  });

  it("drops venues with zero shows in window", () => {
    expect(filterGhostVenues([group("ghost", 0)])).toHaveLength(0);
  });

  it("keeps pinned venues even when zero-show (user intent wins)", () => {
    expect(filterGhostVenues([group("ghost", 0)], { pinned: new Set(["ghost"]) })).toHaveLength(1);
  });
});
