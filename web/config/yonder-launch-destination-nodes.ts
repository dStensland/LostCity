import type { DestinationNodeRelationshipKind } from "@/lib/destination-graph";

export type YonderDestinationNodeQuestId =
  | "waterfalls"
  | "summits"
  | "secret_atlanta"
  | "river_access"
  | "starter";

export type YonderLaunchDestinationNodeQuest = {
  id: YonderDestinationNodeQuestId;
  title: string;
  subtitle: string;
};

export type YonderLaunchDestinationNode = {
  id: string;
  title: string;
  spotSlug: string;
  parentSpotSlug: string | null;
  relationshipKind: DestinationNodeRelationshipKind;
  destinationNodeType:
    | "waterfall"
    | "summit"
    | "fire_tower"
    | "oddity"
    | "hidden_green_space"
    | "river_access"
    | "starter";
  summary: string;
  questIds: YonderDestinationNodeQuestId[];
  launchPriority: number;
};

export const YONDER_LAUNCH_DESTINATION_NODE_QUESTS: YonderLaunchDestinationNodeQuest[] = [
  {
    id: "waterfalls",
    title: "Hidden Waterfalls",
    subtitle: "Big-payoff falls and hike-worthy cascades across North Georgia.",
  },
  {
    id: "summits",
    title: "Fire Towers & Summits",
    subtitle: "Clear-effort mountain benchmarks with real skyline or Appalachian payoff.",
  },
  {
    id: "secret_atlanta",
    title: "Secret Atlanta",
    subtitle: "Outdoor art, oddities, and low-friction city artifacts with real personality.",
  },
  {
    id: "river_access",
    title: "River Access Circuit",
    subtitle: "The Chattahoochee and beyond, organized as actual go-do-this access points.",
  },
  {
    id: "starter",
    title: "Starter Quest",
    subtitle: "Low-friction, high-upside outdoor wins for people who just need a reason to go.",
  },
];

