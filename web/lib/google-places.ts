// Google Places API Integration

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY || "";

// Field mask for Nearby Search API
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.types",
  "places.primaryType",
  "places.rating",
  "places.userRatingCount",
  "places.priceLevel",
  "places.regularOpeningHours",
  "places.websiteUri",
  "places.nationalPhoneNumber",
  "places.googleMapsUri",
  "places.wheelchairAccessibleEntrance",
  "places.outdoorSeating",
  "places.servesVegetarianFood",
  "places.servesVegan",
  "places.servesBeer",
  "places.servesWine",
  "places.servesBreakfast",
  "places.servesBrunch",
  "places.servesLunch",
  "places.servesDinner",
  "places.delivery",
  "places.dineIn",
  "places.takeout",
  "places.reservable",
].join(",");

export interface NearbySearchParams {
  lat: number;
  lng: number;
  radius: number;
  types: string[];
}

export interface GooglePlace {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  types?: string[];
  primaryType?: string;
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  regularOpeningHours?: {
    periods?: Array<{
      open?: { hour: number; minute: number };
      close?: { hour: number; minute: number };
    }>;
  };
  websiteUri?: string;
  nationalPhoneNumber?: string;
  googleMapsUri?: string;
  wheelchairAccessibleEntrance?: boolean;
  outdoorSeating?: boolean;
  servesVegetarianFood?: boolean;
  servesVegan?: boolean;
  servesBeer?: boolean;
  servesWine?: boolean;
  servesBreakfast?: boolean;
  servesBrunch?: boolean;
  servesLunch?: boolean;
  servesDinner?: boolean;
  delivery?: boolean;
  dineIn?: boolean;
  takeout?: boolean;
  reservable?: boolean;
}

export interface DbPlace {
  google_place_id: string;
  name: string;
  address: string | null;
  neighborhood_id: string;
  lat: number;
  lng: number;
  category_id: string;
  google_types: string[] | null;
  primary_type: string | null;
  rating: number | null;
  rating_count: number | null;
  price_level: number | null;
  hours_json: object | null;
  is_24_hours: boolean;
  phone: string | null;
  website: string | null;
  google_maps_url: string | null;
  wheelchair_accessible: boolean | null;
  outdoor_seating: boolean | null;
  serves_vegetarian: boolean | null;
  serves_vegan: boolean | null;
  serves_beer: boolean | null;
  serves_wine: boolean | null;
  serves_breakfast: boolean | null;
  serves_brunch: boolean | null;
  serves_lunch: boolean | null;
  serves_dinner: boolean | null;
  delivery: boolean | null;
  dine_in: boolean | null;
  takeout: boolean | null;
  reservable: boolean | null;
  fetched_at: Date;
  last_refreshed_at: Date;
  google_score?: number;
  final_score?: number;
}

/**
 * Search for nearby places using Google Places API (New)
 */
