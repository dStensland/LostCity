/**
 * Tests for computeAnonymousRankBoost and scoreEvent ranking behaviour.
 *
 * Covers the Wave B Lineup sort rebuild: time-of-day relevance, importance
 * tier, personalization dominance, and future-date exclusions.
 */

import { describe, it, expect } from "vitest";
import { computeAnonymousRankBoost, scoreEvent } from "../scoring";
import type { ScorableEvent } from "../scoring";
import type { UserSignals } from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNow(hhMM: string, dateISO: string): Date {
  const [hh, mm] = hhMM.split(":").map(Number);
  const d = new Date(`${dateISO}T00:00:00`);
  d.setHours(hh, mm, 0, 0);
  return d;
}

const TODAY = "2026-04-16";
const TOMORROW = "2026-04-17";

function baseEvent(overrides: Partial<ScorableEvent & {
  start_time?: string | null;
  is_all_day?: boolean;
  importance?: string | null;
  venue_has_editorial?: boolean;
}>): ScorableEvent & {
  start_time?: string | null;
  is_all_day?: boolean;
  importance?: string | null;
  venue_has_editorial?: boolean;
} {
  return {
    id: 1,
    title: "Test Event",
    start_date: TODAY,
    category: "music",
    is_free: false,
    price_min: null,
    image_url: null,
    start_time: null,
    is_all_day: false,
    importance: null,
    venue_has_editorial: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test: library class vs. City Winery show at 6pm
// ---------------------------------------------------------------------------

describe("computeAnonymousRankBoost", () => {
  it("library class (no price, no image, 11am) ranks lower than $35 show (image, 7pm) at 6pm", () => {
    const now = makeNow("18:00", TODAY);

    const libraryClass = baseEvent({
      id: 1,
      title: "Storytime at Library",
      start_time: "11:00",
      price_min: null,
      image_url: null,
      importance: null,
    });

    const cityWineryShow = baseEvent({
      id: 2,
      title: "Jazz Night at City Winery",
      start_time: "19:00",
      price_min: 35,
      image_url: "https://example.com/img.jpg",
      importance: null,
    });

    const libraryBoost = computeAnonymousRankBoost(libraryClass, now);
    const showBoost = computeAnonymousRankBoost(cityWineryShow, now);

    // Library class at 11am is 7h in the past at 6pm → 0 time boost
    // City Winery at 7pm is 60min away → +30 time boost + +8 price + +6 image = 44
    expect(showBoost).toBeGreaterThan(libraryBoost);

    // Library class: 11am is 420 min before 6pm, so delta = -420 → not within -120 window → 0
    expect(libraryBoost).toBe(0);

    // City Winery: delta = 60 min → within 3h window → +30 + +8 + +6 = 44
    expect(showBoost).toBe(44);
  });

  it("flagship festival without price/image beats a standard $35 show (importance dominates)", () => {
    const now = makeNow("18:00", TODAY);

    const flagship = baseEvent({
      id: 3,
      title: "Atlanta Jazz Festival",
      importance: "flagship",
      is_tentpole: true,
      price_min: null,
      image_url: null,
      start_time: "20:00",
    });

    const standardShow = baseEvent({
      id: 4,
      title: "Random Band at Bar",
      importance: null,
      price_min: 35,
      image_url: "https://example.com/img.jpg",
      start_time: "19:00",
    });

    const flagshipBoost = computeAnonymousRankBoost(flagship, now);
    const standardBoost = computeAnonymousRankBoost(standardShow, now);

    // Flagship: +30 (starts in ~2h) + +25 (flagship) + +15 (tentpole) = 70
    // Standard: +30 (starts in ~1h) + +8 (price) + +6 (image) = 44
    expect(flagshipBoost).toBeGreaterThan(standardBoost);
    expect(flagshipBoost).toBe(70);
  });

  it("events on future dates do not get a time-of-day boost", () => {
    const now = makeNow("18:00", TODAY);

    const futureEvent = baseEvent({
      id: 5,
      title: "Next Week Concert",
      start_date: TOMORROW,
      start_time: "19:00",
      price_min: null,
      image_url: null,
    });

    const boost = computeAnonymousRankBoost(futureEvent, now);
    // Only non-time signals apply; price and image are null → 0
    expect(boost).toBe(0);
  });

  it("event that already started (within 2h) gets +10 still-happening boost", () => {
    const now = makeNow("19:45", TODAY);

    const ongoingEvent = baseEvent({
      id: 6,
      title: "Show that started at 8pm",
      start_time: "19:00",
      price_min: null,
      image_url: null,
    });

    const boost = computeAnonymousRankBoost(ongoingEvent, now);
    // delta = 19:00 - 19:45 = -45 min → within -120 window → +10
    expect(boost).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// Test: personalization dominance
// ---------------------------------------------------------------------------

describe("scoreEvent — personalization dominance", () => {
  it("friend_going event wins despite lower anonymous boost", () => {
    const now = makeNow("18:00", TODAY);

    const lowQualityEvent: ScorableEvent & { start_time?: string | null; is_all_day?: boolean; importance?: string | null; venue_has_editorial?: boolean } = {
      id: 10,
      title: "Friend's Open Mic",
      start_date: TODAY,
      category: "music",
      is_free: true,
      price_min: null,
      image_url: null,
      start_time: "23:00", // late night, no time boost at 6pm
      is_all_day: false,
      importance: null,
      venue_has_editorial: false,
    };

    const highQualityEvent: ScorableEvent & { start_time?: string | null; is_all_day?: boolean; importance?: string | null; venue_has_editorial?: boolean } = {
      id: 11,
      title: "Big Show",
      start_date: TODAY,
      category: "music",
      is_free: false,
      price_min: 50,
      image_url: "https://example.com/img.jpg",
      start_time: "19:00",
      is_all_day: false,
      importance: "major",
      venue_has_editorial: true,
    };

    const signals: UserSignals = {
      userId: "user-1",
      followedVenueIds: [],
      followedOrganizationIds: [],
      producerSourceIds: [],
      sourceOrganizationMap: {},
      friendIds: [],
      prefs: null,
    };

    const friendsGoingMap: Record<number, import("../types").FriendGoingInfo[]> = {
      10: [{ user_id: "abc", username: "alex", display_name: "Alex" }],
    };

    const friendResult = scoreEvent(lowQualityEvent as never, signals, friendsGoingMap, undefined, now);
    const noFriendResult = scoreEvent(highQualityEvent as never, signals, {}, undefined, now);

    // Friend signal adds 60 base, which should overcome the quality advantage
    expect(friendResult.score).toBeGreaterThan(noFriendResult.score);
    expect(friendResult.reasons.some((r) => r.type === "friends_going")).toBe(true);
  });
});
