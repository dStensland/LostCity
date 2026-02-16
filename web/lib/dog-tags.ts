/**
 * Dog portal tag vocabulary.
 *
 * Single source of truth for all dog-related tag metadata.
 * Imported by server components, client components, and API routes.
 * Contains NO server-only imports — safe for "use client" modules.
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type DogTagCategory =
  | "base"
  | "amenities"
  | "access"
  | "food"
  | "surface"
  | "services"
  | "events";

export type DogTagInfo = {
  machineKey: string;
  label: string;
  icon: string;
  category: DogTagCategory;
};

export type DogTagGroup = {
  key: DogTagCategory;
  label: string;
  tags: DogTagInfo[];
};

/* ------------------------------------------------------------------ */
/*  Tag Registry                                                       */
/* ------------------------------------------------------------------ */

export const DOG_TAGS: DogTagInfo[] = [
  // Base
  { machineKey: "dog-friendly", label: "Dog-Friendly", icon: "\uD83D\uDC15", category: "base" },

  // Amenities
  { machineKey: "water-bowls", label: "Water Bowls", icon: "\uD83D\uDCA7", category: "amenities" },
  { machineKey: "dog-wash", label: "Dog Wash Station", icon: "\uD83D\uDEBF", category: "amenities" },
  { machineKey: "shade", label: "Shaded Area", icon: "\uD83C\uDF33", category: "amenities" },
  { machineKey: "benches", label: "Seating", icon: "\uD83E\uDE91", category: "amenities" },
  { machineKey: "parking", label: "Parking Available", icon: "\uD83C\uDD7F\uFE0F", category: "amenities" },
  { machineKey: "water-access", label: "Water Access", icon: "\uD83C\uDFCA", category: "amenities" },
  { machineKey: "agility-equipment", label: "Agility Equipment", icon: "\uD83C\uDFC3", category: "amenities" },

  // Access
  { machineKey: "off-leash", label: "Off-Leash Area", icon: "\uD83E\uDDAE", category: "access" },
  { machineKey: "leash-required", label: "Leash Required", icon: "\uD83D\uDD17", category: "access" },
  { machineKey: "fenced", label: "Fully Fenced", icon: "\uD83D\uDEA7", category: "access" },
  { machineKey: "unfenced", label: "Unfenced/Open", icon: "\uD83C\uDF3E", category: "access" },
  { machineKey: "small-dog-area", label: "Small Dog Section", icon: "\uD83D\uDC15\u200D\uD83E\uDDBA", category: "access" },
  { machineKey: "large-dog-area", label: "Large Dog Section", icon: "\uD83D\uDC15", category: "access" },
  { machineKey: "indoor", label: "Indoor Space", icon: "\uD83C\uDFE0", category: "access" },
  { machineKey: "outdoor-only", label: "Outdoor Only", icon: "\u2600\uFE0F", category: "access" },

  // Food & Dining
  { machineKey: "pup-cup", label: "Pup Cup", icon: "\uD83E\uDDC1", category: "food" },
  { machineKey: "dog-menu", label: "Dog Menu", icon: "\uD83C\uDF56", category: "food" },
  { machineKey: "treats-available", label: "Treats Available", icon: "\uD83E\uDDB4", category: "food" },

  // Surface & Terrain
  { machineKey: "paved", label: "Paved Path", icon: "\uD83D\uDEE4\uFE0F", category: "surface" },
  { machineKey: "gravel", label: "Gravel", icon: "\uD83E\uDEA8", category: "surface" },
  { machineKey: "grass", label: "Grass", icon: "\uD83C\uDF31", category: "surface" },
  { machineKey: "mulch", label: "Mulch", icon: "\uD83C\uDF42", category: "surface" },
  { machineKey: "dirt-trail", label: "Dirt Trail", icon: "\uD83E\uDD7E", category: "surface" },

  // Services (venue-level)
  { machineKey: "emergency-vet", label: "Emergency Vet", icon: "\uD83D\uDE91", category: "services" },
  { machineKey: "boarding", label: "Boarding", icon: "\uD83D\uDECF\uFE0F", category: "services" },
  { machineKey: "grooming", label: "Grooming", icon: "\u2702\uFE0F", category: "services" },
  { machineKey: "training", label: "Training Classes", icon: "\uD83C\uDF93", category: "services" },
  { machineKey: "daycare", label: "Daycare", icon: "\uD83C\uDFEB", category: "services" },
  { machineKey: "adoption", label: "Adoption Services", icon: "\u2764\uFE0F", category: "services" },
  { machineKey: "low-cost-vet", label: "Low-Cost Vet", icon: "\uD83D\uDCB0", category: "services" },

  // Events (applied to events, not venues via tagging)
  { machineKey: "adoption-event", label: "Adoption Event", icon: "\uD83C\uDFE0", category: "events" },
  { machineKey: "yappy-hour", label: "Yappy Hour", icon: "\uD83C\uDF7A", category: "events" },
  { machineKey: "dog-training", label: "Training Class", icon: "\uD83D\uDCDA", category: "events" },
  { machineKey: "dog-social", label: "Dog Social", icon: "\uD83C\uDF89", category: "events" },
  { machineKey: "vaccination", label: "Vaccination Clinic", icon: "\uD83D\uDC89", category: "events" },
  { machineKey: "fundraiser", label: "Fundraiser", icon: "\uD83D\uDCB5", category: "events" },
];

