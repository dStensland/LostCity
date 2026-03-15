import { describe, expect, it } from "vitest";
import { isSceneEvent, matchActivityType, type SceneRoutableEvent } from "./scene-event-routing";

function makeEvent(overrides: Partial<SceneRoutableEvent> = {}): SceneRoutableEvent {
  return {
    title: "Event",
    category: "community",
    tags: [],
    genres: [],
    ...overrides,
  };
}

describe("matchActivityType", () => {
  it("classifies pickup and open-play sports as sports instead of generic fitness", () => {
    expect(matchActivityType(makeEvent({
      category: "fitness",
      tags: ["pickup", "pickleball"],
      title: "Friday Pickleball Open Play",
    }))).toBe("sports");
  });

  it("uses title fallback for rec league style sports with sparse metadata", () => {
    expect(matchActivityType(makeEvent({
      category: "fitness",
      title: "Wednesday Rec League Softball",
    }))).toBe("sports");
  });

  it("keeps non-sports fitness events in fitness", () => {
    expect(matchActivityType(makeEvent({
      category: "fitness",
      tags: ["yoga"],
      title: "Sunrise Yoga in the Park",
    }))).toBe("fitness");
  });
});

describe("isSceneEvent", () => {
  it("routes recurring pickup sports into the scene", () => {
    expect(isSceneEvent(makeEvent({
      category: "fitness",
      tags: ["pickup", "pickleball"],
      title: "Friday Pickleball Open Play",
      series_id: "series-1",
    }))).toBe(true);
  });

  it("keeps touring recurring events out of the scene", () => {
    expect(isSceneEvent(makeEvent({
      category: "music",
      tags: ["touring"],
      genres: ["jazz"],
      title: "Monday Jazz Residency",
      series_id: "series-2",
    }))).toBe(false);
  });

  it("routes recurring open-gym public-play inventory into regular hangs", () => {
    expect(isSceneEvent(makeEvent({
      category: "sports",
      tags: ["open-gym", "public-play", "basketball"],
      title: "Rec Center Open Gym Basketball",
      series_id: "series-3",
    }))).toBe(true);
  });

  it("routes recurring craft-club inventory into regular hangs", () => {
    expect(isSceneEvent(makeEvent({
      category: "community",
      tags: ["open-table", "crochet"],
      title: "Weekly Fiber Meetup",
      series_id: "series-4",
    }))).toBe(true);
  });

  it("routes recurring book-club inventory into regular hangs from tags alone", () => {
    expect(isSceneEvent(makeEvent({
      category: "community",
      tags: ["book-club", "reading"],
      title: "Monthly Reader Social",
      series_id: "series-5",
    }))).toBe(true);
  });
});
