import { addDays } from "date-fns";
import type { HospitalAudienceMode } from "@/lib/hospital-modes";
import type { SupportTrackKey } from "@/lib/support-source-policy";
import { getSourcesByTrack } from "@/lib/support-source-policy";
import { getHospitalProfile } from "@/lib/emory-hospital-profiles";

export type EmoryCommunityCategory =
  | "stay_well"
  | "food_nutrition"
  | "support_groups"
  | "family_children"
  | "life_essentials"
  | "recovery_healing"
  | "specialized_care";

export type CategorySensitivity = "public" | "opt_in";

export type FallbackStory = {
  title: string;
  sourceName: string;
  neighborhood: string | null;
  startDate: string;
  startTime: string | null;
};

export type CommunityCategoryDefinition = {
  key: EmoryCommunityCategory;
  title: string;
  blurb: string;
  iconName: string;
  sensitivity: CategorySensitivity;
  trackKeys: SupportTrackKey[];
  highlightOrgIds: string[];
  storyKeywordHints: string[];
  fallbackStories: FallbackStory[];
};

export const COMMUNITY_CATEGORIES: CommunityCategoryDefinition[] = [
  {
    key: "stay_well",
    title: "Stay Well",
    blurb: "Preventive care, fitness, and community wellness programs.",
    iconName: "Heart",
    sensitivity: "public",
    trackKeys: ["public_health", "community_wellness"],
    highlightOrgIds: ["ymca-atlanta", "good-samaritan-health-center", "beltline-fitness"],
    storyKeywordHints: [
      "clinic",
      "screening",
      "immunization",
      "vaccin",
      "prevention",
      "health fair",
      "wellness",
      "movement",
      "walk",
      "yoga",
      "fitness",
      "volunteer",
    ],
    fallbackStories: [
      {
        title: "Community health screening and vaccination clinic",
        sourceName: "DeKalb Public Health",
        neighborhood: "Decatur",
        startDate: addDays(new Date(), 4).toISOString().slice(0, 10),
        startTime: "10:00",
      },
      {
        title: "Neighborhood wellness walk",
        sourceName: "Atlanta BeltLine Fitness",
        neighborhood: "Old Fourth Ward",
        startDate: addDays(new Date(), 6).toISOString().slice(0, 10),
        startTime: "18:00",
      },
    ],
  },
  {
    key: "food_nutrition",
    title: "Food & Nutrition",
    blurb: "Food pantries, nutrition classes, and farmers markets nearby.",
    iconName: "Carrot",
    sensitivity: "public",
    trackKeys: ["food_support"],
    highlightOrgIds: ["atlanta-community-food-bank", "open-hand-atlanta", "community-farmers-markets"],
    storyKeywordHints: [
      "food",
      "meal",
      "nutrition",
      "pantry",
      "produce",
      "grocer",
      "distribution",
      "market",
      "kitchen",
      "farm",
    ],
    fallbackStories: [
      {
        title: "Mobile pantry distribution near Emory",
        sourceName: "Atlanta Community Food Bank",
        neighborhood: "Druid Hills",
        startDate: addDays(new Date(), 3).toISOString().slice(0, 10),
        startTime: "09:30",
      },
      {
        title: "Nutrition support intake",
        sourceName: "Open Hand Atlanta",
        neighborhood: "Midtown",
        startDate: addDays(new Date(), 5).toISOString().slice(0, 10),
        startTime: "11:00",
      },
    ],
  },
  {
    key: "support_groups",
    title: "Support Groups",
    blurb: "Peer support, counseling, and disease-specific communities.",
    iconName: "UsersThree",
    sensitivity: "public",
    trackKeys: [
      "mental_health",
      "chronic_disease",
      "neurological",
      "cancer_support",
      "autoimmune",
      "disability_services",
      "veterans",
      "senior_services",
    ],
    highlightOrgIds: ["nami-georgia", "cancer-support-community-atlanta", "shepherd-center"],
    storyKeywordHints: [
      "support group",
      "peer",
      "counseling",
      "caregiver",
      "grief",
      "depression",
      "bipolar",
      "awareness",
      "walk",
      "education",
    ],
    fallbackStories: [
      {
        title: "Mental health peer support circle",
        sourceName: "NAMI Georgia",
        neighborhood: "Midtown",
        startDate: addDays(new Date(), 5).toISOString().slice(0, 10),
        startTime: "19:00",
      },
      {
        title: "Cancer survivor support group",
        sourceName: "Cancer Support Community Atlanta",
        neighborhood: "Buckhead",
        startDate: addDays(new Date(), 7).toISOString().slice(0, 10),
        startTime: "14:00",
      },
    ],
  },
  {
    key: "family_children",
    title: "Family & Children",
    blurb: "Programs for parents, kids, and maternal health.",
    iconName: "Baby",
    sensitivity: "public",
    trackKeys: ["pediatric_family", "pediatric_health", "womens_health"],
    highlightOrgIds: ["choa-community-events", "healthy-mothers-ga", "camp-twin-lakes"],
    storyKeywordHints: [
      "family",
      "child",
      "pediatric",
      "parent",
      "maternal",
      "prenatal",
      "postpartum",
      "camp",
      "youth",
      "baby",
    ],
    fallbackStories: [
      {
        title: "Family wellness workshop",
        sourceName: "Children's Healthcare of Atlanta",
        neighborhood: "Brookhaven",
        startDate: addDays(new Date(), 4).toISOString().slice(0, 10),
        startTime: "10:00",
      },
      {
        title: "Prenatal support group",
        sourceName: "Healthy Mothers Healthy Babies Coalition of Georgia",
        neighborhood: "Downtown",
        startDate: addDays(new Date(), 6).toISOString().slice(0, 10),
        startTime: "13:00",
      },
    ],
  },
  {
    key: "life_essentials",
    title: "Life Essentials",
    blurb: "Housing, jobs, legal aid, and financial assistance.",
    iconName: "Lifebuoy",
    sensitivity: "public",
    trackKeys: [
      "housing_homelessness",
      "financial_assistance",
      "legal_aid",
      "employment_workforce",
      "transportation",
      "dental_vision",
      "immigrant_refugee",
      "adult_education",
      "patient_financial",
    ],
    highlightOrgIds: ["atlanta-legal-aid", "worksource-atlanta", "irc-atlanta"],
    storyKeywordHints: [
      "housing",
      "job",
      "employment",
      "legal",
      "financial",
      "rent",
      "utility",
      "dental",
      "vision",
      "transport",
      "refugee",
      "literacy",
      "ged",
    ],
    fallbackStories: [
      {
        title: "Know Your Rights legal aid clinic",
        sourceName: "Atlanta Legal Aid Society",
        neighborhood: "Downtown",
        startDate: addDays(new Date(), 5).toISOString().slice(0, 10),
        startTime: "10:00",
      },
      {
        title: "Career workshop and job fair",
        sourceName: "WorkSource Atlanta",
        neighborhood: "West End",
        startDate: addDays(new Date(), 7).toISOString().slice(0, 10),
        startTime: "09:00",
      },
    ],
  },
  {
    key: "recovery_healing",
    title: "Recovery & Healing",
    blurb: "Substance recovery, crisis support, and safety planning.",
    iconName: "ShieldCheck",
    sensitivity: "opt_in",
    trackKeys: ["substance_recovery", "crisis_safety"],
    highlightOrgIds: ["ga-council-recovery", "ga-harm-reduction", "padv"],
    storyKeywordHints: [
      "recovery",
      "addiction",
      "substance",
      "aa",
      "na",
      "crisis",
      "safety",
      "domestic violence",
      "suicide prevention",
      "harm reduction",
    ],
    fallbackStories: [
      {
        title: "Recovery support meeting",
        sourceName: "Georgia Council on Substance Abuse",
        neighborhood: "Midtown",
        startDate: addDays(new Date(), 3).toISOString().slice(0, 10),
        startTime: "18:00",
      },
      {
        title: "Crisis safety planning workshop",
        sourceName: "Partnership Against Domestic Violence",
        neighborhood: "Decatur",
        startDate: addDays(new Date(), 6).toISOString().slice(0, 10),
        startTime: "14:00",
      },
    ],
  },
  {
    key: "specialized_care",
    title: "Specialized Care",
    blurb: "Respiratory, musculoskeletal, blood, sensory, and transplant resources.",
    iconName: "Stethoscope",
    sensitivity: "public",
    trackKeys: [
      "respiratory",
      "musculoskeletal",
      "blood_disorders",
      "sensory",
      "transplant",
      "hospital_community",
    ],
    highlightOrgIds: ["piedmont-healthcare", "georgia-transplant-foundation", "american-lung-georgia"],
    storyKeywordHints: [
      "respiratory",
      "lung",
      "muscular",
      "marfan",
      "hemophilia",
      "vision",
      "hearing",
      "deaf",
      "transplant",
      "hospital",
      "piedmont",
      "wellstar",
    ],
    fallbackStories: [
      {
        title: "Lung health screening event",
        sourceName: "American Lung Association Georgia",
        neighborhood: "Midtown",
        startDate: addDays(new Date(), 5).toISOString().slice(0, 10),
        startTime: "10:00",
      },
      {
        title: "Transplant support group",
        sourceName: "Georgia Transplant Foundation",
        neighborhood: "Atlanta",
        startDate: addDays(new Date(), 8).toISOString().slice(0, 10),
        startTime: "13:00",
      },
    ],
  },
];

