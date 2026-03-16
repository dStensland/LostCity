import { describe, expect, it } from "vitest";
import {
  ATTACHED_CHILD_DESTINATION_VENUE_TYPES,
  ATTACHED_CHILD_DESTINATION_SECTION_TITLE,
  DESTINATION_NODE_IDENTITY_TIERS,
  DESTINATION_NODE_RELATIONSHIP_KINDS,
  getDestinationNodeIdentityTier,
  getDestinationNodeIdentityTierRank,
  getDestinationNodeRelationshipLabel,
  isAttachedChildDestinationVenueType,
  isConcreteDestinationOpportunityFamily,
  isDestinationAttachmentFamily,
  isDestinationNodeIdentityTier,
  isDestinationNodeRelationshipKind,
  sortDestinationNodesForDisplay,
} from "@/lib/destination-graph";

describe("destination graph contract", () => {
  it("keeps attached richness families separate from concrete opportunity families", () => {
    expect(isDestinationAttachmentFamily("venue_features")).toBe(true);
    expect(isDestinationAttachmentFamily("open_calls")).toBe(false);
    expect(isConcreteDestinationOpportunityFamily("open_calls")).toBe(true);
    expect(isConcreteDestinationOpportunityFamily("venue_specials")).toBe(false);
  });

  it("defines attached child venue types for landmark-style destination detail", () => {
    expect(ATTACHED_CHILD_DESTINATION_VENUE_TYPES).toContain("artifact");
    expect(ATTACHED_CHILD_DESTINATION_SECTION_TITLE).toBe("Inside This Venue");
    expect(isAttachedChildDestinationVenueType("historic_site")).toBe(true);
    expect(isAttachedChildDestinationVenueType("museum")).toBe(false);
  });

  it("shares destination-node relationship states across launch config and UI", () => {
    expect(DESTINATION_NODE_RELATIONSHIP_KINDS).toContain("child_landmark");
    expect(isDestinationNodeRelationshipKind("parent_destination")).toBe(true);
    expect(isDestinationNodeRelationshipKind("child_feature")).toBe(false);
  });

  it("formats destination-node relationship labels consistently", () => {
    expect(
      getDestinationNodeRelationshipLabel({
        relationshipKind: "child_landmark",
        parentName: "Grant Park",
      }),
    ).toBe("Inside Grant Park");
    expect(
      getDestinationNodeRelationshipLabel({
        relationshipKind: "parent_destination",
        spotName: "Amicalola Falls",
      }),
    ).toBe("Via Amicalola Falls");
    expect(
      getDestinationNodeRelationshipLabel({
        relationshipKind: "standalone_spot",
        spotName: "Krog Street Tunnel",
      }),
    ).toBeNull();
  });

  it("classifies destination-node identity tier from relationship kind", () => {
    expect(DESTINATION_NODE_IDENTITY_TIERS).toContain("attached_child");
    expect(getDestinationNodeIdentityTier("child_landmark")).toBe(
      "attached_child",
    );
    expect(getDestinationNodeIdentityTier("parent_destination")).toBe(
      "standalone_destination",
    );
    expect(isDestinationNodeIdentityTier("attached_child")).toBe(true);
    expect(isDestinationNodeIdentityTier("unknown")).toBe(false);
    expect(getDestinationNodeIdentityTierRank("standalone_destination")).toBe(
      0,
    );
    expect(getDestinationNodeIdentityTierRank("attached_child")).toBe(1);
  });

  it("sorts destination nodes for display with standalone nodes before attached children", () => {
    const sorted = sortDestinationNodesForDisplay([
      {
        id: "attached-high",
        identityTier: "attached_child" as const,
        launchPriority: 100,
      },
      {
        id: "standalone-mid",
        identityTier: "standalone_destination" as const,
        launchPriority: 50,
      },
      {
        id: "standalone-high",
        identityTier: "standalone_destination" as const,
        launchPriority: 90,
      },
    ]);

    expect(sorted.map((node) => node.id)).toEqual([
      "standalone-high",
      "standalone-mid",
      "attached-high",
    ]);
  });
});
