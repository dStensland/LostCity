import { describe, expect, it } from "vitest";
import {
  FIND_FILTER_RESET_KEYS,
  SHOWTIMES_EXCLUDED_FILTER_KEYS,
  hasActiveFindFilters,
} from "@/lib/find-filter-schema";

describe("find-filter-schema", () => {
  it("detects active event filters from URLSearchParams", () => {
    const params = new URLSearchParams({
      categories: "music",
      view: "find",
      type: "events",
    });

    expect(hasActiveFindFilters(params, "events")).toBe(true);
  });

  it("detects active class filters from plain objects", () => {
    const params = {
      class_skill: "beginner",
      type: "classes",
    };

    expect(hasActiveFindFilters(params, "classes")).toBe(true);
  });

  it("keeps showtimes strict to showtimes keys only", () => {
    const params = new URLSearchParams({
      search: "thriller",
      type: "showtimes",
    });

    expect(hasActiveFindFilters(params, "showtimes")).toBe(false);

    params.set("theater", "plaza");
    expect(hasActiveFindFilters(params, "showtimes")).toBe(true);
  });

  it("includes class/destination keys in reset set and excludes date for showtimes strip", () => {
    expect(FIND_FILTER_RESET_KEYS).toContain("class_skill");
    expect(FIND_FILTER_RESET_KEYS).toContain("venue_type");
    expect(SHOWTIMES_EXCLUDED_FILTER_KEYS).not.toContain("date");
    expect(SHOWTIMES_EXCLUDED_FILTER_KEYS).toContain("theater");
  });
});
