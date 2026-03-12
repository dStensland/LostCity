import { describe, expect, it } from "vitest";
import {
  getEventListingEmptyStateCopy,
  getFeedEmptyStateCopy,
  getGroupsUnavailableCopy,
  getHighlightsEmptyStateCopy,
  getHappeningNowEmptyStateCopy,
  getSpotsEmptyStateCopy,
  getTrendingEmptyStateCopy,
} from "@/lib/empty-state-copy";

describe("empty-state-copy", () => {
  it("keeps feed copy actionable", () => {
    expect(getFeedEmptyStateCopy()).toEqual({
      headline: "Nothing to show here yet",
      subline: "Try the full event feed while we pull together fresh picks for this view.",
      actionLabel: "Browse all events",
    });
  });

  it("uses consistent event listing fallback copy", () => {
    expect(getEventListingEmptyStateCopy().headline).toBe(
      "No events match this page right now",
    );
    expect(getEventListingEmptyStateCopy().actionLabel).toBe("Browse all events");
  });

  it("uses places vocabulary for spot empty states", () => {
    expect(getSpotsEmptyStateCopy({ activeChipLabel: "Coffee" }).headline).toBe(
      "No places found for 'Coffee'",
    );
    expect(getSpotsEmptyStateCopy({}).headline).toBe(
      "No places match these filters",
    );
  });

  it("distinguishes all-atlanta and scoped happening-now empty states", () => {
    expect(
      getHappeningNowEmptyStateCopy({ modeLabel: "All of Atlanta" }).headline,
    ).toBe("Nothing is live right now");
    expect(
      getHappeningNowEmptyStateCopy({ modeLabel: "Midtown" }).subline,
    ).toContain("Midtown");
  });

  it("turns unavailable groups into a redirectable state", () => {
    expect(getGroupsUnavailableCopy("Groups")).toEqual({
      headline: "Groups aren't live here yet",
      subline: "Explore events and places while we finish opening this part of the portal.",
      actionLabel: "Explore the portal",
    });
  });

  it("keeps trending and highlights empty states human", () => {
    expect(getTrendingEmptyStateCopy().headline).toBe(
      "Trending picks are quiet right now",
    );
    expect(getHighlightsEmptyStateCopy({ period: "today" }).headline).toBe(
      "Nothing picked for today yet",
    );
    expect(getHighlightsEmptyStateCopy({ period: "week" }).subline).toContain(
      "month's highlights",
    );
  });
});
