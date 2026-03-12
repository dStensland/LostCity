import { describe, expect, it } from "vitest";
import {
  buildStableInstantSearchCacheKey,
  buildStableSearchCacheKey,
} from "@/lib/search-cache-key";

describe("search-cache-key", () => {
  it("builds a stable full-search key from relevant params", () => {
    const params = new URLSearchParams(
      "types=event,venue&q=live+music&foo=bar&portal_id=123&limit=20",
    );

    expect(buildStableSearchCacheKey(params)).toBe(
      "limit=20&portal_id=123&q=live%20music&types=event%2Cvenue",
    );
  });

  it("builds a stable instant-search key from relevant params", () => {
    const params = new URLSearchParams(
      "findType=events&q=jazz&viewMode=find&portal=atlanta&include_organizers=true&types=venue,event&x=1",
    );

    expect(buildStableInstantSearchCacheKey(params)).toBe(
      "findType=events&include_organizers=true&portal=atlanta&q=jazz&types=event%2Cvenue&viewMode=find",
    );
  });

  it("normalizes equivalent search params into the same cache key", () => {
    const first = new URLSearchParams(
      "q= Live   Music &types=venue,event&tags=free,outdoor&limit=020",
    );
    const second = new URLSearchParams(
      "limit=20&tags=outdoor,free&types=event,venue&q=live music",
    );

    expect(buildStableSearchCacheKey(first)).toBe(
      buildStableSearchCacheKey(second),
    );
  });
});
