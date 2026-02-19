import { createServiceClient } from "@/lib/supabase/service";
import { isValidString } from "@/lib/api-utils";
import { resolveNeighborhood } from "@/lib/geo";
import { normalizeNeighborhoodName } from "@/config/neighborhoods";

// Foursquare Places API base URL (migrated from api.foursquare.com/v3)
const FOURSQUARE_BASE_URL = "https://places-api.foursquare.com";

// Get API key lazily to avoid build-time errors during static page generation
function getFoursquareApiKey(): string {
  const key = process.env.FOURSQUARE_API_KEY;
  if (!key && process.env.NODE_ENV === "production") {
    console.error("FOURSQUARE_API_KEY environment variable is not set");
  }
  return key || "";
}

export interface AutoApproveResult {
  success: boolean;
  venue?: { id: number; name: string; slug: string };
  error?: string;
}

interface FoursquarePlaceDetails {
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
}

/**
 * Fetch place details from Foursquare Places API
 */
async function fetchFoursquarePlaceDetails(
  fsqId: string
): Promise<FoursquarePlaceDetails | null> {
  const apiKey = getFoursquareApiKey();
  if (!apiKey) {
    console.error("FOURSQUARE_API_KEY is not set");
    return null;
  }

  const response = await fetch(
    `${FOURSQUARE_BASE_URL}/places/${fsqId}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
        "X-Places-Api-Version": "2025-06-17",
      },
    }
  );

  if (!response.ok) {
    console.error(
      `Foursquare API error: ${response.status}`,
      await response.text()
    );
    return null;
  }

  return (await response.json()) as FoursquarePlaceDetails;
}

/**
 * Parse address components from Foursquare Place
 */
function parseAddressComponents(location: FoursquarePlaceDetails["location"]) {
  return {
    neighborhood: location.neighborhood?.[0] || null,
    city: location.locality || "Atlanta",
    state: location.region || "GA",
    zip: location.postcode || null,
  };
}

/**
 * Generate a unique slug from a name
 */
async function generateUniqueSlug(
  name: string,
  supabase: ReturnType<typeof createServiceClient>
): Promise<string> {
  const baseSlug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  // Check if slug exists
  const { data: existing } = await supabase
    .from("venues")
    .select("id")
    .eq("slug", baseSlug)
    .maybeSingle();

  if (!existing) {
    return baseSlug;
  }

  // If exists, add a unique suffix
  return `${baseSlug}-${Date.now().toString(36)}`;
}

/**
 * Auto-approve a venue with Foursquare Place validation
 *
 * This function:
 * 1. Validates the Place ID with Foursquare Places API
 * 2. Checks if venue already exists
 * 3. Creates a new venue with Foursquare data if needed
 * 4. Creates an approved submission record
 * 5. Returns the venue data
 *
 * @param placeId - Foursquare Place ID to validate
 * @param submittedBy - User ID who submitted the venue
 * @param portalId - Optional portal ID for the submission
 * @returns Result object with success status and venue data or error
 */
export async function autoApproveVenue(
  placeId: string,
  submittedBy: string,
  portalId?: string
): Promise<AutoApproveResult> {
  // Validate inputs
  if (!isValidString(placeId, 1, 500)) {
    return {
      success: false,
      error: "Invalid Place ID",
    };
  }

  if (!isValidString(submittedBy, 1, 500)) {
    return {
      success: false,
      error: "Invalid submittedBy user ID",
    };
  }

  const serviceClient = createServiceClient();

  try {
    // Check if venue with this place_id already exists (check both fields for compatibility)
    const { data: existingVenue } = await serviceClient
      .from("venues")
      .select("id, name, slug")
      .or(`google_place_id.eq.${placeId},foursquare_id.eq.${placeId}`)
      .maybeSingle();

    if (existingVenue) {
      return {
        success: true,
        venue: existingVenue as { id: number; name: string; slug: string },
      };
    }

    // Fetch place details from Foursquare
    const placeDetails = await fetchFoursquarePlaceDetails(placeId);
    if (!placeDetails) {
      return {
        success: false,
        error: "Failed to fetch place details from Foursquare API",
      };
    }

    const name = placeDetails.name;
    if (!name) {
      return {
        success: false,
        error: "Place name not found in Foursquare API response",
      };
    }

    // Parse address components
    const addressData = parseAddressComponents(placeDetails.location);

    // Build formatted address
    const loc = placeDetails.location;
    const formattedAddress = loc.formatted_address ||
      [loc.address, loc.locality, loc.region, loc.postcode]
        .filter(Boolean)
        .join(", ");

    // Generate unique slug
    const slug = await generateUniqueSlug(name, serviceClient);

    // Resolve neighborhood via polygon boundaries, fall back to Foursquare
    const lat = placeDetails.latitude ?? null;
    const lng = placeDetails.longitude ?? null;
    let neighborhood: string | null = null;
    if (lat !== null && lng !== null) {
      neighborhood = resolveNeighborhood(lat, lng);
    }
    if (!neighborhood) {
      const fsqHood = addressData.neighborhood;
      neighborhood = fsqHood ? normalizeNeighborhoodName(fsqHood) : null;
    }

    // Create the venue
    const { data: newVenue, error: insertError } = await serviceClient
      .from("venues")
      .insert({
        name,
        slug,
        address: formattedAddress || null,
        neighborhood,
        city: addressData.city,
        state: addressData.state,
        zip: addressData.zip,
        lat: placeDetails.latitude ?? null,
        lng: placeDetails.longitude ?? null,
        foursquare_id: placeId,
        submitted_by: submittedBy,
        active: true,
      } as never)
      .select("id, name, slug")
      .maybeSingle();

    if (insertError || !newVenue) {
      console.error("Failed to create venue:", insertError);
      return {
        success: false,
        error: insertError?.message || "Failed to create venue",
      };
    }

    const venue = newVenue as { id: number; name: string; slug: string };

    // Create an approved submission record
    const { error: submissionError } = await serviceClient
      .from("submissions")
      .insert({
        submission_type: "venue",
        status: "approved",
        submitted_by: submittedBy,
        portal_id: portalId || null,
        data: {
          name,
          address: formattedAddress,
          foursquare_id: placeId,
        },
        approved_venue_id: venue.id,
        reviewed_at: new Date().toISOString(),
        admin_notes: "Auto-approved via Foursquare Place ID validation",
      } as never);

    if (submissionError) {
      console.error("Failed to create submission record:", submissionError);
      // Don't fail the whole operation since venue was created successfully
    }

    return {
      success: true,
      venue,
    };
  } catch (error) {
    console.error("Error in autoApproveVenue:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}
