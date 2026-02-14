import { describe, expect, it } from "vitest";
import {
  PORTAL_SKELETON_REGISTRY,
  PORTAL_SKELETON_ROUTES,
  PORTAL_SKELETON_VERTICALS,
  inferSkeletonVerticalFromSlug,
  resolveSkeletonVertical,
} from "./skeleton-contract";

describe("skeleton contract", () => {
  it("covers all required verticals for every skeleton route", () => {
    for (const route of PORTAL_SKELETON_ROUTES) {
      const coverage = PORTAL_SKELETON_REGISTRY[route];
      expect(coverage, `missing skeleton registry for route ${route}`).toBeDefined();
      for (const vertical of PORTAL_SKELETON_VERTICALS) {
        expect(coverage[vertical], `missing ${vertical} skeleton for route ${route}`).toBeTruthy();
      }
    }
  });

  it("infers vertical by slug fallback", () => {
    expect(inferSkeletonVerticalFromSlug("forth")).toBe("hotel");
    expect(inferSkeletonVerticalFromSlug("atlanta-film")).toBe("film");
    expect(inferSkeletonVerticalFromSlug("emory-demo")).toBe("hospital");
    expect(inferSkeletonVerticalFromSlug("atlanta")).toBe("city");
  });

  it("uses configured portal vertical when available", () => {
    expect(resolveSkeletonVertical({ settings: { vertical: "film" } }, "atlanta")).toBe("film");
    expect(resolveSkeletonVertical({ settings: { vertical: "unknown" } }, "forth")).toBe("hotel");
    expect(resolveSkeletonVertical(null, "emory-demo")).toBe("hospital");
  });
});

