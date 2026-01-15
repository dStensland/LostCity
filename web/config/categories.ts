// Place Categories Configuration

export interface PlaceCategory {
  id: string;
  name: string;
  googleTypes: string[];
  refreshDays: number; // How often to refresh
}

export const PLACE_CATEGORIES: PlaceCategory[] = [
  // High churn — weekly refresh
  {
    id: "restaurants",
    name: "Restaurants",
    googleTypes: [
      "restaurant",
      "american_restaurant",
      "italian_restaurant",
      "mexican_restaurant",
      "asian_restaurant",
      "indian_restaurant",
      "thai_restaurant",
      "japanese_restaurant",
      "chinese_restaurant",
      "korean_restaurant",
      "vietnamese_restaurant",
      "mediterranean_restaurant",
      "greek_restaurant",
      "french_restaurant",
      "spanish_restaurant",
      "brazilian_restaurant",
      "seafood_restaurant",
      "steak_house",
      "barbecue_restaurant",
      "pizza_restaurant",
      "sushi_restaurant",
      "ramen_restaurant",
      "vegetarian_restaurant",
      "vegan_restaurant",
    ],
    refreshDays: 7,
  },
  {
    id: "bars",
    name: "Bars & Nightlife",
    googleTypes: ["bar", "night_club", "wine_bar", "pub", "cocktail_bar"],
    refreshDays: 7,
  },
  {
    id: "coffee",
    name: "Coffee & Cafes",
    googleTypes: ["cafe", "coffee_shop", "tea_house"],
    refreshDays: 14,
  },

  // Medium churn — bi-weekly refresh
  {
    id: "entertainment",
    name: "Entertainment",
    googleTypes: [
      "movie_theater",
      "bowling_alley",
      "amusement_center",
      "comedy_club",
      "karaoke",
      "video_arcade",
    ],
    refreshDays: 14,
  },
  {
    id: "culture",
    name: "Arts & Culture",
    googleTypes: [
      "museum",
      "art_gallery",
      "performing_arts_theater",
      "cultural_center",
    ],
    refreshDays: 14,
  },
  {
    id: "fitness",
    name: "Fitness & Wellness",
    googleTypes: ["gym", "fitness_center", "yoga_studio", "spa", "wellness_center"],
    refreshDays: 14,
  },

  // Low churn — monthly refresh
  {
    id: "outdoors",
    name: "Parks & Outdoors",
    googleTypes: ["park", "hiking_area", "dog_park", "garden", "playground"],
    refreshDays: 30,
  },
  {
    id: "grocery",
    name: "Grocery & Markets",
    googleTypes: ["grocery_store", "supermarket", "market"],
    refreshDays: 30,
  },
  {
    id: "farmers_markets",
    name: "Farmers Markets",
    googleTypes: ["farmers_market"],
    refreshDays: 7, // Weekly since they operate on schedules
  },
  {
    id: "pharmacies",
    name: "Pharmacies",
    googleTypes: ["pharmacy", "drugstore"],
    refreshDays: 30,
  },
  {
    id: "hotels",
    name: "Hotels & Lodging",
    googleTypes: ["hotel", "lodging", "bed_and_breakfast", "hostel"],
    refreshDays: 30,
  },
];

// Get category by ID
export function getCategoryById(id: string): PlaceCategory | undefined {
  return PLACE_CATEGORIES.find((c) => c.id === id);
}

// Get categories that need refresh based on days since last refresh
export function getCategoriesNeedingRefresh(
  daysSinceRefresh: number
): PlaceCategory[] {
  return PLACE_CATEGORIES.filter((c) => daysSinceRefresh >= c.refreshDays);
}
