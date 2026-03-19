import { describe, expect, it } from "vitest";
import { getCivicEventHref } from "@/lib/civic-routing";

describe("getCivicEventHref", () => {
  it("routes civic aliases through the community detail behavior", () => {
    expect(
      getCivicEventHref({ id: 42, category: "volunteer" }, "helpatl", "civic"),
    ).toBe("/helpatl/volunteer/42");
  });

  it("ignores non-community verticals", () => {
    expect(
      getCivicEventHref({ id: 42, category: "volunteer" }, "atlanta", "arts"),
    ).toBeNull();
  });
});
