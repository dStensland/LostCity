import { DEFAULT_HOSPITAL_MODE, normalizeHospitalMode, type HospitalAudienceMode } from "@/lib/hospital-modes";

export type EmoryPersonaKey =
  | "visitor-caregiver"
  | "out-of-town-family"
  | "patient-logistics"
  | "staff-shift"
  | "community-health-seeker";

export type EmoryPersonaProfile = {
  key: EmoryPersonaKey;
  label: string;
  shortLabel: string;
  headline: string;
  summary: string;
  focusTitle: string;
  focusNarrative: string;
  defaultMode: HospitalAudienceMode;
  primaryActionLabel: string;
  secondaryActionLabel: string;
  tertiaryActionLabel: string;
  companionActionLabel: string;
  sourcePolicyNote: string;
};

export const EMORY_PERSONA_PROFILES: Record<EmoryPersonaKey, EmoryPersonaProfile> = {
  "visitor-caregiver": {
    key: "visitor-caregiver",
    label: "Visitor or Caregiver",
    shortLabel: "Visitor",
    headline: "Guidance for families and caregivers, without friction.",
    summary:
      "Navigate confidently to the right campus, then access practical food, stay, and support options nearby.",
    focusTitle: "Confident Visitor Support",
    focusNarrative: "Prioritizing visitor logistics, location clarity, and practical next actions.",
    defaultMode: "visitor",
    primaryActionLabel: "Start Visit",
    secondaryActionLabel: "Get Directions",
    tertiaryActionLabel: "View Services",
    companionActionLabel: "Open Visitor Guide",
    sourcePolicyNote: "Hospital navigation and practical community support only.",
  },
  "out-of-town-family": {
    key: "out-of-town-family",
    label: "Out-of-Town Family",
    shortLabel: "Out-of-Town",
    headline: "Multi-day support for families traveling for treatment.",
    summary:
      "Coordinate the right campus with nearby lodging, food, and open-late essentials built for longer stays.",
    focusTitle: "Treatment-Adjacent Logistics",
    focusNarrative: "Prioritizing lodging, dependable services, and repeat-visit utility.",
    defaultMode: "treatment",
    primaryActionLabel: "Plan Stay",
    secondaryActionLabel: "Get Directions",
    tertiaryActionLabel: "View Services",
    companionActionLabel: "Open Stay Guide",
    sourcePolicyNote: "Travel, stay, and daily logistics support for longer care journeys.",
  },
  "patient-logistics": {
    key: "patient-logistics",
    label: "Patient Logistics",
    shortLabel: "Patient",
    headline: "Practical, non-clinical support around care journeys.",
    summary:
      "Find entrances, parking, pharmacy, and support resources quickly, with direct handoff to official systems.",
    focusTitle: "Non-Clinical Care Logistics",
    focusNarrative: "Prioritizing on-site services, reliable routes, and official-system handoff points.",
    defaultMode: "treatment",
    primaryActionLabel: "Plan Arrival",
    secondaryActionLabel: "Get Directions",
    tertiaryActionLabel: "View Services",
    companionActionLabel: "Open Patient Guide",
    sourcePolicyNote: "Non-clinical logistics support. Medical decisions stay with your care team.",
  },
  "staff-shift": {
    key: "staff-shift",
    label: "Staff or Shift Worker",
    shortLabel: "Staff",
    headline: "Shift-ready utility for fast real-world decisions.",
    summary:
      "Get fast wayfinding, open-now options, and late-hour essentials without extra clicks.",
    focusTitle: "Operational Shift Support",
    focusNarrative: "Prioritizing speed, open-now relevance, and late-hour reliability.",
    defaultMode: "staff",
    primaryActionLabel: "Start Shift Route",
    secondaryActionLabel: "Get Directions",
    tertiaryActionLabel: "View Essentials",
    companionActionLabel: "Open Shift Guide",
    sourcePolicyNote: "Shift logistics support focused on speed and reliability.",
  },
  "community-health-seeker": {
    key: "community-health-seeker",
    label: "Community Health Seeker",
    shortLabel: "Community",
    headline: "Public-health and wellness support around Emory campuses.",
    summary:
      "Explore prevention, food-access, and community wellness resources from public and nonprofit programs.",
    focusTitle: "Community Resource Discovery",
    focusNarrative: "Prioritizing prevention, wellness, and family resource access across Atlanta.",
    defaultMode: "visitor",
    primaryActionLabel: "Explore Community Health",
    secondaryActionLabel: "Get Directions",
    tertiaryActionLabel: "View Resources",
    companionActionLabel: "Open Community Guide",
    sourcePolicyNote: "Community programs and household support around Emory campuses.",
  },
};

export const EMORY_PERSONA_LIST: EmoryPersonaProfile[] = [
  EMORY_PERSONA_PROFILES["visitor-caregiver"],
  EMORY_PERSONA_PROFILES["out-of-town-family"],
  EMORY_PERSONA_PROFILES["patient-logistics"],
  EMORY_PERSONA_PROFILES["staff-shift"],
  EMORY_PERSONA_PROFILES["community-health-seeker"],
];

export const DEFAULT_EMORY_PERSONA: EmoryPersonaKey = "visitor-caregiver";

export function normalizeEmoryPersona(value: string | null | undefined): EmoryPersonaKey {
  if (!value) return DEFAULT_EMORY_PERSONA;
  const normalized = value.toLowerCase();
  if (normalized in EMORY_PERSONA_PROFILES) {
    return normalized as EmoryPersonaKey;
  }
  return DEFAULT_EMORY_PERSONA;
}

export function getEmoryPersonaProfile(key: EmoryPersonaKey): EmoryPersonaProfile {
  return EMORY_PERSONA_PROFILES[key];
}

export function resolveHospitalModeForPersona(args: {
  persona: EmoryPersonaKey;
  modeParam?: string | null;
}): HospitalAudienceMode {
  const { persona, modeParam } = args;
  if (!modeParam) {
    return EMORY_PERSONA_PROFILES[persona]?.defaultMode || DEFAULT_HOSPITAL_MODE;
  }
  return normalizeHospitalMode(modeParam);
}
