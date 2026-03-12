import { describe, expect, it } from "vitest";
import {
  getPortalCityAllowlist,
  isVenueCityInPortalAllowlist,
} from "@/lib/forth-data";

describe("forth-data city guardrails", () => {
  it("builds a deduplicated allowlist from city and cities filters", () => {
    const cities = getPortalCityAllowlist({
      city: "Atlanta",
      cities: ["Decatur", "Atlanta"],
    });

    expect(cities).toContain("atlanta");
    expect(cities).toContain("decatur");
    expect(cities).toContain("east point");
    expect(cities.filter((city) => city === "atlanta")).toHaveLength(1);
  });

  it("matches venue cities against the expanded allowlist", () => {
    const cities = getPortalCityAllowlist({
      cities: ["Atlanta", "Decatur"],
    });

    expect(isVenueCityInPortalAllowlist("East Point", cities)).toBe(true);
    expect(isVenueCityInPortalAllowlist("Downtown Atlanta", cities)).toBe(true);
    expect(isVenueCityInPortalAllowlist("Nashville", cities)).toBe(false);
  });
});
