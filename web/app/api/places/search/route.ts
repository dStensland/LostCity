import { NextRequest, NextResponse } from "next/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

// Foursquare Places API base URL (migrated from api.foursquare.com/v3)
const FOURSQUARE_BASE_URL = "https://places-api.foursquare.com";

// Get API key lazily to avoid build-time errors during static page generation
function getFoursquareApiKey(): string {
  const key = process.env.FOURSQUARE_API_KEY;
  if (!key && process.env.NODE_ENV === "production") {
    logger.error("FOURSQUARE_API_KEY environment variable is not set", new Error("Missing API key"));
  }
  return key || "";
}

// Default location: Atlanta
const DEFAULT_LOCATION = {
  lat: 33.749,
  lng: -84.388,
};

interface SearchRequest {
  query: string;
  location?: {
    lat: number;
    lng: number;
  };
}

interface PlaceResult {
  id: string;
  name: string;
  address: string;
  location: {
    lat: number;
    lng: number;
  };
  website?: string;
  category?: string;
  categoryName?: string;
}

interface FoursquareCategory {
  id: number;
  name: string;
  short_name?: string;
}

interface FoursquarePlace {
  fsq_place_id: string;
  name: string;
  latitude?: number;
  longitude?: number;
  location: {
    formatted_address?: string;
    address?: string;
    locality?: string;
    region?: string;
    postcode?: string;
    neighborhood?: string[];
  };
  categories?: FoursquareCategory[];
  website?: string;
}

/**
 * Places Search API endpoint using Foursquare.
 *
 * POST /api/places/search
 *
 * Body:
 * {
 *   query: string (required),
 *   location?: { lat: number, lng: number } (optional, defaults to Atlanta)
 * }
 *
 * Response:
 * {
 *   places: PlaceResult[]
 * }
 */
export async function POST(request: NextRequest) {
  // Rate limit - this calls external API so protect it
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.search, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  try {
    // Check API key
    const apiKey = getFoursquareApiKey();
    if (!apiKey) {
      logger.error("FOURSQUARE_API_KEY is not set", new Error("Missing API key"));
      return NextResponse.json(
        { error: "Places API is not configured" },
        { status: 500 }
      );
    }

    // Parse request body
    let body: SearchRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    const { query, location } = body;

    // Validate query
    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return NextResponse.json(
        { error: "Query parameter is required and must be a non-empty string" },
        { status: 400 }
      );
    }

    // Use provided location or default to Atlanta
    const searchLocation = location || DEFAULT_LOCATION;

    // Validate location if provided
    if (location) {
      if (
        typeof location.lat !== "number" ||
        typeof location.lng !== "number" ||
        isNaN(location.lat) ||
        isNaN(location.lng) ||
        location.lat < -90 ||
        location.lat > 90 ||
        location.lng < -180 ||
        location.lng > 180
      ) {
        return NextResponse.json(
          { error: "Invalid location coordinates" },
          { status: 400 }
        );
      }
    }

    // Call Foursquare Places API
    const params = new URLSearchParams({
      query: query,
      ll: `${searchLocation.lat},${searchLocation.lng}`,
      radius: "50000", // 50km radius
      limit: "10",
      fields: "fsq_place_id,name,location,categories,website,latitude,longitude",
    });

    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(
      `${FOURSQUARE_BASE_URL}/places/search?${params}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
          "X-Places-Api-Version": "2025-06-17",
        },
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(
        `Foursquare API error: ${response.status}`, errorText
      );
      return NextResponse.json(
        { error: "Failed to search places" },
        { status: response.status }
      );
    }

    const data = await response.json();
    const places: FoursquarePlace[] = data.results || [];

    // Map Foursquare category names to our venue types
    const mapFoursquareCategory = (categories: FoursquareCategory[] | undefined): string | undefined => {
      if (!categories || categories.length === 0) return undefined;
      const name = categories[0].name.toLowerCase();
      if (/bar|pub|lounge|cocktail|dive bar|speakeasy/.test(name)) return "bar";
      if (/restaurant|diner|cafe|eatery|bistro|grill|pizz|sushi|taco|burger|bbq|seafood|steakhouse/.test(name)) return "restaurant";
      if (/nightclub|dance club|disco/.test(name)) return "nightclub";
      if (/music venue|concert|jazz|blues club/.test(name)) return "music_venue";
      if (/comedy/.test(name)) return "comedy_club";
      if (/gallery|art/.test(name)) return "gallery";
      if (/museum/.test(name)) return "museum";
      if (/brew|taproom/.test(name)) return "brewery";
      if (/coffee|tea room/.test(name)) return "coffee_shop";
      if (/bookstore|book shop/.test(name)) return "bookstore";
      if (/movie|cinema|theater|theatre/.test(name)) return "cinema";
      if (/park|garden|trail/.test(name)) return "park";
      if (/market|farmer/.test(name)) return "farmers_market";
      if (/food hall|food court/.test(name)) return "food_hall";
      if (/arena|stadium/.test(name)) return "arena";
      if (/hotel|inn|motel/.test(name)) return "hotel";
      if (/gym|fitness|yoga|pilates/.test(name)) return "fitness_center";
      if (/distillery/.test(name)) return "distillery";
      if (/winery/.test(name)) return "winery";
      if (/sports bar/.test(name)) return "sports_bar";
      if (/record|vinyl/.test(name)) return "record_store";
      if (/church|mosque|temple|synagogue/.test(name)) return "church";
      if (/library/.test(name)) return "library";
      if (/event space|banquet|convention/.test(name)) return "event_space";
      if (/coworking/.test(name)) return "coworking";
      return undefined;
    };

    // Map to simplified format (using new API field names)
    const results: PlaceResult[] = places.map((place) => {
      // Build formatted address
      const loc = place.location || {};
      const address = loc.formatted_address ||
        [loc.address, loc.locality, loc.region, loc.postcode]
          .filter(Boolean)
          .join(", ");

      const mappedCategory = mapFoursquareCategory(place.categories);

      return {
        id: place.fsq_place_id,
        name: place.name,
        address: address || "",
        location: {
          lat: place.latitude || 0,
          lng: place.longitude || 0,
        },
        website: place.website || undefined,
        category: mappedCategory,
        categoryName: place.categories?.[0]?.name || undefined,
      };
    });

    return NextResponse.json(
      { places: results },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (error) {
    logger.error("Places search API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
