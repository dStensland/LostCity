import { describe, expect, it } from "vitest";
import { buildStableSpotsSearchParamsKey } from "@/lib/spots-cache-key";

describe("spots-cache-key", () => {
  it("ignores unknown params and sorts included keys", () => {
    const params = new URLSearchParams(
      "q=coffee&foo=bar&venue_type=cafe&portal_id=123",
    );

    expect(buildStableSpotsSearchParamsKey(params)).toBe(
      "portal_id=123&q=coffee&venue_type=cafe",
    );
  });

  it("includes location and sort inputs that change payload ordering", () => {
    const params = new URLSearchParams(
      "portal_id=123&center_lat=33.7&center_lng=-84.3&sort=distance&limit=50",
    );

    expect(buildStableSpotsSearchParamsKey(params)).toBe(
      "center_lat=33.7&center_lng=-84.3&limit=50&portal_id=123&sort=distance",
    );
  });

  it("normalizes equivalent spot filter params into the same cache key", () => {
    const first = new URLSearchParams(
      "q= Coffee  Shop &venue_type=bar,cafe&center_lat=33.700&center_lng=-84.3000&limit=050",
    );
    const second = new URLSearchParams(
      "limit=50&center_lng=-84.3&center_lat=33.7&venue_type=cafe,bar&q=coffee shop",
    );

    expect(buildStableSpotsSearchParamsKey(first)).toBe(
      buildStableSpotsSearchParamsKey(second),
    );
  });
});
