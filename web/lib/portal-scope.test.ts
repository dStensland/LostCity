import { describe, expect, it } from "vitest";
import {
  applyFederatedPortalScopeToQuery,
  applyPortalScopeToQuery,
  filterByPortalCity,
  isVenueCityInScope,
} from "@/lib/portal-scope";

class MockQuery {
  ops: string[] = [];

  eq(column: string, value: string) {
    this.ops.push(`eq:${column}:${value}`);
    return this;
  }

  or(filters: string) {
    this.ops.push(`or:${filters}`);
    return this;
  }

  is(column: string, value: null) {
    this.ops.push(`is:${column}:${value}`);
    return this;
  }
}

describe("applyPortalScopeToQuery", () => {
  it("applies strict portal scope when portalExclusive=true", () => {
    const query = new MockQuery();
    applyPortalScopeToQuery(query, {
      portalId: "portal-123",
      portalExclusive: true,
      publicOnlyWhenNoPortal: true,
    });
    expect(query.ops).toEqual(["eq:portal_id:portal-123"]);
  });

  it("applies shared portal scope when portalExclusive=false", () => {
    const query = new MockQuery();
    applyPortalScopeToQuery(query, {
      portalId: "portal-123",
      portalExclusive: false,
      publicOnlyWhenNoPortal: true,
    });
    expect(query.ops).toEqual(["or:portal_id.eq.portal-123,portal_id.is.null"]);
  });

  it("applies public-only scope when no portal is provided and policy requires it", () => {
    const query = new MockQuery();
    applyPortalScopeToQuery(query, {
      portalId: null,
      portalExclusive: false,
      publicOnlyWhenNoPortal: true,
    });
    expect(query.ops).toEqual(["is:portal_id:null"]);
  });
});

describe("applyFederatedPortalScopeToQuery", () => {
  it("applies strict portal scope with subscribed sources for exclusive portals", () => {
    const query = new MockQuery();
    applyFederatedPortalScopeToQuery(query, {
      portalId: "portal-123",
      portalExclusive: true,
      sourceIds: [12, 44],
      publicOnlyWhenNoPortal: true,
    });
    expect(query.ops).toEqual(["or:portal_id.eq.portal-123,source_id.in.(12,44)"]);
  });

  it("applies shared portal/public scope with subscribed sources", () => {
    const query = new MockQuery();
    applyFederatedPortalScopeToQuery(query, {
      portalId: "portal-123",
      portalExclusive: false,
      sourceIds: [12, 44],
      publicOnlyWhenNoPortal: true,
    });
    expect(query.ops).toEqual([
      "or:portal_id.eq.portal-123,portal_id.is.null,source_id.in.(12,44)",
    ]);
  });

  it("falls back to regular portal scope when no source IDs are provided", () => {
    const query = new MockQuery();
    applyFederatedPortalScopeToQuery(query, {
      portalId: "portal-123",
      portalExclusive: false,
      publicOnlyWhenNoPortal: true,
    });
    expect(query.ops).toEqual(["or:portal_id.eq.portal-123,portal_id.is.null"]);
  });
});

describe("city scope helpers", () => {
  it("treats Atlanta portal city as metro-inclusive", () => {
    expect(isVenueCityInScope("Decatur", "Atlanta")).toBe(true);
    expect(isVenueCityInScope("Nashville", "Atlanta")).toBe(false);
  });

  it("matches non-Atlanta portal city by exact or word boundary", () => {
    expect(isVenueCityInScope("East Point", "Point", { allowMissingCity: false })).toBe(true);
    expect(isVenueCityInScope("Nashville", "Atlanta", { allowMissingCity: false })).toBe(false);
  });

  it("filters rows by portal city", () => {
    const rows = [
      { id: 1, venue: { city: "Atlanta" } },
      { id: 2, venue: { city: "Decatur" } },
      { id: 3, venue: { city: "Nashville" } },
    ];
    const filtered = filterByPortalCity(rows, "Atlanta", { allowMissingCity: false });
    expect(filtered.map((row) => row.id)).toEqual([1, 2]);
  });
});
