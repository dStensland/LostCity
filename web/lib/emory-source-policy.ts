export type EmorySourceRail = "emory_owned" | "atlanta_federated";
export type EmorySourceTier = "Tier 1" | "Tier 2";

export type EmorySourcePolicyItem = {
  id: string;
  name: string;
  rail: EmorySourceRail;
  tier: EmorySourceTier;
  class: "hospital" | "public" | "nonprofit" | "civic" | "partner";
  focus: string;
  url: string;
};

export const EMORY_COMPETITOR_EXCLUSIONS = ["piedmont"] as const;

export const EMORY_SOURCE_POLICY_ITEMS: EmorySourcePolicyItem[] = [
  {
    id: "emory-healthcare",
    name: "Emory Healthcare",
    rail: "emory_owned",
    tier: "Tier 1",
    class: "hospital",
    focus: "Hospital directory, service metadata, and official action endpoints",
    url: "https://www.emoryhealthcare.org/",
  },
  {
    id: "gozio",
    name: "Gozio",
    rail: "emory_owned",
    tier: "Tier 1",
    class: "partner",
    focus: "Wayfinding launch and entrance routing handoff",
    url: "https://www.goziohealth.com/",
  },
  {
    id: "cdc",
    name: "CDC",
    rail: "atlanta_federated",
    tier: "Tier 1",
    class: "public",
    focus: "Public health prevention and community guidance",
    url: "https://www.cdc.gov/",
  },
  {
    id: "ga-dph",
    name: "Georgia DPH",
    rail: "atlanta_federated",
    tier: "Tier 1",
    class: "public",
    focus: "State-level public health resources and services",
    url: "https://dph.georgia.gov/",
  },
  {
    id: "fulton-board-health",
    name: "Fulton County Board of Health",
    rail: "atlanta_federated",
    tier: "Tier 1",
    class: "public",
    focus: "Local clinic and outreach schedules",
    url: "https://fultoncountyboh.com/",
  },
  {
    id: "dekalb-public-health",
    name: "DeKalb Public Health",
    rail: "atlanta_federated",
    tier: "Tier 1",
    class: "public",
    focus: "County public health events and resources",
    url: "https://dekalbpublichealth.com/",
  },
  {
    id: "atl-food-bank",
    name: "Atlanta Community Food Bank",
    rail: "atlanta_federated",
    tier: "Tier 2",
    class: "nonprofit",
    focus: "Food support and pantry access",
    url: "https://www.acfb.org/find-food/",
  },
  {
    id: "open-hand",
    name: "Open Hand Atlanta",
    rail: "atlanta_federated",
    tier: "Tier 2",
    class: "nonprofit",
    focus: "Nutrition and meal support for families",
    url: "https://openhandatlanta.org/",
  },
  {
    id: "red-cross-ga",
    name: "American Red Cross of Georgia",
    rail: "atlanta_federated",
    tier: "Tier 2",
    class: "nonprofit",
    focus: "Blood drives and emergency support",
    url: "https://www.redcross.org/local/georgia.html",
  },
  {
    id: "atl-parks",
    name: "Atlanta Parks & Recreation",
    rail: "atlanta_federated",
    tier: "Tier 2",
    class: "civic",
    focus: "Community wellness and outdoor programming",
    url: "https://www.atlantaga.gov/government/departments/parks-recreation",
  },
  {
    id: "ymca-atl",
    name: "YMCA of Metro Atlanta",
    rail: "atlanta_federated",
    tier: "Tier 2",
    class: "nonprofit",
    focus: "Family wellness and movement classes",
    url: "https://www.ymcaatlanta.org/",
  },
];

export function getEmorySourcesByRail(rail: EmorySourceRail): EmorySourcePolicyItem[] {
  return EMORY_SOURCE_POLICY_ITEMS.filter((item) => item.rail === rail);
}

const SOURCE_POLICY_ALIASES: Record<string, string[]> = {
  "emory-healthcare": [
    "emory healthcare",
  ],
  gozio: [
    "gozio",
    "gozio health",
  ],
  cdc: [
    "cdc",
    "centers for disease control",
    "centers for disease control and prevention",
  ],
  "ga-dph": [
    "georgia dph",
    "georgia department of public health",
    "dph georgia",
    "georgia public health",
  ],
  "fulton-board-health": [
    "fulton county board of health",
    "fulton board of health",
    "fulton boh",
  ],
  "dekalb-public-health": [
    "dekalb public health",
    "dekalb county board of health",
  ],
  "atl-food-bank": [
    "atlanta community food bank",
    "acfb",
    "community food bank",
  ],
  "open-hand": [
    "open hand atlanta",
    "open hand",
  ],
  "red-cross-ga": [
    "american red cross of georgia",
    "american red cross",
    "red cross georgia",
    "red cross",
  ],
  "atl-parks": [
    "atlanta parks and recreation",
    "atlanta parks",
    "city of atlanta parks",
  ],
  "ymca-atl": [
    "ymca of metro atlanta",
    "ymca metro atlanta",
    "ymca atlanta",
  ],
};

function normalizePolicyText(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getMatchTerms(item: EmorySourcePolicyItem): string[] {
  const aliases = SOURCE_POLICY_ALIASES[item.id] || [];
  return [item.id, item.name, ...aliases]
    .map((term) => normalizePolicyText(term))
    .filter(Boolean);
}

export function resolveEmorySourcePolicy(args: {
  slug?: string | null;
  name?: string | null;
}): EmorySourcePolicyItem | null {
  const slug = normalizePolicyText(args.slug);
  const name = normalizePolicyText(args.name);
  if (!slug && !name) return null;

  // Prefer slug match first when available.
  for (const item of EMORY_SOURCE_POLICY_ITEMS) {
    const terms = getMatchTerms(item);
    if (slug && terms.some((term) => slug === term || slug.includes(term))) {
      return item;
    }
  }

  for (const item of EMORY_SOURCE_POLICY_ITEMS) {
    const terms = getMatchTerms(item);
    if (name && terms.some((term) => name === term || name.includes(term))) {
      return item;
    }
  }

  return null;
}

export function isAllowedEmoryFederatedSource(args: {
  slug?: string | null;
  name?: string | null;
}): boolean {
  const item = resolveEmorySourcePolicy(args);
  return Boolean(item && item.rail === "atlanta_federated");
}

export function isCompetitorExcluded(
  value: string | null | undefined,
  exclusions: readonly string[] = EMORY_COMPETITOR_EXCLUSIONS
): boolean {
  if (!value) return false;
  const normalized = value.toLowerCase();
  return exclusions.some((term) => normalized.includes(term.toLowerCase()));
}
