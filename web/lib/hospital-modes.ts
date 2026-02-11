export type HospitalAudienceMode = "urgent" | "treatment" | "visitor" | "staff";

export type HospitalModeConfig = {
  key: HospitalAudienceMode;
  label: string;
  shortLabel: string;
  description: string;
  heroHint: string;
  sectionOrder: Array<"services" | "late" | "food" | "stay">;
};

export const HOSPITAL_MODE_CONFIG: Record<HospitalAudienceMode, HospitalModeConfig> = {
  urgent: {
    key: "urgent",
    label: "Need Help Now",
    shortLabel: "Help Now",
    description: "Fastest path to wayfinding, contacts, and immediate support resources.",
    heroHint: "Prioritizing immediate support, wayfinding, and late-hour essentials.",
    sectionOrder: ["services", "late", "food", "stay"],
  },
  treatment: {
    key: "treatment",
    label: "Treatment Journey",
    shortLabel: "Treatment",
    description: "Support for repeat visits, extended care timelines, and out-of-town logistics.",
    heroHint: "Prioritizing services, lodging, and reliable nearby planning.",
    sectionOrder: ["services", "stay", "food", "late"],
  },
  visitor: {
    key: "visitor",
    label: "Visiting Someone",
    shortLabel: "Visitor",
    description: "Clear guidance for visitors: where to go, what is open, and where to park/eat.",
    heroHint: "Prioritizing visitor logistics and nearby options.",
    sectionOrder: ["services", "food", "stay", "late"],
  },
  staff: {
    key: "staff",
    label: "Staff / Shift",
    shortLabel: "Staff",
    description: "Shift-friendly support with late-night options and quick operational paths.",
    heroHint: "Prioritizing late-night operations and quick essentials.",
    sectionOrder: ["late", "food", "services", "stay"],
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
