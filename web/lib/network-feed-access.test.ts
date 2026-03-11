import { describe, expect, it } from "vitest";
import { buildNetworkFeedAccessSummary } from "./network-feed-access";

describe("buildNetworkFeedAccessSummary", () => {
  it("keeps only the local portal when the parent has no active source pool", () => {
    const result = buildNetworkFeedAccessSummary({
      portal: { id: "helpatl-id", slug: "helpatl", parent_portal_id: "atlanta-id" },
      localSourceCount: 2,
      parentPortal: { id: "atlanta-id", slug: "atlanta" },
      parentSourceCount: 0,
    });

    expect(result.accessiblePortalIds).toEqual(["helpatl-id"]);
    expect(result.accessiblePortalSlugs).toEqual(["helpatl"]);
  });

  it("merges local and parent portal source pools", () => {
    const result = buildNetworkFeedAccessSummary({
      portal: { id: "helpatl-id", slug: "helpatl", parent_portal_id: "atlanta-id" },
      localSourceCount: 2,
      parentPortal: { id: "atlanta-id", slug: "atlanta" },
      parentSourceCount: 16,
    });

    expect(result.accessiblePortalIds).toEqual(["helpatl-id", "atlanta-id"]);
    expect(result.accessiblePortalSlugs).toEqual(["helpatl", "atlanta"]);
  });

  it("still includes the parent portal when the child has no local sources", () => {
    const result = buildNetworkFeedAccessSummary({
      portal: { id: "helpatl-id", slug: "helpatl", parent_portal_id: "atlanta-id" },
      localSourceCount: 0,
      parentPortal: { id: "atlanta-id", slug: "atlanta" },
      parentSourceCount: 16,
    });

    expect(result.accessiblePortalIds).toEqual(["helpatl-id", "atlanta-id"]);
    expect(result.accessiblePortalSlugs).toEqual(["helpatl", "atlanta"]);
  });
});
