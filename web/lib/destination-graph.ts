import type { EntityFamily } from "@/lib/portal-taxonomy";

export const DESTINATION_ATTACHMENT_FAMILIES = [
  "venue_features",
  "venue_specials",
  "editorial_mentions",
  "venue_occasions",
] as const satisfies readonly EntityFamily[];

export const ATTACHED_CHILD_DESTINATION_SECTION_TITLE = "Inside This Venue";

export type DestinationAttachmentFamily =
  (typeof DESTINATION_ATTACHMENT_FAMILIES)[number];

export const CONCRETE_DESTINATION_OPPORTUNITY_FAMILIES = [
  "open_calls",
  "volunteer_opportunities",
] as const satisfies readonly EntityFamily[];

export type ConcreteDestinationOpportunityFamily =
  (typeof CONCRETE_DESTINATION_OPPORTUNITY_FAMILIES)[number];

export const ATTACHED_CHILD_DESTINATION_VENUE_TYPES = [
  "landmark",
  "artifact",
  "public_art",
  "viewpoint",
  "historic_site",
  "skyscraper",
] as const;

export const DESTINATION_NODE_RELATIONSHIP_KINDS = [
  "standalone_spot",
  "parent_destination",
  "child_landmark",
] as const;

export type DestinationNodeRelationshipKind =
  (typeof DESTINATION_NODE_RELATIONSHIP_KINDS)[number];

export const DESTINATION_NODE_IDENTITY_TIERS = [
  "standalone_destination",
  "attached_child",
] as const;

export type DestinationNodeIdentityTier =
  (typeof DESTINATION_NODE_IDENTITY_TIERS)[number];

const DESTINATION_ATTACHMENT_FAMILY_SET = new Set<string>(
  DESTINATION_ATTACHMENT_FAMILIES,
);
const CONCRETE_DESTINATION_OPPORTUNITY_FAMILY_SET = new Set<string>(
  CONCRETE_DESTINATION_OPPORTUNITY_FAMILIES,
);
const ATTACHED_CHILD_DESTINATION_VENUE_TYPE_SET = new Set<string>(
  ATTACHED_CHILD_DESTINATION_VENUE_TYPES,
);
const DESTINATION_NODE_RELATIONSHIP_KIND_SET = new Set<string>(
  DESTINATION_NODE_RELATIONSHIP_KINDS,
);
const DESTINATION_NODE_IDENTITY_TIER_SET = new Set<string>(
  DESTINATION_NODE_IDENTITY_TIERS,
);

export function isDestinationAttachmentFamily(
  value: unknown,
): value is DestinationAttachmentFamily {
  return (
    typeof value === "string" &&
    DESTINATION_ATTACHMENT_FAMILY_SET.has(value)
  );
}

export function isConcreteDestinationOpportunityFamily(
  value: unknown,
): value is ConcreteDestinationOpportunityFamily {
  return (
    typeof value === "string" &&
    CONCRETE_DESTINATION_OPPORTUNITY_FAMILY_SET.has(value)
  );
}

export function isAttachedChildDestinationVenueType(
  value: unknown,
): value is (typeof ATTACHED_CHILD_DESTINATION_VENUE_TYPES)[number] {
  return (
    typeof value === "string" &&
    ATTACHED_CHILD_DESTINATION_VENUE_TYPE_SET.has(value)
  );
}

export function isDestinationNodeRelationshipKind(
  value: unknown,
): value is DestinationNodeRelationshipKind {
  return (
    typeof value === "string" &&
    DESTINATION_NODE_RELATIONSHIP_KIND_SET.has(value)
  );
}

export function getDestinationNodeRelationshipLabel({
  relationshipKind,
  spotName,
  parentName,
}: {
  relationshipKind: DestinationNodeRelationshipKind;
  spotName?: string | null;
  parentName?: string | null;
}): string | null {
  if (relationshipKind === "child_landmark" && parentName) {
    return `Inside ${parentName}`;
  }
  if (relationshipKind === "parent_destination" && spotName) {
    return `Via ${spotName}`;
  }
  return null;
}

export function getDestinationNodeIdentityTier(
  relationshipKind: DestinationNodeRelationshipKind,
): DestinationNodeIdentityTier {
  return relationshipKind === "child_landmark"
    ? "attached_child"
    : "standalone_destination";
}

export function isDestinationNodeIdentityTier(
  value: unknown,
): value is DestinationNodeIdentityTier {
  return (
    typeof value === "string" &&
    DESTINATION_NODE_IDENTITY_TIER_SET.has(value)
  );
}

export function getDestinationNodeIdentityTierRank(
  identityTier: DestinationNodeIdentityTier,
): number {
  return identityTier === "attached_child" ? 1 : 0;
}

export function sortDestinationNodesForDisplay<
  T extends {
    identityTier: DestinationNodeIdentityTier;
    launchPriority?: number | null;
  },
>(nodes: T[]): T[] {
  return [...nodes].sort((a, b) => {
    const tierRankDelta =
      getDestinationNodeIdentityTierRank(a.identityTier) -
      getDestinationNodeIdentityTierRank(b.identityTier);
    if (tierRankDelta !== 0) return tierRankDelta;
    return (b.launchPriority ?? 0) - (a.launchPriority ?? 0);
  });
}
