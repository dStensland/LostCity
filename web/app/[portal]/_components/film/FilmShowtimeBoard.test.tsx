import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FilmShowtimeBoard from "./FilmShowtimeBoard";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={typeof href === "string" ? href : "#"} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/SmartImage", () => ({
  default: ({ alt }: { alt?: string }) => <div aria-label={alt ?? ""} />,
}));

vi.mock("@/lib/find-url", () => ({
  buildExploreUrl: () => "/atlanta/explore?lane=shows",
}));

vi.mock("@/lib/film-capsule", () => ({
  buildFilmCapsule: () => null,
}));

describe("FilmShowtimeBoard", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("renders stored-screening showtime entries on the by-film board", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        date: "2026-04-10",
        films: [
          {
            title: "ChaO",
            series_id: "series-1",
            series_slug: "chao",
            image_url: null,
            theaters: [
              {
                venue_id: 197,
                venue_name: "Plaza Theatre",
                venue_slug: "plaza-theatre",
                neighborhood: "Poncey-Highland",
                times: [
                  { time: "15:00", event_id: 199428 },
                  { time: "18:00", event_id: 199430 },
                ],
              },
            ],
          },
        ],
        meta: { available_dates: ["2026-04-10"] },
      }),
    } as Response);

    render(<FilmShowtimeBoard portalSlug="atlanta" mode="by-film" />);

    await waitFor(() => {
      expect(screen.getByText("ChaO")).toBeInTheDocument();
    });

    expect(screen.getByText("Plaza Theatre")).toBeInTheDocument();
    expect(screen.getByText("3:00 PM • 6:00 PM")).toBeInTheDocument();
  });

  it("renders stored-screening showtime entries on the by-theater board", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        date: "2026-04-10",
        theaters: [
          {
            venue_id: 197,
            venue_name: "Plaza Theatre",
            venue_slug: "plaza-theatre",
            neighborhood: "Poncey-Highland",
            films: [
              {
                title: "ChaO",
                series_id: "series-1",
                series_slug: "chao",
                image_url: null,
                times: [
                  { time: "15:00", event_id: 199428 },
                  { time: "18:00", event_id: 199430 },
                ],
              },
            ],
          },
        ],
        meta: { available_dates: ["2026-04-10"] },
      }),
    } as Response);

    render(<FilmShowtimeBoard portalSlug="atlanta" mode="by-theater" />);

    await waitFor(() => {
      expect(screen.getByText("Plaza Theatre")).toBeInTheDocument();
    });

    expect(screen.getByText("ChaO")).toBeInTheDocument();
    expect(screen.getByText(/3:00 PM • 6:00 PM/)).toBeInTheDocument();
  });
});
