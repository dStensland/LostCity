import { NextRequest, NextResponse } from "next/server";

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY || "";

// Default location: Atlanta
const DEFAULT_LOCATION = {
  lat: 33.749,
  lng: -84.388,
};

// Field mask for Text Search API - simplified for search results
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
].join(",");

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
}

/**
 * Google Places Text Search API endpoint.
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
  try {
    // Check API key
    if (!GOOGLE_API_KEY) {
      console.error("GOOGLE_PLACES_API_KEY is not set");
      return NextResponse.json(
        { error: "Google Places API is not configured" },
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

    // Call Google Places Text Search API
    const response = await fetch(
      "https://places.googleapis.com/v1/places:searchText",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": GOOGLE_API_KEY,
          "X-Goog-FieldMask": FIELD_MASK,
        },
        body: JSON.stringify({
          textQuery: query,
          locationBias: {
            circle: {
              center: {
                latitude: searchLocation.lat,
                longitude: searchLocation.lng,
              },
              radius: 50000, // 50km radius for biasing results
            },
          },
          maxResultCount: 20,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `Google Places API error: ${response.status}`,
        errorText
      );
      return NextResponse.json(
        { error: "Failed to search places" },
        { status: response.status }
      );
    }

    const data = await response.json();
    const places = data.places || [];

    // Map to simplified format
    const results: PlaceResult[] = places.map((place: { id: string; displayName?: { text: string }; formattedAddress?: string; location?: { latitude: number; longitude: number } }) => ({
      id: place.id,
      name: place.displayName?.text || "Unknown",
      address: place.formattedAddress || "",
      location: {
        lat: place.location?.latitude || 0,
        lng: place.location?.longitude || 0,
      },
    }));

    return NextResponse.json(
      { places: results },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (error) {
    console.error("Places search API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
