/**
 * Client-safe utilities for portal onboarding / preferences
 * Types and pure functions — no server imports
 */

// ============================================================================
// TYPES
// ============================================================================

export type TravelParty = "alone" | "couple" | "family" | "group";
export type InterestTag =
  | "food"
  | "nightlife"
  | "arts"
  | "outdoors"
  | "wellness"
  | "music"
  | "sports";
export type DietaryNeed =
  | "vegetarian"
  | "vegan"
  | "gluten_free"
  | "nut_allergy"
  | "dairy_free"
  | "halal"
  | "kosher";

export interface PortalPreferences {
  travel_party: TravelParty | null;
  interests: InterestTag[];
  dietary_needs: DietaryNeed[];
  preferred_guest_intent: string | null;
  preferred_experience_view: string | null;
  mobility_preferences: Record<string, unknown>;
  onboarding_completed_at: string | null;
}

export interface PortalPreferencesRow extends PortalPreferences {
  id: string;
  user_id: string;
  portal_id: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// ONBOARDING STEP DEFINITIONS
// ============================================================================

export interface OnboardingOption<T extends string> {
  id: T;
  label: string;
  icon: string;
  description?: string;
}

export const TRAVEL_PARTY_OPTIONS: OnboardingOption<TravelParty>[] = [
  { id: "alone", label: "Solo", icon: "person", description: "Just me" },
  {
    id: "couple",
    label: "Couple",
    icon: "heart",
    description: "Date night or getaway",
  },
  {
    id: "family",
    label: "Family",
    icon: "family",
    description: "With kids in tow",
  },
  {
    id: "group",
    label: "Group",
    icon: "group",
    description: "Friends or colleagues",
  },
];

export const INTEREST_OPTIONS: OnboardingOption<InterestTag>[] = [
  { id: "food", label: "Food & Dining", icon: "utensils" },
  { id: "nightlife", label: "Nightlife", icon: "moon" },
  { id: "arts", label: "Arts & Culture", icon: "palette" },
  { id: "outdoors", label: "Outdoors", icon: "tree" },
  { id: "wellness", label: "Wellness", icon: "spa" },
  { id: "music", label: "Live Music", icon: "music" },
  { id: "sports", label: "Sports", icon: "trophy" },
];

export const DIETARY_OPTIONS: OnboardingOption<DietaryNeed>[] = [
  { id: "vegetarian", label: "Vegetarian", icon: "leaf" },
  { id: "vegan", label: "Vegan", icon: "seedling" },
  { id: "gluten_free", label: "Gluten-Free", icon: "wheat-off" },
  { id: "nut_allergy", label: "Nut Allergy", icon: "alert" },
  { id: "dairy_free", label: "Dairy-Free", icon: "milk-off" },
  { id: "halal", label: "Halal", icon: "check" },
  { id: "kosher", label: "Kosher", icon: "check" },
];

// ============================================================================
// ONBOARDING STEPS
// ============================================================================

export type OnboardingStep = "travel_party" | "interests" | "dietary";

export const ONBOARDING_STEPS: OnboardingStep[] = [
  "travel_party",
  "interests",
  "dietary",
];

export function getStepTitle(step: OnboardingStep): string {
  switch (step) {
    case "travel_party":
      return "Who's joining you?";
    case "interests":
      return "What are you into?";
    case "dietary":
      return "Any dietary needs?";
  }
}

export function getStepSubtitle(step: OnboardingStep): string {
  switch (step) {
    case "travel_party":
      return "We'll tailor recommendations for your group";
    case "interests":
      return "Pick all that apply — we'll prioritize what you love";
    case "dietary":
      return "Optional — helps us suggest the right restaurants";
  }
}

export function isStepSkippable(step: OnboardingStep): boolean {
  return step === "dietary";
}

// ============================================================================
// PREFERENCE → INTENT MAPPING
// ============================================================================

/**
 * Maps travel party + interests to a suggested guest intent
 * Used by the FORTH concierge to auto-set persona
 */
export function suggestGuestIntent(prefs: PortalPreferences): string | null {
  if (!prefs.travel_party) return null;

  if (prefs.travel_party === "couple") return "romance";
  if (
    prefs.travel_party === "alone" &&
    prefs.interests.includes("wellness")
  )
    return "wellness";
  if (prefs.interests.includes("nightlife")) return "night_out";
  if (prefs.travel_party === "alone") return "business";

  return null;
}

/**
 * Maps travel party to a suggested visitor persona
 */
export function suggestVisitorPersona(
  prefs: PortalPreferences
): string | null {
  if (!prefs.travel_party) return null;

  switch (prefs.travel_party) {
    case "alone":
      return prefs.interests.includes("wellness")
        ? "wellness_guest"
        : "business_traveler";
    case "couple":
      return "weekend_couple";
    case "family":
      return "first_time";
    case "group":
      return "first_time";
    default:
      return null;
  }
}

// ============================================================================
// localStorage HELPERS
// ============================================================================

const PREFS_STORAGE_KEY = "lostcity_portal_prefs";

export function getLocalPreferences(
  portalId: string
): PortalPreferences | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${PREFS_STORAGE_KEY}_${portalId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveLocalPreferences(
  portalId: string,
  prefs: PortalPreferences
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      `${PREFS_STORAGE_KEY}_${portalId}`,
      JSON.stringify(prefs)
    );
  } catch {
    // Storage full or unavailable
  }
}

export function clearLocalPreferences(portalId: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(`${PREFS_STORAGE_KEY}_${portalId}`);
}

export function createEmptyPreferences(): PortalPreferences {
  return {
    travel_party: null,
    interests: [],
    dietary_needs: [],
    preferred_guest_intent: null,
    preferred_experience_view: null,
    mobility_preferences: {},
    onboarding_completed_at: null,
  };
}
