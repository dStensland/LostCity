import { describe, expect, it } from "vitest";
import {
  isPortalCityMatch,
  sortEventsByPortalCityPreference,
} from "@/lib/portal-locality";

describe("portal-locality", () => {
  it("matches exact and word-boundary city strings", () => {
    expect(isPortalCityMatch("Atlanta", ["atlanta"])).toBe(true);
    expect(isPortalCityMatch("Atlanta, GA", ["atlanta"])).toBe(true);
    expect(isPortalCityMatch("East Point", ["atlanta"])).toBe(false);
  });

  it("sorts portal-city events ahead of metro spillover", () => {
    const sorted = sortEventsByPortalCityPreference(
      [
        { id: 1, venue: { city: "Decatur" } },
        { id: 2, venue: { city: "Atlanta" } },
        { id: 3, venue: { city: "Sandy Springs" } },
      ],
      ["atlanta"],
    );

    expect(sorted.map((event) => event.id)).toEqual([2, 1, 3]);
  });
});
