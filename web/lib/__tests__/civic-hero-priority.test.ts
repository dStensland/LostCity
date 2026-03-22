import { pickHeroItem, type HeroItem } from "../civic-hero-priority";

const today = new Date("2026-03-22");

const electionEvent: HeroItem = {
  id: 1, title: "Georgia General Primary", tags: ["election", "election-day"],
  start_date: "2026-04-02", start_time: "07:00", venue_name: "Polling Locations",
};

const meetingEvent: HeroItem = {
  id: 2, title: "MARTA Board Meeting", tags: ["government", "board-meeting"],
  start_date: "2026-03-25", start_time: "13:00", venue_name: "MARTA HQ",
};

const volunteerEvent: HeroItem = {
  id: 3, title: "Park Cleanup", tags: ["volunteer", "drop-in"],
  start_date: "2026-03-23", start_time: "09:00", venue_name: "Piedmont Park",
};

describe("pickHeroItem", () => {
  it("prioritizes elections within 14 days", () => {
    const result = pickHeroItem([volunteerEvent, meetingEvent, electionEvent], new Set(), today);
    expect(result?.item.id).toBe(1);
    expect(result?.reason).toBe("election");
  });

  it("prioritizes channel-matched meetings when no election", () => {
    const subscribedChannelEventIds = new Set([2]);
    const result = pickHeroItem([volunteerEvent, meetingEvent], subscribedChannelEventIds, today);
    expect(result?.item.id).toBe(2);
    expect(result?.reason).toBe("channel_match");
  });

  it("falls back to soonest event when no election or channel match", () => {
    const result = pickHeroItem([volunteerEvent, meetingEvent], new Set(), today);
    expect(result?.item.id).toBe(3);
    expect(result?.reason).toBe("soonest");
  });

  it("returns null for empty events", () => {
    expect(pickHeroItem([], new Set(), today)).toBeNull();
  });

  it("skips elections more than 14 days out", () => {
    const farElection: HeroItem = { ...electionEvent, start_date: "2026-05-19" };
    const result = pickHeroItem([volunteerEvent, farElection], new Set(), today);
    expect(result?.item.id).toBe(3);
  });

  it("picks soonest election when multiple are within 14 days", () => {
    const earlyElection: HeroItem = { ...electionEvent, id: 10, start_date: "2026-03-30" };
    const result = pickHeroItem([electionEvent, earlyElection], new Set(), today);
    expect(result?.item.id).toBe(10);
  });
});
