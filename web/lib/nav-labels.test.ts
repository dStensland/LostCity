import { describe, expect, it } from "vitest";
import { getPortalNavLabel } from "@/lib/nav-labels";

describe("getPortalNavLabel", () => {
  it("uses canonical keys when present", () => {
    const labels = {
      feed: "Act",
      find: "Calendar",
      community: "Groups",
    };

    expect(getPortalNavLabel(labels, "feed", "Feed")).toBe("Act");
    expect(getPortalNavLabel(labels, "find", "Find")).toBe("Calendar");
    expect(getPortalNavLabel(labels, "community", "Community")).toBe("Groups");
  });

  it("falls back to legacy keys for find/events compatibility", () => {
    const labels = {
      events: "Stuff",
    };

    expect(getPortalNavLabel(labels, "find", "Find")).toBe("Stuff");
    expect(getPortalNavLabel(labels, "events", "Events")).toBe("Stuff");
  });

  it("does not map legacy spots into community", () => {
    const labels = {
      spots: "Places",
    };

    expect(getPortalNavLabel(labels, "spots", "Spots")).toBe("Places");
    expect(getPortalNavLabel(labels, "community", "Community")).toBe("Community");
  });
});
