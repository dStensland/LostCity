// ITP Atlanta Neighborhoods Configuration

export interface Neighborhood {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius: number; // meters
  tier: 1 | 2 | 3; // 1=high activity, 2=medium, 3=low
}

export const ITP_NEIGHBORHOODS: Neighborhood[] = [
  // Tier 1: High activity cores — refresh weekly
  {
    id: "downtown",
    name: "Downtown",
    lat: 33.749,
    lng: -84.388,
    radius: 2000,
    tier: 1,
  },
  {
    id: "midtown",
    name: "Midtown",
    lat: 33.784,
    lng: -84.383,
    radius: 2000,
    tier: 1,
  },
  {
    id: "buckhead",
    name: "Buckhead",
    lat: 33.838,
    lng: -84.379,
    radius: 2500,
    tier: 1,
  },
  {
    id: "old-fourth-ward",
    name: "Old Fourth Ward",
    lat: 33.769,
    lng: -84.362,
    radius: 1500,
    tier: 1,
  },
  {
    id: "east-atlanta-village",
    name: "East Atlanta Village",
    lat: 33.74,
    lng: -84.341,
    radius: 1000,
    tier: 1,
  },
  {
    id: "little-five-points",
    name: "Little Five Points",
    lat: 33.764,
    lng: -84.349,
    radius: 1000,
    tier: 1,
  },
  {
    id: "decatur",
    name: "Decatur",
    lat: 33.775,
    lng: -84.296,
    radius: 2000,
    tier: 1,
  },
  {
    id: "west-midtown",
    name: "West Midtown",
    lat: 33.791,
    lng: -84.422,
    radius: 2000,
    tier: 1,
  },
  {
    id: "ponce-city-market",
    name: "Ponce City Market Area",
    lat: 33.772,
    lng: -84.365,
    radius: 800,
    tier: 1,
  },
  {
    id: "krog-street",
    name: "Krog Street",
    lat: 33.759,
    lng: -84.363,
    radius: 600,
    tier: 1,
  },

  // Tier 2: Active neighborhoods — refresh bi-weekly
  {
    id: "virginia-highland",
    name: "Virginia-Highland",
    lat: 33.774,
    lng: -84.356,
    radius: 1200,
    tier: 2,
  },
  {
    id: "inman-park",
    name: "Inman Park",
    lat: 33.761,
    lng: -84.352,
    radius: 1200,
    tier: 2,
  },
  {
    id: "grant-park",
    name: "Grant Park",
    lat: 33.738,
    lng: -84.37,
    radius: 1500,
    tier: 2,
  },
  {
    id: "cabbagetown",
    name: "Cabbagetown",
    lat: 33.749,
    lng: -84.353,
    radius: 800,
    tier: 2,
  },
  {
    id: "reynoldstown",
    name: "Reynoldstown",
    lat: 33.749,
    lng: -84.34,
    radius: 1000,
    tier: 2,
  },
  {
    id: "kirkwood",
    name: "Kirkwood",
    lat: 33.756,
    lng: -84.318,
    radius: 1500,
    tier: 2,
  },
  {
    id: "candler-park",
    name: "Candler Park",
    lat: 33.764,
    lng: -84.336,
    radius: 1200,
    tier: 2,
  },
  {
    id: "edgewood",
    name: "Edgewood",
    lat: 33.752,
    lng: -84.331,
    radius: 1000,
    tier: 2,
  },
  {
    id: "west-end",
    name: "West End",
    lat: 33.736,
    lng: -84.413,
    radius: 1500,
    tier: 2,
  },
  {
    id: "atlantic-station",
    name: "Atlantic Station",
    lat: 33.791,
    lng: -84.395,
    radius: 1000,
    tier: 2,
  },
  {
    id: "ansley-park",
    name: "Ansley Park",
    lat: 33.794,
    lng: -84.38,
    radius: 1200,
    tier: 2,
  },
  {
    id: "morningside",
    name: "Morningside",
    lat: 33.796,
    lng: -84.357,
    radius: 1500,
    tier: 2,
  },
  {
    id: "druid-hills",
    name: "Druid Hills",
    lat: 33.783,
    lng: -84.328,
    radius: 2000,
    tier: 2,
  },
  {
    id: "east-lake",
    name: "East Lake",
    lat: 33.756,
    lng: -84.302,
    radius: 1500,
    tier: 2,
  },
  {
    id: "summerhill",
    name: "Summerhill",
    lat: 33.735,
    lng: -84.381,
    radius: 1200,
    tier: 2,
  },

  // Tier 3: Residential-heavy — refresh monthly
  {
    id: "lake-claire",
    name: "Lake Claire",
    lat: 33.767,
    lng: -84.322,
    radius: 1000,
    tier: 3,
  },
  {
    id: "ormewood-park",
    name: "Ormewood Park",
    lat: 33.727,
    lng: -84.348,
    radius: 1200,
    tier: 3,
  },
  {
    id: "poncey-highland",
    name: "Poncey-Highland",
    lat: 33.772,
    lng: -84.348,
    radius: 1000,
    tier: 3,
  },
  {
    id: "castleberry-hill",
    name: "Castleberry Hill",
    lat: 33.748,
    lng: -84.401,
    radius: 800,
    tier: 3,
  },
  {
    id: "sweet-auburn",
    name: "Sweet Auburn",
    lat: 33.755,
    lng: -84.376,
    radius: 1000,
    tier: 3,
  },
  {
    id: "pittsburgh",
    name: "Pittsburgh",
    lat: 33.727,
    lng: -84.404,
    radius: 1200,
    tier: 3,
  },
  {
    id: "mechanicsville",
    name: "Mechanicsville",
    lat: 33.735,
    lng: -84.4,
    radius: 1000,
    tier: 3,
  },
  {
    id: "vine-city",
    name: "Vine City",
    lat: 33.76,
    lng: -84.417,
    radius: 1200,
    tier: 3,
  },
  {
    id: "english-avenue",
    name: "English Avenue",
    lat: 33.768,
    lng: -84.428,
    radius: 1000,
    tier: 3,
  },
  {
    id: "grove-park",
    name: "Grove Park",
    lat: 33.787,
    lng: -84.457,
    radius: 1500,
    tier: 3,
  },
  {
    id: "collier-hills",
    name: "Collier Hills",
    lat: 33.81,
    lng: -84.41,
    radius: 1500,
    tier: 3,
  },
  {
    id: "brookwood-hills",
    name: "Brookwood Hills",
    lat: 33.808,
    lng: -84.39,
    radius: 1000,
    tier: 3,
  },
  {
    id: "adair-park",
    name: "Adair Park",
    lat: 33.728,
    lng: -84.413,
    radius: 1000,
    tier: 3,
  },
  {
    id: "capitol-view",
    name: "Capitol View",
    lat: 33.712,
    lng: -84.413,
    radius: 1200,
    tier: 3,
  },
  {
    id: "peoplestown",
    name: "Peoplestown",
    lat: 33.723,
    lng: -84.387,
    radius: 1000,
    tier: 3,
  },
];

