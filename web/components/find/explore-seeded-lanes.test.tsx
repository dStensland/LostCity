import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ShowtimesView from "@/components/find/ShowtimesView";
import RegularsView from "@/components/find/RegularsView";
import { GameDayView } from "@/components/find/GameDayView";

const mockExploreState = {
  lane: null,
  q: "",
  display: "list" as const,
  params: new URLSearchParams(),
  pathname: "/atlanta",
  search: "",
  setLane: vi.fn(),
  setSearchQuery: vi.fn(),
  setDisplay: vi.fn(),
  setLaneParams: vi.fn(),
  replaceParams: vi.fn(),
  goHome: vi.fn(),
};

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    scroll,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { scroll?: boolean }) => {
    void scroll;
    return (
      <a href={typeof href === "string" ? href : "#"} {...props}>
        {children}
      </a>
    );
  },
}));

vi.mock("@/components/SmartImage", () => ({
  default: ({ alt }: { alt?: string }) => <div aria-label={alt ?? ""} />,
}));

vi.mock("@/components/CategoryIcon", () => ({
  default: () => <span>icon</span>,
}));

vi.mock("@/lib/analytics/find-tracking", () => ({
  createFindFilterSnapshot: () => ({ signature: "seeded" }),
  trackFindZeroResults: vi.fn(),
}));

vi.mock("@/lib/show-card-utils", () => ({
  prefetchEventDetail: vi.fn(),
  formatShowtime: (value: string) => value,
  toLocalIsoDate: (value: Date) => value.toISOString().slice(0, 10),
}));

vi.mock("@/lib/explore-platform/url-state", () => ({
  useExploreUrlState: () => mockExploreState,
}));

vi.mock("@/components/feed/SceneEventRow", () => ({
  SceneEventRow: ({ item }: { item: { event: { title: string } } }) => (
    <div>{item.event.title}</div>
  ),
  SceneChip: ({ label }: { label: string }) => <button>{label}</button>,
  getActivityIcon: () => null,
  WeekdayRow: () => <div>weekday</div>,
  getDayKeyFromDate: (date: string) =>
    ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][
      new Date(`${date}T12:00:00`).getDay()
    ],
  buildNext7Days: () => [],
}));

vi.mock("@/lib/haptics", () => ({
  triggerHaptic: vi.fn(),
}));

vi.mock("@/components/ui/TransitionContainer", () => ({
  TransitionContainer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("@/components/find/gameday/GameCard", () => ({
  GameCard: ({
    teamName,
    opponent,
  }: {
    teamName: string;
    opponent: string;
  }) => (
    <div>{`${teamName} vs ${opponent}`}</div>
  ),
}));

vi.mock("@/components/find/gameday/TeamChip", () => ({
  TeamChip: ({ name }: { name: string }) => <button>{name}</button>,
}));

describe("seeded Explore lane views", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    mockExploreState.params = new URLSearchParams();
  });

  it("renders seeded film showtimes without an initial client fetch", () => {
    render(
      <ShowtimesView
        portalId="portal-1"
        portalSlug="atlanta"
        initialData={{
          tab: "film",
          date: "2025-04-03",
          viewMode: "by-theater",
          meta: {
            available_dates: ["2025-04-03", "2025-04-04"],
            available_theaters: [
              {
                venue_id: 10,
                venue_name: "Seeded Cinema",
                venue_slug: "seeded-cinema",
                neighborhood: "Midtown",
              },
            ],
            available_films: [],
          },
          theaters: [
            {
              venue_id: 10,
              venue_name: "Seeded Cinema",
              venue_slug: "seeded-cinema",
              neighborhood: "Midtown",
              films: [
                {
                  title: "Seeded Film",
                  series_id: "series-1",
                  series_slug: "seeded-film",
                  image_url: null,
                  times: [{ time: "19:00:00", event_id: 101 }],
                },
              ],
            },
          ],
          requestKey: "shows|film|2025-04-03|by-theater",
        }}
      />,
    );

    expect(screen.getByText("Seeded Cinema")).toBeInTheDocument();
    expect(screen.getByText("Seeded Film")).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("renders seeded regulars without an initial client fetch", () => {
    render(
      <RegularsView
        portalId="portal-1"
        portalSlug="atlanta"
        initialData={{
          events: [
            {
              id: 1,
              title: "Trivia Night",
              start_date: "2025-04-04",
              start_time: "19:00:00",
              is_all_day: false,
              venue: { name: "The Local" },
              activity_type: "trivia",
              recurrence_label: "Every Friday",
            },
          ],
          requestKey: "regulars|2025-04-04",
        }}
      />,
    );

    expect(screen.getByText("Trivia Night")).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("renders seeded game day content without an initial client fetch", () => {
    render(
      <GameDayView
        portalId="portal-1"
        portalSlug="atlanta"
        initialData={{
          teams: [
            {
              slug: "atlanta-falcons",
              name: "Atlanta Falcons",
              shortName: "Falcons",
              sport: "football",
              league: "NFL",
              accentColor: "#c00",
              logoUrl: "/falcons.png",
              heroUrl: "/falcons-hero.png",
              nextGame: {
                id: 99,
                title: "Falcons vs Saints",
                startDate: "2099-09-08",
                startTime: "13:00:00",
                venueName: "Mercedes-Benz Stadium",
                venueSlug: "mercedes-benz-stadium",
                isFree: false,
                ticketUrl: null,
                imageUrl: null,
              },
              upcoming: [],
              totalUpcoming: 0,
            },
          ],
          requestKey: "game-day|2099-09-08",
        }}
      />,
    );

    expect(screen.getByText("Falcons")).toBeInTheDocument();
    expect(screen.getByText("Falcons vs Saints")).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
