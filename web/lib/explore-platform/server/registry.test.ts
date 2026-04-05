import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/explore-platform/server/events", () => ({
  getExploreEventsInitialData: vi.fn(),
}));

vi.mock("@/lib/explore-platform/server/places", () => ({
  getExplorePlacesInitialData: vi.fn(),
}));

vi.mock("@/lib/explore-platform/server/classes", () => ({
  getExploreClassesInitialData: vi.fn(),
}));

vi.mock("@/lib/explore-platform/server/shows", () => ({
  getExploreShowsInitialData: vi.fn(),
}));

vi.mock("@/lib/explore-platform/server/regulars", () => ({
  getExploreRegularsInitialData: vi.fn(),
}));

vi.mock("@/lib/explore-platform/server/game-day", () => ({
  getExploreGameDayInitialData: vi.fn(),
}));

import { loadExploreLaneInitialData, resolveExploreLaneFromParams } from "@/lib/explore-platform/server/registry";
import { getExploreShowsInitialData } from "@/lib/explore-platform/server/shows";
import { getExploreRegularsInitialData } from "@/lib/explore-platform/server/regulars";
import { getExploreGameDayInitialData } from "@/lib/explore-platform/server/game-day";

describe("explore server registry", () => {
  const args = {
    portalId: "portal-1",
    portalSlug: "atlanta",
    portalExclusive: false,
    params: new URLSearchParams("lane=shows"),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads seeded shows lane data through the registry", async () => {
    vi.mocked(getExploreShowsInitialData).mockResolvedValueOnce({
      tab: "film",
      date: "2025-04-03",
      viewMode: "by-theater",
      meta: {
        available_dates: ["2025-04-03"],
        available_theaters: [],
        available_films: [],
      },
      theaters: [],
      requestKey: "shows-seeded",
    });

    const result = await loadExploreLaneInitialData("shows", args);

    expect(getExploreShowsInitialData).toHaveBeenCalledWith(args);
    expect(result).toMatchObject({ tab: "film", requestKey: "shows-seeded" });
  });

  it("loads seeded regulars lane data through the registry", async () => {
    vi.mocked(getExploreRegularsInitialData).mockResolvedValueOnce({
      events: [],
      requestKey: "regulars-seeded",
    });

    const result = await loadExploreLaneInitialData("regulars", args);

    expect(getExploreRegularsInitialData).toHaveBeenCalledWith(args);
    expect(result).toEqual({ events: [], requestKey: "regulars-seeded" });
  });

  it("loads seeded game-day lane data through the registry", async () => {
    vi.mocked(getExploreGameDayInitialData).mockResolvedValueOnce({
      teams: [],
      requestKey: "game-day-seeded",
    });

    const result = await loadExploreLaneInitialData("game-day", args);

    expect(getExploreGameDayInitialData).toHaveBeenCalledWith(args);
    expect(result).toEqual({ teams: [], requestKey: "game-day-seeded" });
  });

  it("normalizes legacy event utility params into the events lane", () => {
    expect(
      resolveExploreLaneFromParams(new URLSearchParams("lane=events&display=map")),
    ).toEqual({ lane: "events", display: "map" });

    expect(
      resolveExploreLaneFromParams(new URLSearchParams("lane=events&display=calendar")),
    ).toEqual({ lane: "events", display: "calendar" });

    expect(
      resolveExploreLaneFromParams(new URLSearchParams("lane=shows&display=calendar")),
    ).toEqual({ lane: "shows", display: "list" });
  });
});