export const YONDER_LAUNCH_DESTINATION_NODES: YonderLaunchDestinationNode[] = [
  {
    id: "amicalola-falls-deck",
    title: "Amicalola Falls",
    spotSlug: "amicalola-falls",
    parentSpotSlug: null,
    relationshipKind: "parent_destination",
    destinationNodeType: "waterfall",
    summary: "Iconic North Georgia waterfall payoff with enough gravity to anchor a whole day.",
    questIds: ["waterfalls", "starter"],
    launchPriority: 100,
  },
  {
    id: "raven-cliff-falls",
    title: "Raven Cliff Falls",
    spotSlug: "raven-cliff-falls",
    parentSpotSlug: null,
    relationshipKind: "parent_destination",
    destinationNodeType: "waterfall",
    summary: "One of the cleanest signature waterfall quests in the region.",
    questIds: ["waterfalls"],
    launchPriority: 99,
  },
  {
    id: "helton-creek-falls",
    title: "Helton Creek Falls",
    spotSlug: "helton-creek-falls",
    parentSpotSlug: null,
    relationshipKind: "parent_destination",
    destinationNodeType: "waterfall",
    summary: "Shorter, beginner-friendlier waterfall stop that still feels worth the drive.",
    questIds: ["waterfalls"],
    launchPriority: 95,
  },
  {
    id: "desoto-falls",
    title: "DeSoto Falls",
    spotSlug: "desoto-falls",
    parentSpotSlug: null,
    relationshipKind: "parent_destination",
    destinationNodeType: "waterfall",
    summary: "A classic double-waterfall stop that fits the launch quest cleanly.",
    questIds: ["waterfalls"],
    launchPriority: 94,
  },
  {
    id: "anna-ruby-falls",
    title: "Anna Ruby Falls",
    spotSlug: "anna-ruby-falls",
    parentSpotSlug: null,
    relationshipKind: "parent_destination",
    destinationNodeType: "waterfall",
    summary: "Easy-access waterfall benchmark with broad appeal and clear payoff.",
    questIds: ["waterfalls", "starter"],
    launchPriority: 92,
  },
  {
    id: "panther-creek-falls",
    title: "Panther Creek Falls",
    spotSlug: "panther-creek-falls",
    parentSpotSlug: null,
    relationshipKind: "parent_destination",
    destinationNodeType: "waterfall",
    summary: "Longer-hike waterfall objective for users ready to level up from easier falls.",
    questIds: ["waterfalls"],
    launchPriority: 91,
  },
  {
    id: "brasstown-bald-summit",
    title: "Brasstown Bald summit deck",
    spotSlug: "brasstown-bald",
    parentSpotSlug: null,
    relationshipKind: "parent_destination",
    destinationNodeType: "summit",
    summary: "Georgia's highest-point payoff and the easiest summit benchmark to understand.",
    questIds: ["summits", "starter"],
    launchPriority: 98,
  },
  {
    id: "rabun-bald-fire-tower",
    title: "Rabun Bald fire tower",
    spotSlug: "rabun-bald",
    parentSpotSlug: null,
    relationshipKind: "parent_destination",
    destinationNodeType: "fire_tower",
    summary: "A true fire-tower objective with clean quest identity.",
    questIds: ["summits"],
    launchPriority: 96,
  },
  {
    id: "blood-mountain-summit",
    title: "Blood Mountain summit",
    spotSlug: "blood-mountain",
    parentSpotSlug: null,
    relationshipKind: "parent_destination",
    destinationNodeType: "summit",
    summary: "High-effort Appalachian benchmark for the bigger-hike crowd.",
    questIds: ["summits"],
    launchPriority: 93,
  },
  {
    id: "springer-mountain-marker",
    title: "Springer Mountain summit marker",
    spotSlug: "springer-mountain",
    parentSpotSlug: null,
    relationshipKind: "parent_destination",
    destinationNodeType: "summit",
    summary: "Appalachian Trail mythology in a concrete, questable milestone.",
    questIds: ["summits"],
    launchPriority: 90,
  },
  {
    id: "krog-street-tunnel",
    title: "Krog Street Tunnel",
    spotSlug: "krog-street-tunnel",
    parentSpotSlug: null,
    relationshipKind: "standalone_spot",
    destinationNodeType: "oddity",
    summary: "Atlanta outdoor-art landmark with instant recognition and social legibility.",
    questIds: ["secret_atlanta", "starter"],
    launchPriority: 97,
  },
  {
    id: "dolls-head-trail",
    title: "Doll's Head Trail",
    spotSlug: "dolls-head-trail",
    parentSpotSlug: "constitution-lakes",
    relationshipKind: "standalone_spot",
    destinationNodeType: "oddity",
    summary: "The most Yonder-coded urban artifact in the current launch set.",
    questIds: ["secret_atlanta"],
    launchPriority: 96,
  },
  {
    id: "folk-art-park",
    title: "Folk Art Park",
    spotSlug: "folk-art-park",
    parentSpotSlug: null,
    relationshipKind: "standalone_spot",
    destinationNodeType: "oddity",
    summary: "Outsider-art Atlanta stop that feels intentional, not generic.",
    questIds: ["secret_atlanta"],
    launchPriority: 89,
  },
  {
    id: "milledge-fountain",
    title: "Milledge Fountain",
    spotSlug: "milledge-fountain",
    parentSpotSlug: "grant-park",
    relationshipKind: "child_landmark",
    destinationNodeType: "hidden_green_space",
    summary: "Low-friction Grant Park landmark for starter-level urban wandering.",
    questIds: ["secret_atlanta", "starter"],
    launchPriority: 88,
  },
  {
    id: "constitution-lakes-boardwalks",
    title: "Constitution Lakes boardwalks",
    spotSlug: "constitution-lakes",
    parentSpotSlug: null,
    relationshipKind: "parent_destination",
    destinationNodeType: "hidden_green_space",
    summary: "Nature-and-oddity bridge that gives Secret Atlanta more outdoors texture.",
    questIds: ["secret_atlanta"],
    launchPriority: 87,
  },
  {
    id: "powers-island-put-in",
    title: "Powers Island put-in",
    spotSlug: "shoot-the-hooch-powers-island",
    parentSpotSlug: null,
    relationshipKind: "parent_destination",
    destinationNodeType: "river_access",
    summary: "The clearest metro river-access identity in the Yonder set.",
    questIds: ["river_access", "starter"],
    launchPriority: 95,
  },
  {
    id: "island-ford-boat-ramp",
    title: "Island Ford boat ramp",
    spotSlug: "island-ford-crnra-boat-ramp",
    parentSpotSlug: null,
    relationshipKind: "parent_destination",
    destinationNodeType: "river_access",
    summary: "Strong Chattahoochee access point that reads immediately in-product.",
    questIds: ["river_access"],
    launchPriority: 90,
  },
  {
    id: "east-palisades-river-edge",
    title: "East Palisades bamboo river edge",
    spotSlug: "east-palisades-trail",
    parentSpotSlug: null,
    relationshipKind: "parent_destination",
    destinationNodeType: "river_access",
    summary: "A distinctively Atlanta river-edge outing with strong visual identity.",
    questIds: ["river_access", "starter"],
    launchPriority: 92,
  },
  {
    id: "cochran-shoals-river-edge",
    title: "Cochran Shoals river edge",
    spotSlug: "cochran-shoals-trail",
    parentSpotSlug: null,
    relationshipKind: "parent_destination",
    destinationNodeType: "river_access",
    summary: "Easy-access Chattahoochee outing that broadens the river circuit.",
    questIds: ["river_access"],
    launchPriority: 86,
  },
  {
    id: "chattahoochee-bend-riverfront",
    title: "Chattahoochee Bend riverfront access",
    spotSlug: "chattahoochee-bend-state-park",
    parentSpotSlug: null,
    relationshipKind: "parent_destination",
    destinationNodeType: "river_access",
    summary: "River-access anchor that extends the quest past the core metro corridor.",
    questIds: ["river_access"],
    launchPriority: 84,
  },
  {
    id: "arabia-mountain-slab",
    title: "Arabia Mountain summit slab",
    spotSlug: "arabia-mountain",
    parentSpotSlug: null,
    relationshipKind: "parent_destination",
    destinationNodeType: "starter",
    summary: "Close-in granite drama with almost no explanation burden.",
    questIds: ["starter"],
    launchPriority: 97,
  },
  {
    id: "driftwood-beach",
    title: "Driftwood Beach sunrise corridor",
    spotSlug: "driftwood-beach",
    parentSpotSlug: null,
    relationshipKind: "standalone_spot",
    destinationNodeType: "starter",
    summary: "Coastal visual payoff that makes the starter quest feel statewide, not just metro.",
    questIds: ["starter"],
    launchPriority: 94,
  },
  {
    id: "red-top-sunset-point",
    title: "Red Top lakeside sunset point",
    spotSlug: "red-top-mountain-state-park",
    parentSpotSlug: null,
    relationshipKind: "parent_destination",
    destinationNodeType: "starter",
    summary: "Easy weekendable starter win with water and sunset energy.",
    questIds: ["starter"],
    launchPriority: 85,
  },
];

export function getYonderLaunchDestinationNodesForQuest(
  questId: YonderDestinationNodeQuestId,
): YonderLaunchDestinationNode[] {
  return YONDER_LAUNCH_DESTINATION_NODES
    .filter((destinationNode) => destinationNode.questIds.includes(questId))
    .sort((a, b) => b.launchPriority - a.launchPriority);
}
