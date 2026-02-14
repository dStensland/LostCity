import { resolvePortalSlugAlias } from "@/lib/portal-aliases";

export const PCM_DEMO_SLUG = "ponce-city-market-demo";

// Ponce City Market coordinates (675 Ponce De Leon Ave NE, Atlanta, GA 30308)
export const PCM_CENTER_LAT = 33.7726;
export const PCM_CENTER_LNG = -84.3655;
export const PCM_PROXIMITY_RADIUS_KM = 0.5;

// Geo-box for tight PCM tenant detection (~200m radius)
export const PCM_GEO_BOX = {
  minLat: PCM_CENTER_LAT - 0.002,
  maxLat: PCM_CENTER_LAT + 0.002,
  minLng: PCM_CENTER_LNG - 0.002,
  maxLng: PCM_CENTER_LNG + 0.002,
};

export function isPCMDemoPortal(portalSlug: string): boolean {
  return resolvePortalSlugAlias(portalSlug) === PCM_DEMO_SLUG;
}

export type TenantCategory =
  | "coffee"
  | "lunch"
  | "dinner"
  | "drinks"
  | "shopping"
  | "wellness"
  | "entertainment";

const COFFEE_KEYWORDS = ["coffee", "cafe", "bakery", "tea", "espresso", "brunch"];
const DRINKS_KEYWORDS = ["bar", "cocktail", "brewery", "wine", "lounge", "pub", "taproom"];
const DINNER_KEYWORDS = ["restaurant", "dining", "steakhouse", "sushi", "italian", "french", "upscale"];
const LUNCH_KEYWORDS = ["fast-casual", "sandwich", "salad", "pizza", "poke", "ramen", "taco", "deli", "counter"];
const WELLNESS_KEYWORDS = ["fitness", "yoga", "spa", "wellness", "pilates", "gym"];
const ENTERTAINMENT_KEYWORDS = ["amusement", "games", "arcade", "mini-golf", "rooftop", "entertainment"];

export function classifyTenant(
  venueType: string | null | undefined,
  vibes: string[] | null | undefined
): TenantCategory {
  const type = (venueType || "").toLowerCase();
  const vibeStr = (vibes || []).join(" ").toLowerCase();
  const haystack = `${type} ${vibeStr}`;

  if (COFFEE_KEYWORDS.some((k) => haystack.includes(k))) return "coffee";
  if (ENTERTAINMENT_KEYWORDS.some((k) => haystack.includes(k))) return "entertainment";
  if (WELLNESS_KEYWORDS.some((k) => haystack.includes(k))) return "wellness";
  if (DRINKS_KEYWORDS.some((k) => haystack.includes(k))) return "drinks";
  if (LUNCH_KEYWORDS.some((k) => haystack.includes(k))) return "lunch";
  if (DINNER_KEYWORDS.some((k) => haystack.includes(k))) return "dinner";

  // Default based on venue type
  if (type === "restaurant") return "dinner";
  if (type === "bar" || type === "nightclub") return "drinks";
  if (type === "coffee_shop") return "coffee";

  return "shopping";
}

export const TENANT_CATEGORY_LABELS: Record<TenantCategory, string> = {
  coffee: "Coffee & Morning",
  lunch: "Quick Bites",
  dinner: "Dining",
  drinks: "Drinks & Nightlife",
  shopping: "Shopping",
  wellness: "Wellness",
  entertainment: "Entertainment",
};

export const TENANT_CATEGORY_ORDER: TenantCategory[] = [
  "coffee",
  "lunch",
  "dinner",
  "drinks",
  "shopping",
  "wellness",
  "entertainment",
];

// Persona-specific sort overrides
export const PERSONA_CATEGORY_ORDER: Record<string, TenantCategory[]> = {
  visitor: ["dinner", "drinks", "coffee", "lunch", "shopping", "entertainment", "wellness"],
  resident: ["coffee", "lunch", "dinner", "drinks", "wellness", "shopping", "entertainment"],
  employee: ["lunch", "coffee", "dinner", "drinks", "wellness", "shopping", "entertainment"],
};

export type MarketplacePersona = "visitor" | "resident" | "employee";

export function normalizeMarketplacePersona(
  param: string | undefined | null
): MarketplacePersona {
  if (param === "visitor" || param === "resident" || param === "employee") {
    return param;
  }
  return "visitor";
}
