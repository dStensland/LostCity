import {
  getSourcesByTrack,
  getSupportPolicyCounts,
  getTrustedPartnerOrgs,
  type SupportSourcePolicyItem,
  type SupportTrackKey,
} from "@/lib/support-source-policy";

export type HelpAtlSupportSectionDefinition = {
  key: string;
  title: string;
  description: string;
  trackKeys: SupportTrackKey[];
};

export type HelpAtlSupportSection = HelpAtlSupportSectionDefinition & {
  organizations: SupportSourcePolicyItem[];
  organizationCount: number;
};

export const HELPATL_SUPPORT_SECTION_DEFINITIONS: HelpAtlSupportSectionDefinition[] = [
  {
    key: "urgent-help",
    title: "Urgent Help & Crisis Support",
    description: "Crisis lines, safety planning, recovery support, and mental health organizations.",
    trackKeys: ["crisis_safety", "mental_health", "substance_recovery"],
  },
  {
    key: "food-housing-rights",
    title: "Food, Housing & Legal Help",
    description: "Food support, shelter pathways, legal aid, and immediate stabilization resources.",
    trackKeys: ["food_support", "housing_homelessness", "legal_aid", "financial_assistance"],
  },
  {
    key: "family-newcomers",
    title: "Family, Youth & Newcomer Support",
    description: "Programs for families, children, immigrants, refugees, and adult learning.",
    trackKeys: ["pediatric_family", "pediatric_health", "womens_health", "immigrant_refugee", "adult_education"],
  },
  {
    key: "health-wellness",
    title: "Health & Public Health",
    description: "Public health, care access, wellness, dental and vision support, and chronic disease resources.",
    trackKeys: ["public_health", "community_wellness", "dental_vision", "chronic_disease", "patient_financial"],
  },
  {
    key: "work-daily-life",
    title: "Work, Money & Daily Life",
    description: "Employment, transportation, literacy, and practical support for day-to-day stability.",
    trackKeys: ["employment_workforce", "transportation", "financial_assistance", "adult_education"],
  },
  {
    key: "long-term-care",
    title: "Disability, Aging & Long-Term Support",
    description: "Disability services, senior support, veteran resources, and specialized care communities.",
    trackKeys: ["disability_services", "senior_services", "veterans", "neurological", "sensory", "transplant"],
  },
];

function dedupeOrganizations(trackKeys: readonly SupportTrackKey[]): SupportSourcePolicyItem[] {
  const unique = new Map<string, SupportSourcePolicyItem>();

  for (const trackKey of trackKeys) {
    for (const organization of getSourcesByTrack(trackKey)) {
      const identity = `${organization.name.trim().toLowerCase()}|${organization.url
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\/(www\.)?/, "")
        .replace(/\/+$/, "")}`;
      if (!unique.has(identity)) {
        unique.set(identity, organization);
      }
    }
  }

  return Array.from(unique.values()).sort((left, right) => left.name.localeCompare(right.name));
}

export function getHelpAtlSupportDirectorySections(): HelpAtlSupportSection[] {
  return HELPATL_SUPPORT_SECTION_DEFINITIONS.map((section) => {
    const organizations = dedupeOrganizations(section.trackKeys);
    return {
      ...section,
      organizations,
      organizationCount: organizations.length,
    };
  });
}

export function getHelpAtlSupportDirectoryStats() {
  const counts = getSupportPolicyCounts();

  return {
    totalOrganizations: counts.totalOrganizations,
    totalTracks: counts.totalTracks,
    totalSections: HELPATL_SUPPORT_SECTION_DEFINITIONS.length,
  };
}

export function getHelpAtlTrustedPartners(limit = 9): SupportSourcePolicyItem[] {
  return getTrustedPartnerOrgs(limit);
}
