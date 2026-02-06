import type {
  TagEntityType,
  VenueTagGroup,
  EventTagGroup,
  OrgTagGroup,
} from "./types";

export const VENUE_TAG_GROUPS: Record<VenueTagGroup, { label: string; color: string }> = {
  vibes: { label: "Vibes", color: "var(--neon-cyan)" },
  amenities: { label: "Amenities", color: "var(--sage)" },
  good_for: { label: "Good For", color: "var(--coral)" },
  accessibility: { label: "Accessibility", color: "var(--lavender)" },
  heads_up: { label: "Heads Up", color: "var(--gold)" },
};

export const EVENT_TAG_GROUPS: Record<EventTagGroup, { label: string; color: string }> = {
  audience: { label: "Audience", color: "var(--lavender)" },
  social: { label: "Social", color: "var(--coral)" },
  vibe: { label: "Vibe", color: "var(--neon-cyan)" },
  format: { label: "Format", color: "var(--sage)" },
  practical: { label: "Practical", color: "var(--twilight)" },
  heads_up: { label: "Heads Up", color: "var(--gold)" },
};

export const ORG_TAG_GROUPS: Record<OrgTagGroup, { label: string; color: string }> = {
  values: { label: "Values", color: "var(--lavender)" },
  structure: { label: "Structure", color: "var(--sage)" },
  engagement: { label: "Engagement", color: "var(--coral)" },
  heads_up: { label: "Heads Up", color: "var(--gold)" },
};

export function getTagGroupsForEntity(
  entityType: TagEntityType
): Record<string, { label: string; color: string }> {
  switch (entityType) {
    case "venue":
      return VENUE_TAG_GROUPS;
    case "event":
      return EVENT_TAG_GROUPS;
    case "org":
      return ORG_TAG_GROUPS;
    default:
      return VENUE_TAG_GROUPS;
  }
}

// Legacy alias for backwards compatibility
export const TAG_CATEGORIES = VENUE_TAG_GROUPS;
