export const PUBLIC_EVENT_CATEGORY_OPTIONS = [
  { id: "music", label: "Music" },
  { id: "film", label: "Film" },
  { id: "comedy", label: "Comedy" },
  { id: "theater", label: "Theater" },
  { id: "art", label: "Art" },
  { id: "sports", label: "Sports" },
  { id: "food_drink", label: "Food & Drink" },
  { id: "nightlife", label: "Nightlife" },
  { id: "community", label: "Community" },
  { id: "fitness", label: "Fitness" },
  { id: "family", label: "Family" },
  { id: "learning", label: "Learning" },
  { id: "words", label: "Words" },
  { id: "religious", label: "Religious" },
  { id: "wellness", label: "Wellness" },
  { id: "outdoors", label: "Outdoors" },
] as const;

export const PORTAL_EVENT_CATEGORY_OPTIONS = PUBLIC_EVENT_CATEGORY_OPTIONS;

export const SUBMISSION_EVENT_CATEGORY_OPTIONS = [
  ...PUBLIC_EVENT_CATEGORY_OPTIONS,
  { id: "other", label: "Other" },
] as const;

export const ADMIN_EVENT_CATEGORY_OPTIONS = [
  ...PUBLIC_EVENT_CATEGORY_OPTIONS,
  { id: "support_group", label: "Support Groups" },
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
  activism: "community",
  arts: "art",
  class: "learning",
  cooking: "learning",
  cultural: "community",
  dance: "learning",
  education: "learning",
  "food-drink": "food_drink",
  food: "food_drink",
  gaming: "community",
  health: "wellness",
  "kids-family": "family",
  markets: "community",
  meetup: "community",
  museums: "art",
  outdoor: "outdoors",
  programs: "family",
  shopping: "community",
  sports_recreation: "sports",
  tours: "learning",
  yoga: "fitness",
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