// Get neighborhoods by tier
export function getNeighborhoodsByTier(tier: 1 | 2 | 3): Neighborhood[] {
  return ITP_NEIGHBORHOODS.filter((n) => n.tier === tier);
}

// Get neighborhood by ID
export function getNeighborhoodById(id: string): Neighborhood | undefined {
  return ITP_NEIGHBORHOODS.find((n) => n.id === id);
}

// Get neighborhood by name (case-insensitive, handles common variations)
export function getNeighborhoodByName(name: string): Neighborhood | undefined {
  const normalized = name.toLowerCase().replace(/[-\s]+/g, "-");
  return ITP_NEIGHBORHOODS.find(
    (n) => n.id === normalized || n.name.toLowerCase().replace(/[-\s]+/g, "-") === normalized
  );
}

// ============================================
// DERIVED EXPORTS FOR DIFFERENT CONSUMERS
// ============================================

/**
 * Simple string array of neighborhood names for dropdowns and filters.
 * This is the canonical list - all other neighborhood arrays should import this.
 * Sorted alphabetically for UI display.
 */
export const NEIGHBORHOOD_NAMES = ITP_NEIGHBORHOODS.map((n) => n.name).sort() as readonly string[];

/**
 * Neighborhood options for preferences/onboarding (subset of most active neighborhoods).
 * Tier 1 and Tier 2 only - residential tier 3 neighborhoods excluded.
 */
export const PREFERENCE_NEIGHBORHOOD_NAMES = ITP_NEIGHBORHOODS
  .filter((n) => n.tier <= 2)
  .map((n) => n.name)
  .sort() as readonly string[];

/**
 * Map of neighborhood name variations to canonical names.
 * Handles common spelling differences.
 */
export const NEIGHBORHOOD_ALIASES: Record<string, string> = {
  // Hyphen/space variations - map non-hyphenated to hyphenated
  "Virginia Highland": "Virginia-Highland",
  "virginia highland": "Virginia-Highland",
  "VaHi": "Virginia-Highland",
  "vahi": "Virginia-Highland",
  "Poncey Highland": "Poncey-Highland",
  "poncey highland": "Poncey-Highland",
  // Abbreviations
  "O4W": "Old Fourth Ward",
  "o4w": "Old Fourth Ward",
  "EAV": "East Atlanta Village",
  "eav": "East Atlanta Village",
  "East Atlanta": "East Atlanta Village",
  "L5P": "Little Five Points",
  "l5p": "Little Five Points",
  "PCM": "Ponce City Market Area",
  "Ponce City Market": "Ponce City Market Area",
  // Westside variations
  "Westside": "West Midtown",
  "West Side": "West Midtown",
  "Westside Provisions": "West Midtown",
};

