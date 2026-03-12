import { describe, expect, it, vi } from "vitest";
import { formatTimeRemaining, mapContestRow } from "@/lib/best-of-contests";

describe("best-of-contests", () => {
  it("maps snake_case contest rows into camelCase contest objects", () => {
    expect(
      mapContestRow({
        id: "contest-1",
        category_id: "category-1",
        portal_id: "portal-1",
        slug: "best-patio-week-1",
        title: "Best Patio",
        prompt: "Where should people sit outside?",
        description: "Vote for the best patio in town.",
        cover_image_url: "https://example.com/patio.jpg",
        accent_color: "#E855A0",
        starts_at: "2026-03-11T12:00:00.000Z",
        ends_at: "2026-03-18T12:00:00.000Z",
        status: "active",
        winner_venue_id: null,
        winner_snapshot: null,
        winner_announced_at: null,
        created_by: "user-1",
        created_at: "2026-03-11T12:00:00.000Z",
        updated_at: "2026-03-11T12:00:00.000Z",
      }),
    ).toEqual({
      id: "contest-1",
      categoryId: "category-1",
      portalId: "portal-1",
      slug: "best-patio-week-1",
      title: "Best Patio",
      prompt: "Where should people sit outside?",
      description: "Vote for the best patio in town.",
      coverImageUrl: "https://example.com/patio.jpg",
      accentColor: "#E855A0",
      startsAt: "2026-03-11T12:00:00.000Z",
      endsAt: "2026-03-18T12:00:00.000Z",
      status: "active",
      winnerVenueId: null,
      winnerSnapshot: null,
      winnerAnnouncedAt: null,
      createdBy: "user-1",
      createdAt: "2026-03-11T12:00:00.000Z",
      updatedAt: "2026-03-11T12:00:00.000Z",
    });
  });

  it("formats remaining time across day, hour, and ended boundaries", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-11T12:00:00.000Z"));

    expect(formatTimeRemaining("2026-03-14T12:00:00.000Z")).toBe("3 days left");
    expect(formatTimeRemaining("2026-03-11T14:00:00.000Z")).toBe("2 hours left");
    expect(formatTimeRemaining("2026-03-11T12:00:00.000Z")).toBe("Ended");

    vi.useRealTimers();
  });
});
