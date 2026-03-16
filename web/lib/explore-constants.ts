export type ExploreCategory = {
  id: string;
  label: string;
  icon: string;
  description: string;
  venueTypes: string[];
};

export type ExploreVenue = {
  id: number;
  name: string;
  slug: string | null;
  neighborhood: string | null;
  venue_type: string | null;
  short_description: string | null;
  explore_category: string | null;
  explore_featured: boolean;
  explore_blurb: string | null;
  hero_image_url: string | null;
  image_url: string | null;
  upcoming_event_count: number;
  next_event_title: string | null;
  next_event_date: string | null;
};

export type ExploreCollection = {
  category: ExploreCategory;
  venues: ExploreVenue[];
};

export const EXPLORE_CATEGORIES: ExploreCategory[] = [
  {
    id: "museums_galleries",
    label: "Museums & Galleries",
    icon: "museum",
    description: "World-class art, history, and culture",
    venueTypes: ["museum", "gallery"],
  },
  {
    id: "performing_arts",
    label: "Performing Arts",
    icon: "theater",
    description: "Theaters, stages, and live performance",
    venueTypes: ["theater", "music_venue", "nightclub"],
  },
  {
    id: "parks_outdoors",
    label: "Parks & Outdoors",
    icon: "park",
    description: "Green spaces, trails, and fresh air",
    venueTypes: ["park", "trail", "recreation"],
  },
  {
    id: "landmarks_attractions",
    label: "Landmarks & Attractions",
    icon: "landmark",
    description: "Iconic spots every visitor should see",
    venueTypes: ["stadium", "amphitheater", "landmark", "skyscraper", "artifact", "public_art", "viewpoint", "museum"],
  },
  {
    id: "tours_experiences",
    label: "Tours & Experiences",
    icon: "tours",
    description: "Guided tours, tastings, and hands-on adventures",
    venueTypes: ["attraction", "brewery"],
  },
  {
    id: "food_culture",
    label: "Food & Culture",
    icon: "food",
    description: "The flavors that define the city",
    venueTypes: ["restaurant", "farmers_market", "market"],
  },
  {
    id: "hidden_gems",
    label: "Hidden Gems",
    icon: "gem",
    description: "Off-the-beaten-path finds the locals love",
    venueTypes: ["record_store", "bookstore", "gallery"],
  },
];

export const EXPLORE_CATEGORY_MAP = new Map(
  EXPLORE_CATEGORIES.map((cat) => [cat.id, cat])
);

/**
 * Per-category fallback config used when a venue or hero has no image.
 * gradient: CSS linear-gradient value for the background.
 * iconPath: SVG path data (single <path> element, 24x24 viewBox).
 * iconColor: accent color for the icon stroke.
 */
export type CategoryHeroFallback = {
  gradient: string;
  iconPath: string;
  iconColor: string;
};

export const CATEGORY_HERO_IMAGES: Record<string, CategoryHeroFallback> = {
  museums_galleries: {
    gradient: "linear-gradient(135deg, #1a1225 0%, #0f0f14 60%, #1a1420 100%)",
    // Columns / pillars icon (classical institution)
    iconPath:
      "M12 3L2 8h20L12 3zM4 8v11h2V8H4zm6 0v11h2V8h-2zm6 0v11h2V8h-2zM2 19h20v2H2v-2z",
    iconColor: "#A78BFA",
  },
  performing_arts: {
    gradient: "linear-gradient(135deg, #1a1018 0%, #0f0f14 60%, #1a1215 100%)",
    // Theater masks
    iconPath:
      "M15.5 5a4.5 4.5 0 00-4.47 4H9a4.5 4.5 0 100 3h2.03A4.5 4.5 0 1015.5 5zm-7 7a2.5 2.5 0 110-5 2.5 2.5 0 010 5zm7 3a2.5 2.5 0 110-5 2.5 2.5 0 010 5z",
    iconColor: "#FF6B7A",
  },
  parks_outdoors: {
    gradient: "linear-gradient(135deg, #0e1a12 0%, #0f0f14 60%, #101810 100%)",
    // Tree
    iconPath:
      "M12 2L4.5 9h3.5v3H5l7 10 7-10h-3V9h3.5L12 2z",
    iconColor: "#4ade80",
  },
  landmarks_attractions: {
    gradient: "linear-gradient(135deg, #1a1510 0%, #0f0f14 60%, #181410 100%)",
    // Building / skyline
    iconPath:
      "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
    iconColor: "#FFD93D",
  },
  tours_experiences: {
    gradient: "linear-gradient(135deg, #121818 0%, #0f0f14 60%, #101618 100%)",
    // Compass / navigation
    iconPath:
      "M12 2a10 10 0 100 20A10 10 0 0012 2zm0 2a8 8 0 110 16A8 8 0 0112 4zm4.243 3.757l-5.656 2.829-2.829 5.656 5.656-2.829 2.829-5.656zM12 11a1 1 0 110 2 1 1 0 010-2z",
    iconColor: "#00D4E8",
  },
  food_culture: {
    gradient: "linear-gradient(135deg, #1a1210 0%, #0f0f14 60%, #181410 100%)",
    // Fork and knife
    iconPath:
      "M11 2v7c0 1.66-1.34 3-3 3H7v11H5V12c-1.66 0-3-1.34-3-3V2h2v6h1V2h2v6h1V2h2zm8 0v20h-2v-8h-3V6c0-2.21 1.79-4 4-4z",
    iconColor: "#FF6B7A",
  },
  hidden_gems: {
    gradient: "linear-gradient(135deg, #10121a 0%, #0f0f14 60%, #131018 100%)",
    // Diamond / gem shape
    iconPath:
      "M12 2l3 5h4l-7 14L5 7h4l3-5zm0 4.5L9.5 11l2.5 5 2.5-5L12 6.5z",
    iconColor: "#00D9A0",
  },
};

