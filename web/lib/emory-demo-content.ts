import type { HospitalAudienceMode } from "@/lib/hospital-modes";

export type EmoryFederatedSource = {
  id: string;
  name: string;
  type: "hospital" | "public" | "nonprofit" | "civic" | "partner";
  focus: string;
  cadence: string;
  trustTier: "Tier 1" | "Tier 2";
  url: string;
};

export type EmoryFederatedBriefing = {
  id: string;
  title: string;
  summary: string;
  sourceLabel: string;
  sourceUrl: string;
  searchQuery: string;
  chips: string[];
};

export const EMORY_EXCLUSION_POLICY = "Competitor health-system sources excluded (including Piedmont).";

export const EMORY_FEDERATED_SOURCES: EmoryFederatedSource[] = [
  {
    id: "emory-healthcare",
    name: "Emory Healthcare",
    type: "hospital",
    focus: "Hospital operations, services, and patient logistics",
    cadence: "Daily sync",
    trustTier: "Tier 1",
    url: "https://www.emoryhealthcare.org/",
  },
  {
    id: "gozio",
    name: "Gozio Health",
    type: "partner",
    focus: "Wayfinding and navigation launch points",
    cadence: "Real-time handoff",
    trustTier: "Tier 1",
    url: "https://www.goziohealth.com/",
  },
  {
    id: "cdc",
    name: "CDC",
    type: "public",
    focus: "Prevention guidance, screening programs, and alerts",
    cadence: "Daily",
    trustTier: "Tier 1",
    url: "https://www.cdc.gov/",
  },
  {
    id: "ga-dph",
    name: "Georgia DPH",
    type: "public",
    focus: "State public-health calendars and low-cost services",
    cadence: "Daily",
    trustTier: "Tier 1",
    url: "https://dph.georgia.gov/",
  },
  {
    id: "fulton-board-health",
    name: "Fulton County Board of Health",
    type: "public",
    focus: "County clinics, immunization events, and outreach",
    cadence: "Daily",
    trustTier: "Tier 1",
    url: "https://fultoncountyboh.com/",
  },
  {
    id: "atl-food-bank",
    name: "Atlanta Community Food Bank",
    type: "nonprofit",
    focus: "Food pantry network, distributions, and family support",
    cadence: "Daily",
    trustTier: "Tier 2",
    url: "https://www.acfb.org/",
  },
  {
    id: "open-hand",
    name: "Open Hand Atlanta",
    type: "nonprofit",
    focus: "Nutrition support and medically-tailored meals",
    cadence: "Weekly",
    trustTier: "Tier 2",
    url: "https://openhandatlanta.org/",
  },
  {
    id: "red-cross-ga",
    name: "American Red Cross of Georgia",
    type: "nonprofit",
    focus: "Blood drives and emergency preparedness resources",
    cadence: "Weekly",
    trustTier: "Tier 2",
    url: "https://www.redcross.org/local/georgia.html",
  },
  {
    id: "atl-parks",
    name: "Atlanta Parks and Recreation",
    type: "civic",
    focus: "Outdoor classes, walks, and community wellness activity",
    cadence: "Weekly",
    trustTier: "Tier 2",
    url: "https://www.atlantaga.gov/government/departments/parks-recreation",
  },
];

