import { NextRequest, NextResponse } from "next/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

const secret = process.env.FOURSQUARE_API_KEY;
if (!secret && process.env.NODE_ENV === "production") {
  throw new Error("FOURSQUARE_API_KEY environment variable is required in production");
}
const FOURSQUARE_API_KEY = secret || "";

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
}

interface FoursquarePlace {
  fsq_id: string;
  name: string;
  location: {
    formatted_address?: string;
    address?: string;
    locality?: string;
    region?: string;
    postcode?: string;
  };
  geocodes?: {
    main?: {
      latitude: number;
      longitude: number;
    };
  };
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
    if (!FOURSQUARE_API_KEY) {
      console.error("FOURSQUARE_API_KEY is not set");
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
    });

    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(
      `https://api.foursquare.com/v3/places/search?${params}`,
      {
        method: "GET",
        headers: {
          Authorization: FOURSQUARE_API_KEY,
          Accept: "application/json",
        },
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `Foursquare API error: ${response.status}`,
        errorText
      );
      return NextResponse.json(
        { error: "Failed to search places" },
        { status: response.status }
      );
    }

    const data = await response.json();
    const places: FoursquarePlace[] = data.results || [];

    // Map to simplified format
    const results: PlaceResult[] = places.map((place) => {
      // Build formatted address
      const loc = place.location;
      const address = loc.formatted_address ||
        [loc.address, loc.locality, loc.region, loc.postcode]
          .filter(Boolean)
          .join(", ");

      return {
        id: place.fsq_id,
        name: place.name,
        address: address || "",
        location: {
          lat: place.geocodes?.main?.latitude || 0,
          lng: place.geocodes?.main?.longitude || 0,
        },
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
    console.error("Places search API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