export async function searchNearbyPlaces({
  lat,
  lng,
  radius,
  types,
}: NearbySearchParams): Promise<GooglePlace[]> {
  if (!GOOGLE_API_KEY) {
    console.error("GOOGLE_PLACES_API_KEY is not set");
    return [];
  }

  const response = await fetch(
    "https://places.googleapis.com/v1/places:searchNearby",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_API_KEY,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify({
        includedTypes: types,
        locationRestriction: {
          circle: {
            center: { latitude: lat, longitude: lng },
            radius: radius,
          },
        },
        maxResultCount: 20,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error(`Google API error: ${response.status}`, error);
    throw new Error(`Google API error: ${response.status}`);
  }

  const data = await response.json();
  return (data.places || []) as GooglePlace[];
}

/**
 * Map Google Place response to database format
 */
export function mapGooglePlaceToDb(
  place: GooglePlace,
  neighborhoodId: string,
  categoryId: string
): DbPlace {
  const priceMap: Record<string, number> = {
    PRICE_LEVEL_FREE: 0,
    PRICE_LEVEL_INEXPENSIVE: 1,
    PRICE_LEVEL_MODERATE: 2,
    PRICE_LEVEL_EXPENSIVE: 3,
    PRICE_LEVEL_VERY_EXPENSIVE: 4,
  };

  // Check if place is open 24 hours
  const is24Hours =
    place.regularOpeningHours?.periods?.some(
      (p) => p.open?.hour === 0 && p.open?.minute === 0 && !p.close
    ) || false;

  return {
    google_place_id: place.id,
    name: place.displayName?.text || "Unknown",
    address: place.formattedAddress || null,
    neighborhood_id: neighborhoodId,
    lat: place.location?.latitude || 0,
    lng: place.location?.longitude || 0,
    category_id: categoryId,
    google_types: place.types || null,
    primary_type: place.primaryType || null,
    rating: place.rating || null,
    rating_count: place.userRatingCount || null,
    price_level: place.priceLevel ? priceMap[place.priceLevel] ?? null : null,
    hours_json: place.regularOpeningHours || null,
    is_24_hours: is24Hours,
    phone: place.nationalPhoneNumber || null,
    website: place.websiteUri || null,
    google_maps_url: place.googleMapsUri || null,
    wheelchair_accessible: place.wheelchairAccessibleEntrance ?? null,
    outdoor_seating: place.outdoorSeating ?? null,
    serves_vegetarian: place.servesVegetarianFood ?? null,
    serves_vegan: place.servesVegan ?? null,
    serves_beer: place.servesBeer ?? null,
    serves_wine: place.servesWine ?? null,
    serves_breakfast: place.servesBreakfast ?? null,
    serves_brunch: place.servesBrunch ?? null,
    serves_lunch: place.servesLunch ?? null,
    serves_dinner: place.servesDinner ?? null,
    delivery: place.delivery ?? null,
    dine_in: place.dineIn ?? null,
    takeout: place.takeout ?? null,
    reservable: place.reservable ?? null,
    fetched_at: new Date(),
    last_refreshed_at: new Date(),
  };
}

/**
 * Fetch and save places for a neighborhood and category
 */
export async function fetchPlacesForNeighborhood(
  neighborhood: { id: string; lat: number; lng: number; radius: number },
  category: { id: string; googleTypes: string[] },
  supabase: {
    from: (table: string) => {
      upsert: (
        data: DbPlace,
        options: { onConflict: string; ignoreDuplicates: boolean }
      ) => Promise<{ error: Error | null }>;
    };
  }
): Promise<{ processed: number; errors: number }> {
  let processed = 0;
  let errors = 0;

  try {
    const places = await searchNearbyPlaces({
      lat: neighborhood.lat,
      lng: neighborhood.lng,
      radius: neighborhood.radius,
      types: category.googleTypes,
    });

    for (const place of places) {
      const dbPlace = mapGooglePlaceToDb(place, neighborhood.id, category.id);

      // Calculate Google score
      dbPlace.google_score = calculateGoogleScore(
        dbPlace.rating,
        dbPlace.rating_count
      );

      // Initial final_score = google_score (no user data yet)
      dbPlace.final_score = dbPlace.google_score;

      const { error } = await supabase.from("places").upsert(dbPlace, {
        onConflict: "google_place_id",
        ignoreDuplicates: false,
      });

      if (error) {
        console.error(`Error upserting ${dbPlace.name}:`, error);
        errors++;
      } else {
        processed++;
      }
    }
  } catch (err) {
    console.error(
      `Error fetching ${category.id} in ${neighborhood.id}:`,
      err
    );
    errors++;
  }

  return { processed, errors };
}

/**
 * Calculate quality score from Google data using Bayesian average.
 *
 * Why Bayesian? A 4.9 with 10 reviews shouldn't beat a 4.5 with 2000 reviews.
 * We pull low-review places toward the mean.
 */
export function calculateGoogleScore(
  rating: number | null,
  ratingCount: number | null
): number {
  if (!rating || !ratingCount) return 0;

  // Atlanta average rating (prior)
  const PRIOR_RATING = 4.0;
  const PRIOR_COUNT = 30; // Weight of prior — effectively "30 fake reviews at 4.0"

  // Bayesian adjusted rating
  const adjustedRating =
    (rating * ratingCount + PRIOR_RATING * PRIOR_COUNT) /
    (ratingCount + PRIOR_COUNT);

  // Popularity factor (log scale — diminishing returns)
  // 10 reviews → 0.33, 100 → 0.67, 1000 → 1.0, 10000 → 1.33
  const popularityFactor = Math.log10(ratingCount + 1) / 3;

  // Base score from adjusted rating (scale 1-5 to 0-70)
  const ratingScore = ((adjustedRating - 1) / 4) * 70;

  // Popularity bonus (0-30 points)
  const popularityScore = Math.min(30, popularityFactor * 30);

  // Final score: 0-100
  return Math.round(ratingScore + popularityScore);
}
