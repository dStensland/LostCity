import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import NeighborhoodsEditorialOverlay from "@/components/neighborhoods/NeighborhoodsEditorialOverlay";

describe("NeighborhoodsEditorialOverlay", () => {
  it("renders ALIVE TONIGHT variant when tonight > 0", () => {
    render(
      <NeighborhoodsEditorialOverlay
        tonightNeighborhoodCount={14}
        weekNeighborhoodCount={30}
      />,
    );
    expect(screen.getByText("ALIVE TONIGHT")).toBeDefined();
    expect(
      screen.getByText("14 neighborhoods have events starting soon"),
    ).toBeDefined();
  });

  it("renders THIS WEEK variant when tonight === 0 but week > 0", () => {
    render(
      <NeighborhoodsEditorialOverlay
        tonightNeighborhoodCount={0}
        weekNeighborhoodCount={22}
      />,
    );
    expect(screen.getByText("THIS WEEK")).toBeDefined();
    expect(screen.getByText("Across Atlanta")).toBeDefined();
  });

  it("renders nothing when both counts are 0", () => {
    const { container } = render(
      <NeighborhoodsEditorialOverlay
        tonightNeighborhoodCount={0}
        weekNeighborhoodCount={0}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("uses provided cityName in week_scope variant", () => {
    render(
      <NeighborhoodsEditorialOverlay
        tonightNeighborhoodCount={0}
        weekNeighborhoodCount={5}
        cityName="Decatur"
      />,
    );
    expect(screen.getByText("Across Decatur")).toBeDefined();
  });
});