// ============================================
// NEIGHBORHOOD DESCRIPTIONS
// ============================================

const NEIGHBORHOOD_DESCRIPTIONS: Record<string, string> = {
  // Tier 1
  "downtown": "Atlanta's urban core — home to Centennial Olympic Park, Mercedes-Benz Stadium, and a growing mix of nightlife, galleries, and street culture.",
  "midtown": "The city's arts and culture hub, anchored by the High Museum, Woodruff Arts Center, and Piedmont Park. Dense with restaurants, bars, and live venues.",
  "buckhead": "Upscale dining, shopping, and nightlife in Atlanta's most polished district. Everything from rooftop lounges to hidden cocktail bars.",
  "old-fourth-ward": "One of Atlanta's most dynamic neighborhoods — the BeltLine Eastside Trail, Ponce City Market, and a thriving food and bar scene.",
  "east-atlanta-village": "A fiercely independent corner of the city with dive bars, live music venues, and a tight-knit creative community.",
  "little-five-points": "Atlanta's counterculture heart. Vintage shops, street art, indie music, and an anything-goes energy.",
  "decatur": "A vibrant city-within-a-city known for its restaurant scene, craft beer culture, and walkable downtown square.",
  "west-midtown": "Former industrial warehouses transformed into restaurants, galleries, breweries, and event spaces. Atlanta's design district.",
  "ponce-city-market": "The iconic Sears building turned food hall and gathering place, with rooftop amusements and BeltLine access.",
  "krog-street": "A compact, walkable cluster of restaurants and the beloved Krog Street Market, nestled along the BeltLine.",
  // Tier 2
  "virginia-highland": "Charming tree-lined streets with neighborhood restaurants, cozy bars, and a classic Atlanta village vibe.",
  "inman-park": "Atlanta's first planned suburb, now a foodie destination with Victorian homes, the BeltLine, and eclectic local shops.",
  "grant-park": "Home to Zoo Atlanta and the city's second-largest park. A family-friendly neighborhood with growing dining options.",
  "cabbagetown": "A tiny, colorful neighborhood defined by shotgun houses, street art, and the massive Krog Street Tunnel murals.",
  "reynoldstown": "A transitioning neighborhood anchored by the Atlanta BeltLine and the Beacon, a repurposed warehouse food hall.",
  "kirkwood": "A diverse residential neighborhood with a lively stretch of restaurants, a farmers market, and strong community spirit.",
  "candler-park": "A beloved intown neighborhood with a tight community, local eateries, and the historic Plaza Theatre.",
  "edgewood": "Known for its legendary bar crawl strip — Edgewood Avenue — packed with dive bars, dance clubs, and late-night spots.",
  "west-end": "One of Atlanta's oldest neighborhoods, experiencing a cultural renaissance with new restaurants, markets, and community spaces.",
  "atlantic-station": "A mixed-use development with shopping, dining, and entertainment. Urban convenience in a walkable setting.",
  "ansley-park": "An elegant Midtown-adjacent neighborhood with stately homes, quiet streets, and proximity to Piedmont Park.",
  "morningside": "A leafy residential enclave with excellent neighborhood restaurants and a strong sense of community.",
  "druid-hills": "Historic neighborhood designed by Frederick Law Olmsted, home to Emory University and the Fernbank Museum.",
  "east-lake": "A neighborhood on the rise, known for the East Lake Golf Club and a growing local food scene.",
  "summerhill": "Revitalized neighborhood near Georgia State Stadium with new restaurants, a brewery, and market-rate and affordable housing.",
};

/**
 * Get a short description for a neighborhood by its ID.
 */
export function getNeighborhoodDescription(id: string): string | null {
  return NEIGHBORHOOD_DESCRIPTIONS[id] ?? null;
}

/**
 * Normalize a neighborhood name to its canonical form.
 * Useful for data import/geocoding consistency.
 */
export function normalizeNeighborhoodName(name: string): string {
  // Check aliases first
  if (NEIGHBORHOOD_ALIASES[name]) {
    return NEIGHBORHOOD_ALIASES[name];
  }
  // Check if it matches an existing neighborhood
  const match = getNeighborhoodByName(name);
  if (match) {
    return match.name;
  }
  // Return original if no match
  return name;
}
