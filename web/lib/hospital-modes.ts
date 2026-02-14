export type HospitalAudienceMode = "urgent" | "treatment" | "visitor" | "staff";

export type HospitalModeConfig = {
  key: HospitalAudienceMode;
  label: string;
  shortLabel: string;
  description: string;
  heroHint: string;
  sectionOrder: Array<"services" | "late" | "food" | "stay" | "essentials">;
};

export const HOSPITAL_MODE_CONFIG: Record<HospitalAudienceMode, HospitalModeConfig> = {
  urgent: {
    key: "urgent",
    label: "Need Help Now",
    shortLabel: "Help Now",
    description: "Get calm, immediate guidance to wayfinding, contacts, and essential support.",
    heroHint: "Prioritizing immediate support, navigation, and after-hours essentials.",
    sectionOrder: ["services", "late", "essentials", "food", "stay"],
  },
  treatment: {
    key: "treatment",
    label: "Treatment Journey",
    shortLabel: "Treatment",
    description: "Designed for repeat visits, extended care timelines, and out-of-town coordination.",
    heroHint: "Prioritizing on-campus services, lodging, and dependable planning.",
    sectionOrder: ["services", "stay", "essentials", "food", "late"],
  },
  visitor: {
    key: "visitor",
    label: "Visiting Someone",
    shortLabel: "Visitor",
    description: "Confident visitor guidance for where to go, what is open, and what is nearby.",
    heroHint: "Prioritizing visitor logistics, comfort, and nearby essentials.",
    sectionOrder: ["services", "food", "essentials", "stay", "late"],
  },
  staff: {
    key: "staff",
    label: "Staff / Shift",
    shortLabel: "Staff",
    description: "Shift-friendly support with late-night options and fast operational routing.",
    heroHint: "Prioritizing speed, reliability, and quick essentials.",
    sectionOrder: ["late", "food", "essentials", "services", "stay"],
  },
};

export const HOSPITAL_MODE_LIST: HospitalModeConfig[] = [
  HOSPITAL_MODE_CONFIG.urgent,
  HOSPITAL_MODE_CONFIG.treatment,
  HOSPITAL_MODE_CONFIG.visitor,
  HOSPITAL_MODE_CONFIG.staff,
];

export const DEFAULT_HOSPITAL_MODE: HospitalAudienceMode = "visitor";

export function normalizeHospitalMode(value: string | null | undefined): HospitalAudienceMode {
  if (!value) return DEFAULT_HOSPITAL_MODE;
  const normalized = value.toLowerCase();
  if (normalized in HOSPITAL_MODE_CONFIG) {
    return normalized as HospitalAudienceMode;
  }
  return DEFAULT_HOSPITAL_MODE;
}
