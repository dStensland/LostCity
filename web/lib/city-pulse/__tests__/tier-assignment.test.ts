import { describe, expect, it } from "vitest";
import {
  computeIntrinsicScore,
  getCardTier,
  type TierableEvent,
} from "../tier-assignment";

function makeEvent(overrides: Partial<TierableEvent> = {}): TierableEvent {
  return {
    is_tentpole: false,
    is_featured: false,
    festival_id: null,
    image_url: null,
    featured_blurb: null,
    importance: null,
    venue_has_editorial: false,
    ...overrides,
  };
}

describe("computeIntrinsicScore", () => {
  it("returns 0 for an event with no signals", () => {
    expect(computeIntrinsicScore(makeEvent())).toBe(0);
  });

  it("adds 40 for is_tentpole", () => {
    expect(computeIntrinsicScore(makeEvent({ is_tentpole: true }))).toBe(40);
  });

  it("adds 40 for flagship importance", () => {
    expect(computeIntrinsicScore(makeEvent({ importance: "flagship" }))).toBe(40);
  });

  it("adds 20 for major importance", () => {
    expect(computeIntrinsicScore(makeEvent({ importance: "major" }))).toBe(20);
  });

  it("adds 15 for is_featured", () => {
    expect(computeIntrinsicScore(makeEvent({ is_featured: true }))).toBe(15);
  });

  it("adds 15 for featured_blurb", () => {
    expect(computeIntrinsicScore(makeEvent({ featured_blurb: "An amazing show" }))).toBe(15);
  });

  it("does not double-count is_featured + featured_blurb (OR condition, +15 once)", () => {
    // is_featured || featured_blurb is a single +15 — setting both still scores 15
    expect(computeIntrinsicScore(makeEvent({ is_featured: true, featured_blurb: "blurb" }))).toBe(15);
  });

  it("adds 30 for festival_id", () => {
    expect(computeIntrinsicScore(makeEvent({ festival_id: "dragon-con" }))).toBe(30);
  });

  it("adds 15 for venue_has_editorial", () => {
    expect(computeIntrinsicScore(makeEvent({ venue_has_editorial: true }))).toBe(15);
  });

  it("adds 10 for image_url", () => {
    expect(computeIntrinsicScore(makeEvent({ image_url: "https://example.com/img.jpg" }))).toBe(10);
  });

  it("stacks all signals correctly", () => {
    // flagship(40) + festival(30) + featured_blurb(15) + editorial(15) + image(10) = 110
    expect(
      computeIntrinsicScore(
        makeEvent({
          importance: "flagship",
          festival_id: "dragon-con",
          featured_blurb: "Epic event",
          venue_has_editorial: true,
          image_url: "https://example.com/img.jpg",
        }),
      ),
    ).toBe(110);
  });
});

describe("getCardTier", () => {
  it("festival event (festival_id set) → hero", () => {
    expect(getCardTier(makeEvent({ festival_id: "dragon-con" }))).toBe("hero");
  });

  it("tentpole event → hero", () => {
    expect(getCardTier(makeEvent({ is_tentpole: true }))).toBe("hero");
  });

  it("flagship importance + image → hero (intrinsic = 50, >= 30)", () => {
    expect(
      getCardTier(makeEvent({ importance: "flagship", image_url: "https://img.jpg" })),
    ).toBe("hero");
  });

  it("flagship + no image → still hero (intrinsic = 40 from flagship alone)", () => {
    expect(getCardTier(makeEvent({ importance: "flagship" }))).toBe("hero");
  });

  it("editorial venue + image → featured (intrinsic = 25, < 30, >= 15)", () => {
    // editorial(15) + image(10) = 25 — no tentpole, no festival_id
    expect(
      getCardTier(makeEvent({ venue_has_editorial: true, image_url: "https://img.jpg" })),
    ).toBe("featured");
  });

  it("major importance → featured (intrinsic = 20, >= 15, < 30)", () => {
    expect(getCardTier(makeEvent({ importance: "major" }))).toBe("featured");
  });

  it("friends going (no other signal) → featured", () => {
    expect(getCardTier(makeEvent(), 2)).toBe("featured");
  });

  it("no signals → standard", () => {
    expect(getCardTier(makeEvent())).toBe("standard");
  });

  it("zero friends going, no signals → standard", () => {
    expect(getCardTier(makeEvent(), 0)).toBe("standard");
  });
});