/* ------------------------------------------------------------------ */
/*  Derived lookups                                                    */
/* ------------------------------------------------------------------ */

/** Set of all machine keys for venue vibes — used for API validation */
export const ALLOWED_DOG_VIBES = new Set(
  DOG_TAGS.filter((t) => t.category !== "events").map((t) => t.machineKey)
);

/** Map from machine key to display info */
const TAG_MAP = new Map(DOG_TAGS.map((t) => [t.machineKey, t]));

/** Get display info for a vibe key. Returns null if not a dog tag. */
export function getTagDisplayInfo(key: string): DogTagInfo | null {
  return TAG_MAP.get(key) || null;
}

/* ------------------------------------------------------------------ */
/*  Grouped tags for the tag submission modal                          */
/* ------------------------------------------------------------------ */

export const DOG_TAG_GROUPS: DogTagGroup[] = [
  {
    key: "base",
    label: "Dog-Friendly Basics",
    tags: DOG_TAGS.filter((t) => t.category === "base"),
  },
  {
    key: "amenities",
    label: "Amenities",
    tags: DOG_TAGS.filter((t) => t.category === "amenities"),
  },
  {
    key: "food",
    label: "Food & Treats",
    tags: DOG_TAGS.filter((t) => t.category === "food"),
  },
  {
    key: "access",
    label: "Access",
    tags: DOG_TAGS.filter((t) => t.category === "access"),
  },
  {
    key: "surface",
    label: "Surface & Terrain",
    tags: DOG_TAGS.filter((t) => t.category === "surface"),
  },
];

/* ------------------------------------------------------------------ */
/*  Filter option sets for deep pages                                  */
/* ------------------------------------------------------------------ */

export const PARK_FILTER_OPTIONS = [
  { key: "all", label: "All" },
  { key: "fenced", label: "Fenced" },
  { key: "unfenced", label: "Unfenced" },
  { key: "small-dog-area", label: "Small Dog Area" },
  { key: "water-access", label: "Water Access" },
] as const;

export const SERVICE_TYPE_OPTIONS = [
  { key: "all", label: "All" },
  { key: "vet", label: "Vets" },
  { key: "groomer", label: "Groomers" },
  { key: "pet_store", label: "Pet Stores" },
  { key: "pet_daycare", label: "Daycare" },
] as const;

export const TRAINING_FILTER_OPTIONS = [
  { key: "all", label: "All" },
  { key: "puppy-class", label: "Puppy" },
  { key: "obedience", label: "Obedience" },
  { key: "agility", label: "Agility" },
] as const;
