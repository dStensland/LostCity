export type DiscoveryEntityType = "place" | "event";

export interface DiscoveryPlaceEntity {
  entity_type: "place";
  id: number;
  name: string;
  slug: string;
  image_url: string | null;
  place_type: string;
  neighborhood: string | null;
  short_description: string | null;
  is_open: boolean;
  closes_at: string | null;
  google_rating: number | null;
  google_rating_count: number | null;
  price_level: number | null;
  vibes: string[];
  genres: string[];
  distance_km: number | null;
  event_count: number;
  current_exhibition_title: string | null;
  current_exhibition_status: string | null;
  commitment_tier: string | null;
  best_seasons: string[] | null;
  cuisine: string[] | null;
}

export interface DiscoveryEventEntity {
  entity_type: "event";
  id: number;
  name: string;
  slug: string;
  image_url: string | null;
  place_type: string | null;
  neighborhood: string | null;
  venue_name: string | null;
  start_date: string;
  start_time: string | null;
  category_id: string | null;
  is_free: boolean;
  price_min: number | null;
  genres: string[];
}

export type DiscoveryEntity = DiscoveryPlaceEntity | DiscoveryEventEntity;

export type CardFidelity = "compact" | "expanded";

export type VerticalLane =
  | "arts"
  | "dining"
  | "nightlife"
  | "outdoors"
  | "music"
  | "entertainment";

export const LANE_CONFIG: Record<
  VerticalLane,
  { label: string; icon: string; color: string; placeTypes: string[] }
> = {
  arts: {
    label: "Arts & Culture",
    icon: "palette",
    color: "#C9874F",
    placeTypes: ["museum", "gallery", "arts_center", "theater"],
  },
  dining: {
    label: "Eat & Drink",
    icon: "fork-knife",
    color: "#FF6B7A",
    placeTypes: [
      "restaurant",
      "bar",
      "brewery",
      "cocktail_bar",
      "coffee_shop",
      "food_hall",
      "wine_bar",
      "rooftop",
      "lounge",
    ],
  },
  nightlife: {
    label: "Nightlife",
    icon: "moon-stars",
    color: "#E855A0",
    placeTypes: [
      "bar",
      "nightclub",
      "cocktail_bar",
      "lounge",
      "music_venue",
      "comedy_club",
      "karaoke",
      "lgbtq",
    ],
  },
  outdoors: {
    label: "Outdoors",
    icon: "tree",
    color: "#00D9A0",
    placeTypes: ["park", "trail", "recreation", "viewpoint", "landmark"],
  },
  music: {
    label: "Music & Shows",
    icon: "music-notes",
    color: "#A78BFA",
    placeTypes: ["music_venue", "amphitheater", "arena", "stadium"],
  },
  entertainment: {
    label: "Entertainment",
    icon: "ticket",
    color: "#A78BFA",
    placeTypes: [
      "arcade",
      "attraction",
      "entertainment",
      "escape_room",
      "bowling",
      "zoo",
      "aquarium",
      "cinema",
    ],
  },
};