const BRIEFINGS_BY_MODE: Record<HospitalAudienceMode, EmoryFederatedBriefing[]> = {
  urgent: [
    {
      id: "urgent-screening",
      title: "Same-day screening and community clinic options",
      summary: "Use county and state public-health calendars to route non-ED screening needs quickly.",
      sourceLabel: "Fulton County Board of Health + Georgia DPH",
      sourceUrl: "https://fultoncountyboh.com/",
      searchQuery: "fulton county clinic screening immunization",
      chips: ["Screenings", "Rapid Access", "Public Health"],
    },
    {
      id: "urgent-food",
      title: "Immediate food support for families in treatment",
      summary: "Surface nearby pantry and meal resources with same-week availability.",
      sourceLabel: "Atlanta Community Food Bank",
      sourceUrl: "https://www.acfb.org/find-food/",
      searchQuery: "atlanta food pantry family support",
      chips: ["Food Access", "Family", "Low Cost"],
    },
    {
      id: "urgent-wayfinding",
      title: "Fast entrance and drop-off routing",
      summary: "Launch Gozio handoff first, then branch into support tracks after arrival is resolved.",
      sourceLabel: "Gozio + Emory campus metadata",
      sourceUrl: "https://www.goziohealth.com/",
      searchQuery: "emory wayfinding visitor entrance",
      chips: ["Wayfinding", "Arrival", "Critical Path"],
    },
  ],
  treatment: [
    {
      id: "treatment-nutrition",
      title: "Nutrition and recurring-care meal support",
      summary: "Coordinate meal assistance and nutrition programs for multi-week care journeys.",
      sourceLabel: "Open Hand Atlanta + Atlanta Community Food Bank",
      sourceUrl: "https://openhandatlanta.org/",
      searchQuery: "medically tailored meals atlanta support",
      chips: ["Nutrition", "Recurring Care", "Family Support"],
    },
    {
      id: "treatment-prevention",
      title: "Prevention and follow-up education tracks",
      summary: "Pair treatment journeys with trusted prevention guidance and community education events.",
      sourceLabel: "CDC + Georgia DPH",
      sourceUrl: "https://www.cdc.gov/",
      searchQuery: "public health prevention education atlanta",
      chips: ["Prevention", "Education", "Trusted Guidance"],
    },
    {
      id: "treatment-recovery",
      title: "Low-intensity wellness and recovery movement",
      summary: "Highlight non-commercial outdoor options that support mental and physical recovery.",
      sourceLabel: "Atlanta Parks and Recreation",
      sourceUrl: "https://www.atlantaga.gov/government/departments/parks-recreation",
      searchQuery: "atlanta parks gentle fitness wellness class",
      chips: ["Movement", "Mental Wellness", "Non-Commercial"],
    },
  ],
  visitor: [
    {
      id: "visitor-prevention",
      title: "CDC and Georgia DPH prevention calendar",
      summary: "Show nearby screening, education, and prevention opportunities for families and caregivers.",
      sourceLabel: "CDC + Georgia DPH",
      sourceUrl: "https://dph.georgia.gov/",
      searchQuery: "atlanta prevention screening health event",
      chips: ["Prevention", "Visitor", "Public Health"],
    },
    {
      id: "visitor-food",
      title: "Family food support and pantry network",
      summary: "Route visitors to practical food support resources around care schedules.",
      sourceLabel: "Atlanta Community Food Bank + Open Hand Atlanta",
      sourceUrl: "https://www.acfb.org/find-food/",
      searchQuery: "atlanta food support pantry family",
      chips: ["Food Access", "Family Support", "Low Cost"],
    },
    {
      id: "visitor-wellness",
      title: "Outdoor and community wellness programming",
      summary: "Highlight low-friction walks, yoga, and movement options tied to mental wellness.",
      sourceLabel: "Atlanta Parks and Recreation + YMCA Metro Atlanta",
      sourceUrl: "https://www.ymcaatlanta.org/",
      searchQuery: "atlanta community wellness outdoor yoga park",
      chips: ["Community Wellness", "Outdoor", "Mental Health"],
    },
  ],
  staff: [
    {
      id: "staff-late-support",
      title: "Late-shift essentials and resilient support options",
      summary: "Prioritize open-now food and support resources that align to shift realities.",
      sourceLabel: "Emory ops data + civic resource partners",
      sourceUrl: "https://www.emoryhealthcare.org/",
      searchQuery: "late night food support hospital staff atlanta",
      chips: ["Late Shift", "Open Now", "Operational"],
    },
    {
      id: "staff-blood",
      title: "Blood-drive and emergency readiness alignment",
      summary: "Map blood drive opportunities and readiness information for staff communities.",
      sourceLabel: "American Red Cross of Georgia",
      sourceUrl: "https://www.redcross.org/local/georgia.html",
      searchQuery: "atlanta blood drive community health",
      chips: ["Blood Drives", "Preparedness", "Community"],
    },
    {
      id: "staff-wellness",
      title: "Decompression and movement sessions near campus",
      summary: "Offer non-commercial wellness sessions for burnout mitigation and recovery.",
      sourceLabel: "Atlanta Parks and Recreation",
      sourceUrl: "https://www.atlantaga.gov/government/departments/parks-recreation",
      searchQuery: "atlanta park wellness class stress relief",
      chips: ["Recovery", "Movement", "Mental Wellness"],
    },
  ],
};

export function getEmoryBriefings(mode: HospitalAudienceMode): EmoryFederatedBriefing[] {
  return BRIEFINGS_BY_MODE[mode];
}
