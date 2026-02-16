import { EMORY_COMPETITOR_EXCLUSIONS } from "@/lib/emory-source-policy";
import type { EmoryCommunityCategory } from "@/lib/emory-community-categories";

export type CommunityTrackKey = "prevention" | "food_support" | "community_wellness";

export type HospitalSourceGovernanceProfile = {
  id: string;
  label: string;
  portalSlugs: string[];
  competitorExclusions: readonly string[];
  minStoryScore: number;
  trackSourcePolicyIds: Record<CommunityTrackKey, string[]>;
  categorySourceOverrides?: Partial<Record<EmoryCommunityCategory, string[]>>;
};

const EMORY_GOVERNANCE_PROFILE: HospitalSourceGovernanceProfile = {
  id: "emory-community-v1",
  label: "Emory Community Governance",
  portalSlugs: ["emory", "emory-demo", "emory-test"],
  competitorExclusions: EMORY_COMPETITOR_EXCLUSIONS,
  minStoryScore: 2.3,
  trackSourcePolicyIds: {
    prevention: [
      "cdc",
      "ga-dph",
      "fulton-board-health",
      "dekalb-public-health",
      "aid-atlanta",
      "grady-health",
      "nami-georgia",
      "mha-georgia",
      "dekalb-library",
      "alzheimers-association-georgia",
      "good-samaritan-health",
      "empowerline",
    ],
    food_support: [
      "atl-food-bank",
      "open-hand",
      "red-cross-ga",
      "food-well-alliance",
      "georgia-organics",
      "giving-kitchen",
      "united-way-atlanta",
      "meals-on-wheels-atlanta",
      "community-farmers-markets",
    ],
    community_wellness: [
      "atl-parks",
      "ymca-atl",
      "dekalb-public-health",
      "beltline-fitness",
      "park-pride",
      "hands-on-atlanta",
      "nami-georgia",
      "mha-georgia",
      "medshare",
      "empowerline",
    ],
  },
};

const DEFAULT_GOVERNANCE_PROFILE: HospitalSourceGovernanceProfile = {
  id: "hospital-default-v1",
  label: "Hospital Default Governance",
  portalSlugs: [],
  competitorExclusions: ["piedmont"],
  minStoryScore: 2.3,
  trackSourcePolicyIds: {
    prevention: [...EMORY_GOVERNANCE_PROFILE.trackSourcePolicyIds.prevention],
    food_support: [...EMORY_GOVERNANCE_PROFILE.trackSourcePolicyIds.food_support],
    community_wellness: [...EMORY_GOVERNANCE_PROFILE.trackSourcePolicyIds.community_wellness],
  },
};

const GOVERNANCE_PROFILES: HospitalSourceGovernanceProfile[] = [
  EMORY_GOVERNANCE_PROFILE,
];

export function getHospitalSourceGovernanceProfile(portalSlug: string): HospitalSourceGovernanceProfile {
  const normalizedSlug = portalSlug.toLowerCase().trim();
  return (
    GOVERNANCE_PROFILES.find((profile) =>
      profile.portalSlugs.some((slug) => slug.toLowerCase() === normalizedSlug)
    ) || DEFAULT_GOVERNANCE_PROFILE
  );
}
