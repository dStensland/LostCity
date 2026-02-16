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
    venueTypes: ["theater", "music_venue", "comedy_club"],
  },
  {
    id: "parks_outdoors",
    label: "Parks & Outdoors",
    icon: "park",
    description: "Green spaces, trails, and fresh air",
    venueTypes: ["park", "garden", "outdoor_venue", "trail"],
  },
  {
    id: "landmarks_attractions",
    label: "Landmarks & Attractions",
    icon: "landmark",
    description: "Iconic spots every visitor should see",
    venueTypes: ["arena", "stadium", "amphitheater", "zoo", "aquarium", "landmark", "skyscraper", "artifact", "public_art", "viewpoint", "historic_site"],
  },
  {
    id: "tours_experiences",
    label: "Tours & Experiences",
    icon: "tours",
    description: "Guided tours, tastings, and hands-on adventures",
    venueTypes: ["attraction", "distillery", "brewery", "winery"],
  },
  {
    id: "food_culture",
    label: "Food & Culture",
    icon: "food",
    description: "The flavors that define the city",
    venueTypes: ["food_hall"],
  },
  {
    id: "hidden_gems",
    label: "Hidden Gems",
    icon: "gem",
    description: "Off-the-beaten-path finds the locals love",
    venueTypes: ["record_store", "bookstore", "studio"],
  },
];

export const EXPLORE_CATEGORY_MAP = new Map(
  EXPLORE_CATEGORIES.map((cat) => [cat.id, cat])
);
