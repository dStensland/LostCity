import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import NeighborhoodIndexCard from "@/components/neighborhoods/NeighborhoodIndexCard";

const BASE = {
  name: "Midtown",
  slug: "midtown",
  portalSlug: "atlanta",
  color: "#00D4E8",
};

describe("NeighborhoodIndexCard", () => {
  it("renders the name and color dot", () => {
    render(
      <NeighborhoodIndexCard
        {...BASE}
        eventsTodayCount={0}
        eventsWeekCount={0}
        venueCount={329}
      />,
    );
    expect(screen.getByText("Midtown")).toBeDefined();
  });

  it("renders coral status with tonight count when active (today > 0)", () => {
    render(
      <NeighborhoodIndexCard
        {...BASE}
        eventsTodayCount={12}
        eventsWeekCount={47}
        venueCount={329}
      />,
    );
    expect(screen.getByText("12 tonight · 329 places")).toBeDefined();
  });

  it("renders muted status with plain place count when not active (today === 0)", () => {
    render(
      <NeighborhoodIndexCard
        {...BASE}
        eventsTodayCount={0}
        eventsWeekCount={15}
        venueCount={107}
      />,
    );
    expect(screen.getByText("107 places")).toBeDefined();
    // Should NOT show the tonight-style string
    expect(screen.queryByText(/tonight/)).toBeNull();
  });

  it("uses singular 'place' for venueCount === 1", () => {
    render(
      <NeighborhoodIndexCard
        {...BASE}
        eventsTodayCount={0}
        eventsWeekCount={0}
        venueCount={1}
      />,
    );
    expect(screen.getByText("1 place")).toBeDefined();
  });

  it("links to the neighborhood detail route", () => {
    const { container } = render(
      <NeighborhoodIndexCard
        {...BASE}
        eventsTodayCount={0}
        eventsWeekCount={0}
        venueCount={5}
      />,
    );
    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe("/atlanta/neighborhoods/midtown");
  });
});
