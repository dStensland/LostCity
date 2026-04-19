import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import BigStuffHeroCard from "./BigStuffHeroCard";
import BigStuffRow from "./BigStuffRow";
import type { BigStuffPageItem } from "@/lib/big-stuff/types";

const mkItem = (partial: Partial<BigStuffPageItem> = {}): BigStuffPageItem => ({
  id: "festival:1",
  kind: "festival",
  title: "Shaky Knees",
  startDate: "2026-05-02",
  endDate: "2026-05-04",
  location: "Piedmont Park",
  href: "/atlanta/festivals/shaky-knees",
  type: "festival",
  isLiveNow: false,
  description: "Four-day rock festival with live music on multiple stages.",
  imageUrl: "https://example.com/sk.jpg",
  tier: "hero",
  ...partial,
});

describe("BigStuffHeroCard", () => {
  it("renders title, dates, location, and teaser", () => {
    const { getByText } = render(<BigStuffHeroCard item={mkItem()} />);
    expect(getByText("Shaky Knees")).toBeDefined();
    expect(getByText(/May 2 – 4/)).toBeDefined();
    expect(getByText(/Piedmont Park/)).toBeDefined();
    expect(getByText(/Four-day rock festival/)).toBeDefined();
  });

  it("renders the type pill", () => {
    const { getByText } = render(<BigStuffHeroCard item={mkItem()} />);
    expect(getByText(/FESTIVAL/)).toBeDefined();
  });

  it("renders a LIVE NOW pill when isLiveNow", () => {
    const { getByText } = render(
      <BigStuffHeroCard item={mkItem({ isLiveNow: true })} />,
    );
    expect(getByText(/LIVE NOW/i)).toBeDefined();
  });

  it("omits description block when description is null", () => {
    const { queryByText } = render(
      <BigStuffHeroCard item={mkItem({ description: null })} />,
    );
    expect(queryByText(/Four-day rock festival with live music/)).toBeNull();
  });

  it("renders Crown fallback icon when imageUrl is null", () => {
    const { container } = render(
      <BigStuffHeroCard item={mkItem({ imageUrl: null })} />,
    );
    expect(container.querySelector('[data-hero-fallback]')).toBeDefined();
  });

  it("wraps content in a link with the item's href", () => {
    const { container } = render(<BigStuffHeroCard item={mkItem()} />);
    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe("/atlanta/festivals/shaky-knees");
  });

  it("applies the type accent on left border via data-type", () => {
    const { container } = render(<BigStuffHeroCard item={mkItem()} />);
    expect(container.querySelector('[data-type="festival"]')).toBeDefined();
  });
});

describe("BigStuffRow", () => {
  it("renders title, dates, location, and type pill", () => {
    const { getByText } = render(<BigStuffRow item={mkItem({ tier: "standard" })} />);
    expect(getByText("Shaky Knees")).toBeDefined();
    expect(getByText(/May 2 – 4/)).toBeDefined();
    expect(getByText(/Piedmont Park/)).toBeDefined();
    expect(getByText(/FESTIVAL/)).toBeDefined();
  });

  it("renders LIVE NOW pill IN PLACE OF the type pill when isLiveNow", () => {
    const { getByText, queryByText } = render(
      <BigStuffRow item={mkItem({ tier: "standard", isLiveNow: true })} />,
    );
    expect(getByText(/LIVE NOW/i)).toBeDefined();
    expect(queryByText(/FESTIVAL/)).toBeNull();
  });
});
