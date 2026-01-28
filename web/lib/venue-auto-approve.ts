import { createServiceClient } from "@/lib/supabase/service";
import { isValidString } from "@/lib/api-utils";

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY || "";

export interface AutoApproveResult {
  success: boolean;
  venue?: { id: number; name: string; slug: string };
  error?: string;
}

interface GooglePlaceDetails {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  addressComponents?: Array<{
    longText: string;
    shortText: string;
    types: string[];
  }>;
  location?: { latitude: number; longitude: number };
}

/**
 * Fetch place details from Google Places API
 */
async function fetchGooglePlaceDetails(
  googlePlaceId: string
): Promise<GooglePlaceDetails | null> {
  if (!GOOGLE_API_KEY) {
    console.error("GOOGLE_PLACES_API_KEY is not set");
    return null;
  }

  const response = await fetch(
    `https://places.googleapis.com/v1/places/${googlePlaceId}`,
    {
      method: "GET",
      headers: {
        "X-Goog-Api-Key": GOOGLE_API_KEY,
        "X-Goog-FieldMask":
          "id,displayName,formattedAddress,addressComponents,location",
      },
    }
  );

  if (!response.ok) {
    console.error(
      `Google Places API error: ${response.status}`,
      await response.text()
    );
    return null;
  }

  return (await response.json()) as GooglePlaceDetails;
}

/**
 * Parse address components from Google Place
 */
function parseAddressComponents(components: GooglePlaceDetails["addressComponents"]) {
  const result = {
    neighborhood: null as string | null,
    city: "Atlanta",
    state: "GA",
    zip: null as string | null,
  };

  if (!components) return result;

  for (const component of components) {
    if (component.types.includes("locality")) {
      result.city = component.longText;
    } else if (component.types.includes("administrative_area_level_1")) {
      result.state = component.shortText;
    } else if (component.types.includes("postal_code")) {
      result.zip = component.shortText;
    } else if (component.types.includes("neighborhood")) {
      result.neighborhood = component.longText;
    }
  }

  return result;
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
 * Auto-approve a venue with Google Place validation
 *
 * This function:
 * 1. Validates the Place ID with Google Places API
 * 2. Checks if venue already exists
 * 3. Creates a new venue with Google data if needed
 * 4. Creates an approved submission record
 * 5. Returns the venue data
 *
 * @param googlePlaceId - Google Place ID to validate
 * @param submittedBy - User ID who submitted the venue
 * @param portalId - Optional portal ID for the submission
 * @returns Result object with success status and venue data or error
 */
export async function autoApproveVenue(
  googlePlaceId: string,
  submittedBy: string,
  portalId?: string
): Promise<AutoApproveResult> {
  // Validate inputs
  if (!isValidString(googlePlaceId, 1, 500)) {
    return {
      success: false,
      error: "Invalid Google Place ID",
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
    // Check if venue with this google_place_id already exists
    const { data: existingVenue } = await serviceClient
      .from("venues")
      .select("id, name, slug")
      .eq("google_place_id", googlePlaceId)
      .maybeSingle();

    if (existingVenue) {
      return {
        success: true,
        venue: existingVenue as { id: number; name: string; slug: string },
      };
    }

    // Fetch place details from Google
    const placeDetails = await fetchGooglePlaceDetails(googlePlaceId);
    if (!placeDetails) {
      return {
        success: false,
        error: "Failed to fetch place details from Google Places API",
      };
    }

    const name = placeDetails.displayName?.text;
    if (!name) {
      return {
        success: false,
        error: "Place name not found in Google Places API response",
      };
    }

    // Parse address components
    const addressData = parseAddressComponents(placeDetails.addressComponents);

    // Generate unique slug
    const slug = await generateUniqueSlug(name, serviceClient);

    // Create the venue
    const { data: newVenue, error: insertError } = await serviceClient
      .from("venues")
      .insert({
        name,
        slug,
        address: placeDetails.formattedAddress || null,
        neighborhood: addressData.neighborhood,
        city: addressData.city,
        state: addressData.state,
        zip: addressData.zip,
        lat: placeDetails.location?.latitude ?? null,
        lng: placeDetails.location?.longitude ?? null,
        google_place_id: googlePlaceId,
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
          address: placeDetails.formattedAddress,
          google_place_id: googlePlaceId,
        },
        approved_venue_id: venue.id,
        reviewed_at: new Date().toISOString(),
        admin_notes: "Auto-approved via Google Place ID validation",
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