const MODE_CATEGORY_PRIORITY: Record<HospitalAudienceMode, EmoryCommunityCategory[]> = {
  urgent: [
    "life_essentials",
    "food_nutrition",
    "recovery_healing",
    "support_groups",
    "family_children",
    "stay_well",
    "specialized_care",
  ],
  treatment: [
    "support_groups",
    "food_nutrition",
    "family_children",
    "stay_well",
    "life_essentials",
    "specialized_care",
    "recovery_healing",
  ],
  visitor: [
    "stay_well",
    "food_nutrition",
    "support_groups",
    "family_children",
    "life_essentials",
    "specialized_care",
    "recovery_healing",
  ],
  staff: [
    "stay_well",
    "food_nutrition",
    "support_groups",
    "family_children",
    "life_essentials",
    "specialized_care",
    "recovery_healing",
  ],
};

export { MODE_CATEGORY_PRIORITY };

export function getOrderedCategories(
  mode: HospitalAudienceMode,
  includeSensitive: boolean,
  hospitalSlug?: string | null
): CommunityCategoryDefinition[] {
  const preferredOrder = MODE_CATEGORY_PRIORITY[mode] || MODE_CATEGORY_PRIORITY.visitor;
  const categoryByKey = new Map(COMMUNITY_CATEGORIES.map((cat) => [cat.key, cat] as const));
  const totalCategories = preferredOrder.length;
  const profile = hospitalSlug ? getHospitalProfile(hospitalSlug) : null;

  const scored = preferredOrder
    .map((key, index) => {
      const cat = categoryByKey.get(key);
      if (!cat) return null;
      const baseScore = totalCategories - index;
      const boost = profile?.categoryBoosts[key] ?? 0;
      return { cat, score: baseScore + boost };
    })
    .filter((entry): entry is { cat: CommunityCategoryDefinition; score: number } => entry !== null);

  scored.sort((a, b) => b.score - a.score);

  const ordered = scored.map((entry) => entry.cat);

  if (!includeSensitive) {
    return ordered.filter((cat) => cat.sensitivity === "public");
  }

  return ordered;
}

export function getCategorySourcePolicyIds(cat: CommunityCategoryDefinition): string[] {
  const policyIds = new Set<string>();

  for (const trackKey of cat.trackKeys) {
    const sources = getSourcesByTrack(trackKey);
    for (const source of sources) {
      policyIds.add(source.id);
    }
  }

  return Array.from(policyIds);
}

export function getCategoryForTrack(trackKey: SupportTrackKey): EmoryCommunityCategory | null {
  for (const category of COMMUNITY_CATEGORIES) {
    if (category.trackKeys.includes(trackKey)) {
      return category.key;
    }
  }
  return null;
}
