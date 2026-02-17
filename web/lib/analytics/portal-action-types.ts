export const PORTAL_INTERACTION_ACTION_TYPES = [
  "mode_selected",
  "wayfinding_opened",
  "resource_clicked",
] as const;

export type PortalInteractionActionType = (typeof PORTAL_INTERACTION_ACTION_TYPES)[number];

export const HOSPITAL_MODE_VALUES = ["urgent", "treatment", "visitor", "staff"] as const;
