export const PUBLIC_EVENT_CATEGORY_OPTIONS = [
  // Performance & Entertainment
  { id: "music", label: "Music" },
  { id: "film", label: "Film" },
  { id: "comedy", label: "Comedy" },
  { id: "theater", label: "Theater" },
  { id: "art", label: "Art" },
  { id: "dance", label: "Dance" },
  // Active & Outdoors
  { id: "sports", label: "Sports" },
  { id: "fitness", label: "Fitness" },
  { id: "outdoors", label: "Outdoors" },
  { id: "games", label: "Games" },
  // Food & Social
  { id: "food_drink", label: "Food & Drink" },
  { id: "conventions", label: "Conventions" },
  // Learning & Making
  { id: "workshops", label: "Workshops" },
  { id: "education", label: "Education" },
  { id: "words", label: "Words" },
  // Civic & Service
  { id: "volunteer", label: "Volunteer" },
  { id: "civic", label: "Civic" },
  { id: "support", label: "Support" },
  { id: "religious", label: "Religious" },
] as const;

export const PORTAL_EVENT_CATEGORY_OPTIONS = PUBLIC_EVENT_CATEGORY_OPTIONS;

export const SUBMISSION_EVENT_CATEGORY_OPTIONS = [
  ...PUBLIC_EVENT_CATEGORY_OPTIONS,
  { id: "other", label: "Other" },
] as const;

export const ADMIN_EVENT_CATEGORY_OPTIONS = [
  ...PUBLIC_EVENT_CATEGORY_OPTIONS,
  { id: "other", label: "Other" },
] as const;

export type PublicEventCategoryId =
  (typeof PUBLIC_EVENT_CATEGORY_OPTIONS)[number]["id"];
export type PortalEventCategoryId =
  (typeof PORTAL_EVENT_CATEGORY_OPTIONS)[number]["id"];
export type SubmissionEventCategoryId =
  (typeof SUBMISSION_EVENT_CATEGORY_OPTIONS)[number]["id"];
export type AdminEventCategoryId =
  (typeof ADMIN_EVENT_CATEGORY_OPTIONS)[number]["id"];

export const PUBLIC_EVENT_CATEGORY_IDS = PUBLIC_EVENT_CATEGORY_OPTIONS.map(
  (category) => category.id
) as readonly PublicEventCategoryId[];

export const PORTAL_EVENT_CATEGORY_IDS = PORTAL_EVENT_CATEGORY_OPTIONS.map(
  (category) => category.id
) as readonly PortalEventCategoryId[];

export const SUBMISSION_EVENT_CATEGORY_IDS = SUBMISSION_EVENT_CATEGORY_OPTIONS.map(
  (category) => category.id
) as readonly SubmissionEventCategoryId[];

export const ADMIN_EVENT_CATEGORY_IDS = ADMIN_EVENT_CATEGORY_OPTIONS.map(
  (category) => category.id
) as readonly AdminEventCategoryId[];

export const LEGACY_EVENT_CATEGORY_ALIASES: Record<string, string> = {
  // Dissolved categories -> new taxonomy (defaults for legacy data)
  nightlife: "music",
  community: "civic",
  family: "workshops",
  recreation: "fitness",
  wellness: "fitness",
  exercise: "fitness",
  learning: "education",
  support_group: "support",
  // Legacy string aliases
  activism: "civic",
  civic_engagement: "civic",
  government: "civic",
  volunteering: "volunteer",
  service: "volunteer",
  arts: "art",
  class: "workshops",
  cooking: "workshops",
  cultural: "civic",
  dance: "dance",
  education: "education",
  "food-drink": "food_drink",
  food: "food_drink",
  gaming: "games",
  health: "fitness",
  "kids-family": "workshops",
  markets: "food_drink",
  meetup: "education",
  museums: "art",
  outdoor: "outdoors",
  programs: "education",
  shopping: "food_drink",
  sports_recreation: "fitness",
  tours: "education",
  fitness: "fitness",
  yoga: "fitness",
  gym: "fitness",
  workout: "fitness",
};

export function normalizeEventCategory(category: string | null | undefined): string | null {
  if (typeof category !== "string") {
    return null;
  }

  const normalized = category.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return LEGACY_EVENT_CATEGORY_ALIASES[normalized] ?? normalized;
}

const PUBLIC_EVENT_CATEGORY_ID_SET = new Set<string>(PUBLIC_EVENT_CATEGORY_IDS);
const SUBMISSION_EVENT_CATEGORY_ID_SET = new Set<string>(SUBMISSION_EVENT_CATEGORY_IDS);
const ADMIN_EVENT_CATEGORY_ID_SET = new Set<string>(ADMIN_EVENT_CATEGORY_IDS);

export function isPublicEventCategoryId(
  category: string | null | undefined
): category is PublicEventCategoryId {
  return typeof category === "string" && PUBLIC_EVENT_CATEGORY_ID_SET.has(category);
}

export function isSubmissionEventCategoryId(
  category: string | null | undefined
): category is SubmissionEventCategoryId {
  return typeof category === "string" && SUBMISSION_EVENT_CATEGORY_ID_SET.has(category);
}

export function isAdminEventCategoryId(
  category: string | null | undefined
): category is AdminEventCategoryId {
  return typeof category === "string" && ADMIN_EVENT_CATEGORY_ID_SET.has(category);
}
