import { describe, expect, it } from "vitest";
import {
  filterByPortalCity,
  filterRowsByFederatedPortalScope,
} from "@/lib/portal-scope";

type FixtureEvent = {
  id: number;
  portal_id: string | null;
  source_id: number | null;
  venue: { city: string | null } | null;
};

const FIXTURE_EVENTS: FixtureEvent[] = [
  { id: 1, portal_id: "atl", source_id: 100, venue: { city: "Atlanta" } },
  { id: 2, portal_id: null, source_id: 101, venue: { city: "Atlanta" } },
  { id: 3, portal_id: null, source_id: 102, venue: { city: "Nashville" } },
  { id: 4, portal_id: "nash", source_id: 900, venue: { city: "Nashville" } },
  { id: 5, portal_id: null, source_id: 900, venue: { city: "Decatur" } },
  { id: 6, portal_id: "atl", source_id: 900, venue: { city: "Atlanta" } },
  { id: 7, portal_id: "nash", source_id: 103, venue: { city: "Nashville" } },
  { id: 8, portal_id: null, source_id: null, venue: { city: null } },
];

describe("portal federation integration", () => {
  it("shared city portal excludes cross-city public leakage after city guard", () => {
    const scoped = filterRowsByFederatedPortalScope(FIXTURE_EVENTS, {
      portalId: "atl",
      portalExclusive: false,
      publicOnlyWhenNoPortal: true,
    });
    const cityScoped = filterByPortalCity(scoped, "Atlanta", {
      allowMissingCity: false,
    });

    expect(cityScoped.map((event) => event.id)).toEqual([1, 2, 5, 6]);
  });

  it("shared portal with subscribed sources still requires city in shared mode", () => {
    const scoped = filterRowsByFederatedPortalScope(FIXTURE_EVENTS, {
      portalId: "atl",
      portalExclusive: false,
      sourceIds: [900],
      publicOnlyWhenNoPortal: true,
    });
    const cityScoped = filterByPortalCity(scoped, "Atlanta", {
      allowMissingCity: true,
    });

    expect(cityScoped.map((event) => event.id)).toEqual([1, 2, 5, 6, 8]);
    expect(cityScoped.some((event) => event.id === 4)).toBe(false);
  });

  it("exclusive business portal can include subscribed-source events across cities", () => {
    const scoped = filterRowsByFederatedPortalScope(FIXTURE_EVENTS, {
      portalId: "atl",
      portalExclusive: true,
      sourceIds: [900],
      publicOnlyWhenNoPortal: true,
    });

    expect(scoped.map((event) => event.id)).toEqual([1, 4, 5, 6]);
  });

  it("no portal context stays public-only", () => {
    const scoped = filterRowsByFederatedPortalScope(FIXTURE_EVENTS, {
      portalId: null,
      portalExclusive: false,
      publicOnlyWhenNoPortal: true,
    });

    expect(scoped.map((event) => event.id)).toEqual([2, 3, 5, 8]);
  });
});
