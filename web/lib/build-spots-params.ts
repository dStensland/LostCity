/**
 * Shared utility to build /api/spots query parameters from URL search params.
 * Used by both PortalSpotsView (list mode) and useMapSpots (map mode) to avoid
 * duplicating filter-to-API-param translation logic.
 */

interface BuildSpotsParamsOptions {
  portalId?: string;
  isExclusive?: boolean;
  searchParams: URLSearchParams;
}

export function buildSpotsApiParams({
  portalId,
  isExclusive,
  searchParams,
}: BuildSpotsParamsOptions): URLSearchParams {
  const params = new URLSearchParams();

  if (portalId && portalId !== "default") {
    params.set("portal_id", portalId);
  }
  if (isExclusive) {
    params.set("exclusive", "true");
  }

  const search = searchParams.get("search");
  const openNow = searchParams.get("open_now");
  const withEvents = searchParams.get("with_events");
  const priceLevel = searchParams.get("price_level");
  const venueType = searchParams.get("venue_type");
  const venueTypes = searchParams.get("venue_types"); // Plural form from quick links
  const cuisine = searchParams.get("cuisine");
  // Support both plural (URL) and singular (API) param names
  const neighborhoods = searchParams.get("neighborhoods") || searchParams.get("neighborhood");
  const vibes = searchParams.get("vibes");
  const genres = searchParams.get("genres");

  if (search) params.set("q", search);
  if (openNow === "true") params.set("open_now", "true");
  if (withEvents === "true") params.set("with_events", "true");
  if (priceLevel) params.set("price_level", priceLevel);
  if (venueType) params.set("venue_type", venueType);
  else if (venueTypes) params.set("venue_type", venueTypes); // Normalize plural→singular
  if (cuisine) params.set("cuisine", cuisine);
  if (neighborhoods) params.set("neighborhood", neighborhoods);
  if (vibes) params.set("vibes", vibes);
  if (genres) params.set("genres", genres);

  return params;
}
