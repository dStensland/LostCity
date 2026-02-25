import { describe, expect, it } from "vitest";
import { buildPortalManifest, shouldApplyCityFilter } from "@/lib/portal-manifest";

describe("buildPortalManifest", () => {
  it("builds business-exclusive manifests with shared-only city filtering", () => {
    const manifest = buildPortalManifest({
      portalId: "p1",
      slug: "marriott-downtown",
      portalType: "business",
      parentPortalId: null,
      settings: { vertical: "hotel" },
      filters: { city: "Atlanta" },
      sourceIds: [10, 22, -1],
    });

    expect(manifest.scope.portalExclusive).toBe(true);
    expect(manifest.scope.enforceCityFilter).toBe("shared_only");
    expect(manifest.scope.sourceIds).toEqual([10, 22]);
    expect(manifest.metadata.eventFieldOrder).toEqual([
      "date",
      "time",
      "venue",
      "distance",
      "price",
      "status",
    ]);
  });

  it("builds city manifests with always-on city filtering when city guard exists", () => {
    const manifest = buildPortalManifest({
      portalId: "p2",
      slug: "atlanta",
      portalType: "city",
      settings: { vertical: "city" },
      filters: { city: "Atlanta" },
      sourceIds: [],
    });

    expect(manifest.vertical).toBe("city");
    expect(manifest.scope.portalExclusive).toBe(false);
    expect(manifest.scope.enforceCityFilter).toBe("always");
    expect(manifest.modules.artists).toBe(true);
  });
});

describe("shouldApplyCityFilter", () => {
  it("skips city filtering for exclusive portals when policy is shared-only", () => {
    const manifest = buildPortalManifest({
      portalId: "p3",
      slug: "private-portal",
      portalType: "business",
      parentPortalId: null,
      settings: { vertical: "community" },
      filters: { city: "Atlanta" },
    });

    expect(shouldApplyCityFilter(manifest)).toBe(false);
  });
});

