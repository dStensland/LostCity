export type CivicIntent = "volunteer" | "meeting" | "action" | "event";

const MEETING_TAGS = new Set([
  "government", "school-board", "zoning", "public-meeting",
  "board-meeting", "city-council", "commission", "hearing",
]);

const ACTION_TAGS = new Set([
  "advocacy", "rally", "canvassing", "organizing",
  "civic-engagement", "protest", "march",
]);

const VOLUNTEER_TAGS = new Set([
  "volunteer", "volunteer-opportunity", "drop-in", "service",
]);

export const INTENT_CONFIG = {
  volunteer: { label: "Volunteer", color: "emerald" },
  meeting: { label: "Meeting", color: "sky" },
  action: { label: "Action", color: "amber" },
  event: { label: "Event", color: "zinc" },
} as const;

/**
 * Infer civic intent from event tags.
 * Priority: meeting > action > volunteer (meetings are time-sensitive).
 */
export function inferCivicIntent(tags: string[]): CivicIntent {
  let hasVolunteer = false;
  let hasAction = false;
  let hasMeeting = false;

  for (const tag of tags) {
    if (MEETING_TAGS.has(tag)) hasMeeting = true;
    if (ACTION_TAGS.has(tag)) hasAction = true;
    if (VOLUNTEER_TAGS.has(tag)) hasVolunteer = true;
  }

  if (hasMeeting) return "meeting";
  if (hasAction) return "action";
  if (hasVolunteer) return "volunteer";
  return "event";
}
