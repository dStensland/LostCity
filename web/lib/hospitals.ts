import { getDistanceMiles } from "@/lib/geo";
import { formatCloseTime, isOpenAt, type HoursData } from "@/lib/hours";
import { DEFAULT_HOSPITAL_MODE, type HospitalAudienceMode } from "@/lib/hospital-modes";
import { supabase } from "@/lib/supabase";

export type HospitalLocation = {
  id: string;
  portal_id: string;
  slug: string;
  name: string;
  short_name: string | null;
  address: string;
  neighborhood: string | null;
  lat: number;
  lng: number;
  phone: string | null;
  emergency_phone: string | null;
  website: string | null;
  gozio_deeplink: string | null;
  wayfinding_url: string | null;
  metadata: Record<string, unknown> | null;
};

export type HospitalService = {
  id: string;
  hospital_location_id: string;
  category: string;
  name: string;
  description: string | null;
  open_hours: string | null;
  location_hint: string | null;
  cta_label: string | null;
  cta_url: string | null;
  display_order: number;
};

export type HospitalNearbyVenue = {
  id: number;
  name: string;
  slug: string | null;
  address: string | null;
  neighborhood: string | null;
  city: string | null;
  venue_type: string | null;
  image_url: string | null;
  website: string | null;
  price_level: number | null;
  distance_miles: number;
  is_open_now: boolean;
  open_late: boolean;
  status_label: string;
  relevance_score: number;
  relevance_reason: string;
};

export type HospitalLandingData = {
  hospital: HospitalLocation;
  services: HospitalService[];
  nearby: {
    food: HospitalNearbyVenue[];
    stay: HospitalNearbyVenue[];
    late: HospitalNearbyVenue[];
    essentials: HospitalNearbyVenue[];
    services: HospitalNearbyVenue[];
    fitness: HospitalNearbyVenue[];
    escapes: HospitalNearbyVenue[];
  };
};

type HospitalNearbyCategory = keyof HospitalLandingData["nearby"];

export type HospitalWayfindingDestination = {
  id: string;
  name: string;
  category: "hospital" | "food" | "stay" | "late" | "essentials";
  address: string | null;
  lat: number | null;
  lng: number | null;
  distance_miles: number;
  relevance_score: number;
  launch_url: string;
  fallback_maps_url: string;
};

export type HospitalWayfindingPayload = {
  partner: "gozio";
  integration_status: "configured" | "assumed-demo";
  mode: HospitalAudienceMode;
  generated_at: string;
  hospital: {
    id: string;
    slug: string;
    name: string;
    address: string;
    lat: number;
    lng: number;
    phone: string | null;
    emergency_phone: string | null;
    launch_url: string;
    fallback_maps_url: string;
  };
  destinations: {
    food: HospitalWayfindingDestination[];
    stay: HospitalWayfindingDestination[];
    late: HospitalWayfindingDestination[];
    essentials: HospitalWayfindingDestination[];
  };
};

type VenueCandidate = {
  id: number;
  name: string;
  slug: string | null;
  address: string | null;
  neighborhood: string | null;
  city: string | null;
  lat: number | string | null;
  lng: number | string | null;
  venue_type: string | null;
  spot_types: string[] | null;
  hours: unknown;
  hours_display: string | null;
  price_level: number | null;
  image_url: string | null;
  website: string | null;
  active: boolean | null;
  is_adult: boolean | null;
};

const FOOD_VENUE_TYPES = new Set([
  "restaurant",
  "coffee_shop",
  "farmers_market",
]);

const STAY_VENUE_TYPES = new Set([
  "hotel",
]);

const LATE_FRIENDLY_KEYWORDS = /pharmacy|cvs|walgreens|\bmarket\b|diner|grill|coffee|cafe/i;
const ESSENTIAL_KEYWORDS = /laundry|laundromat|pharmacy|\bmarket\b|grocery|target|walgreens|cvs|\bups\b|fedex|urgent care/i;
const FITNESS_KEYWORDS = /\b(gym|fitness|yoga|pilates|crossfit|workout|strength|training|spin|barre|ymca|athletic)\b/i;
const ESCAPE_KEYWORDS = /\b(park|museum|garden|trail|library|gallery|theater|cinema|aquarium|arboretum|botanical|greenway)\b/i;
const SERVICE_KEYWORDS = /\b(urgent care|clinic|laundry|shipping|mail|bank|salon|barber|transport|pickup|delivery|supplies)\b/i;
const BAR_KEYWORDS = /\b(bar|taproom|brewery|brewpub|pub|cocktail|night ?club|lounge|speakeasy)\b/i;

function isTableMissing(message: string | undefined): boolean {
  if (!message) return false;
  return message.includes("relation") && message.includes("does not exist");
}

function toNumber(value: number | string | null): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeHours(value: unknown): HoursData | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as HoursData;
}

function isLikely24Hours(hoursDisplay: string | null): boolean {
  if (!hoursDisplay) return false;
  return /24\s*hours?|open\s*24/i.test(hoursDisplay);
}

function closeTimeToLateNightMinutes(closeTime: string | undefined): number | null {
  if (!closeTime) return null;
  const [rawHours, rawMinutes] = closeTime.split(":").map(Number);
  if (!Number.isFinite(rawHours) || !Number.isFinite(rawMinutes)) return null;
  let minutes = rawHours * 60 + rawMinutes;
  if (minutes < 6 * 60) minutes += 24 * 60;
  return minutes;
}

function isFoodVenue(venue: VenueCandidate): boolean {
  const type = (venue.venue_type || "").toLowerCase();
  if (FOOD_VENUE_TYPES.has(type)) return true;
  return /restaurant|cafe|coffee|eatery|kitchen|bbq|bistro|pizza|deli/i.test(venue.name);
}

function isStayVenue(venue: VenueCandidate): boolean {
  const type = (venue.venue_type || "").toLowerCase();
  if (STAY_VENUE_TYPES.has(type)) return true;
  return /hotel|inn|suites|resort/i.test(venue.name);
}

function isLateFriendlyVenue(venue: VenueCandidate): boolean {
  return isFoodVenue(venue) || isStayVenue(venue) || LATE_FRIENDLY_KEYWORDS.test(venue.name);
}

function isBarOrAlcoholVenue(venue: VenueCandidate): boolean {
  const type = (venue.venue_type || "").toLowerCase();
  if (type === "bar" || type === "brewery" || type === "nightclub") return true;
  return BAR_KEYWORDS.test(venue.name);
}

function isEssentialVenue(venue: VenueCandidate): boolean {
  const type = (venue.venue_type || "").toLowerCase();
  if (type === "pharmacy" || type === "market" || type === "grocery" || type === "urgent_care") {
    return true;
  }
  return ESSENTIAL_KEYWORDS.test(venue.name);
}

function isFitnessVenue(venue: VenueCandidate): boolean {
  const type = (venue.venue_type || "").toLowerCase();
  if (type === "fitness" || type === "wellness" || type === "gym") return true;
  return FITNESS_KEYWORDS.test(venue.name);
}

function isEscapeVenue(venue: VenueCandidate): boolean {
  const type = (venue.venue_type || "").toLowerCase();
  if (type === "park" || type === "museum" || type === "library" || type === "theater") return true;
  return ESCAPE_KEYWORDS.test(venue.name);
}

function isServiceVenue(venue: VenueCandidate): boolean {
  if (isFoodVenue(venue) || isStayVenue(venue) || isEssentialVenue(venue) || isFitnessVenue(venue) || isEscapeVenue(venue)) {
    return false;
  }
  const type = (venue.venue_type || "").toLowerCase();
  if (type === "service" || type === "clinic" || type === "urgent_care") return true;
  return SERVICE_KEYWORDS.test(venue.name);
}

function isPiedmontVenue(venue: VenueCandidate): boolean {
  return /piedmont/i.test(venue.name) || /piedmont/i.test(venue.slug || "");
}

export function getHospitalWayfindingHref(hospital: HospitalLocation): string {
  if (hospital.gozio_deeplink) return hospital.gozio_deeplink;
  if (hospital.wayfinding_url) return hospital.wayfinding_url;
  return `https://maps.google.com/?q=${encodeURIComponent(`${hospital.name} ${hospital.address}`)}`;
}

function readMetadataUrl(metadata: Record<string, unknown> | null, keys: string[]): string | null {
  if (!metadata) return null;
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("/")) {
      return trimmed;
    }
  }
  return null;
}

export function getHospitalBookVisitHref(hospital: HospitalLocation): string {
  const metadataUrl = readMetadataUrl(hospital.metadata, [
    "book_visit_url",
    "appointment_url",
    "appointments_url",
    "patient_portal_url",
    "visit_url",
  ]);
  if (metadataUrl) return metadataUrl;
  if (hospital.website) return hospital.website;
  return getHospitalWayfindingHref(hospital);
}

export function getVenueMapsHref(venue: Pick<HospitalNearbyVenue, "name" | "address">): string {
  const query = venue.address ? `${venue.name} ${venue.address}` : venue.name;
  return `https://maps.google.com/?q=${encodeURIComponent(query)}`;
}

function getModeWeights(mode: HospitalAudienceMode) {
  switch (mode) {
    case "urgent":
      return {
        distancePenalty: 12,
        openNowBoost: 28,
        openLateBoost: 30,
        lowCostBoost: 8,
        categoryBoost: { food: 8, stay: 2, late: 16, essentials: 18, services: 14, fitness: 8, escapes: 6 } as Record<HospitalNearbyCategory, number>,
      };
    case "treatment":
      return {
        distancePenalty: 8,
        openNowBoost: 10,
        openLateBoost: 6,
        lowCostBoost: 10,
        categoryBoost: { food: 6, stay: 20, late: 4, essentials: 9, services: 12, fitness: 10, escapes: 8 } as Record<HospitalNearbyCategory, number>,
      };
    case "staff":
      return {
        distancePenalty: 10,
        openNowBoost: 24,
        openLateBoost: 26,
        lowCostBoost: 6,
        categoryBoost: { food: 8, stay: 2, late: 20, essentials: 14, services: 16, fitness: 10, escapes: 8 } as Record<HospitalNearbyCategory, number>,
      };
    case "visitor":
    default:
      return {
        distancePenalty: 9,
        openNowBoost: 14,
        openLateBoost: 10,
        lowCostBoost: 7,
        categoryBoost: { food: 14, stay: 10, late: 5, essentials: 11, services: 10, fitness: 9, escapes: 9 } as Record<HospitalNearbyCategory, number>,
      };
  }
}

function getLateNightKeywordBoost(name: string, mode: HospitalAudienceMode): number {
  const lower = name.toLowerCase();
  if (!/pharmacy|urgent care|market|diner|cafe|coffee/.test(lower)) return 0;
  if (mode === "urgent") return 12;
  if (mode === "staff") return 8;
  return 4;
}

function scoreNearbyVenue(
  venue: HospitalNearbyVenue,
  category: HospitalNearbyCategory,
  mode: HospitalAudienceMode
): HospitalNearbyVenue {
  const weights = getModeWeights(mode);
  let score = 100 - venue.distance_miles * weights.distancePenalty + weights.categoryBoost[category];
  const reasons: string[] = [];

  if (venue.is_open_now) {
    score += weights.openNowBoost;
    reasons.push("open now");
  }
  if (venue.open_late) {
    score += weights.openLateBoost;
    reasons.push("open late");
  }
  if (venue.price_level !== null && venue.price_level <= 2) {
    score += weights.lowCostBoost;
    reasons.push("lower cost");
  }

  const keywordBoost = getLateNightKeywordBoost(venue.name, mode);
  if (keywordBoost > 0) {
    score += keywordBoost;
    reasons.push("high utility");
  }

  if (mode === "treatment" && category === "stay" && venue.distance_miles <= 2) {
    score += 12;
    reasons.push("close for recurring visits");
  }

  if (mode === "visitor" && category === "food" && venue.distance_miles <= 1.5) {
    score += 8;
    reasons.push("easy visitor access");
  }

  return {
    ...venue,
    relevance_score: Number(score.toFixed(1)),
    relevance_reason: reasons[0] || "distance and availability",
  };
}

function rankNearbyVenues(
  venues: HospitalNearbyVenue[],
  category: HospitalNearbyCategory,
  mode: HospitalAudienceMode
): HospitalNearbyVenue[] {
  return venues
    .map((venue) => scoreNearbyVenue(venue, category, mode))
    .sort((a, b) => b.relevance_score - a.relevance_score || a.distance_miles - b.distance_miles);
}

export async function getPortalHospitalLocations(portalId: string): Promise<HospitalLocation[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("portal_hospital_locations")
    .select(`
      id,
      portal_id,
      slug,
      name,
      short_name,
      address,
      neighborhood,
      lat,
      lng,
      phone,
      emergency_phone,
      website,
      gozio_deeplink,
      wayfinding_url,
      metadata
    `)
    .eq("portal_id", portalId)
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    if (isTableMissing(error.message)) return [];
    console.error("Error fetching portal hospitals:", error);
    return [];
  }

  return ((data || []) as Record<string, unknown>[])
    .map((row) => {
      const lat = toNumber((row.lat as number | string | null) ?? null);
      const lng = toNumber((row.lng as number | string | null) ?? null);
      if (lat === null || lng === null) return null;

      return {
        id: String(row.id),
        portal_id: String(row.portal_id),
        slug: String(row.slug),
        name: String(row.name),
        short_name: (row.short_name as string | null) ?? null,
        address: String(row.address),
        neighborhood: (row.neighborhood as string | null) ?? null,
        lat,
        lng,
        phone: (row.phone as string | null) ?? null,
        emergency_phone: (row.emergency_phone as string | null) ?? null,
        website: (row.website as string | null) ?? null,
        gozio_deeplink: (row.gozio_deeplink as string | null) ?? null,
        wayfinding_url: (row.wayfinding_url as string | null) ?? null,
        metadata: (row.metadata as Record<string, unknown> | null) ?? null,
      } satisfies HospitalLocation;
    })
    .filter((location): location is HospitalLocation => location !== null);
}

async function getHospitalServices(hospitalLocationId: string): Promise<HospitalService[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("portal_hospital_services")
    .select(`
      id,
      hospital_location_id,
      category,
      name,
      description,
      open_hours,
      location_hint,
      cta_label,
      cta_url,
      display_order
    `)
    .eq("hospital_location_id", hospitalLocationId)
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (error) {
    if (isTableMissing(error.message)) return [];
    console.error("Error fetching hospital services:", error);
    return [];
  }

  return ((data || []) as HospitalService[]);
}

async function getNearbyHospitalVenues(
  hospital: HospitalLocation,
  mode: HospitalAudienceMode
): Promise<HospitalLandingData["nearby"]> {
  // ~8 mile bounding box in Atlanta metro.
  const latDelta = 0.14;
  const lngDelta = 0.14;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("venues")
    .select(`
      id,
      name,
      slug,
      address,
      neighborhood,
      city,
      lat,
      lng,
      venue_type,
      spot_types,
      hours,
      hours_display,
      price_level,
      image_url,
      website,
      active,
      is_adult
    `)
    .gte("lat", hospital.lat - latDelta)
    .lte("lat", hospital.lat + latDelta)
    .gte("lng", hospital.lng - lngDelta)
    .lte("lng", hospital.lng + lngDelta)
    .limit(650);

  if (error) {
    console.error("Error fetching nearby venues:", error);
    return { food: [], stay: [], late: [], essentials: [], services: [], fitness: [], escapes: [] };
  }

  const now = new Date();
  const lateCheck = new Date(now);
  lateCheck.setHours(22, 30, 0, 0);

  const normalized = ((data || []) as VenueCandidate[])
    .filter((venue) => venue.active !== false)
    .filter((venue) => venue.is_adult !== true)
    .filter((venue) => !isPiedmontVenue(venue))
    .map((venue) => {
      const lat = toNumber(venue.lat);
      const lng = toNumber(venue.lng);
      if (lat === null || lng === null) return null;

      const distanceMiles = getDistanceMiles(hospital.lat, hospital.lng, lat, lng);
      if (distanceMiles > 3.5) return null;

      const hours = normalizeHours(venue.hours);
      const is24Hours = isLikely24Hours(venue.hours_display);
      const openNow = isOpenAt(hours, now, is24Hours);
      const openLate = isOpenAt(hours, lateCheck, is24Hours).isOpen;
      const lateCloseMinutes = closeTimeToLateNightMinutes(openNow.closesAt);
      const closesLate = lateCloseMinutes !== null && lateCloseMinutes >= 22 * 60;

      let statusLabel = "Hours vary";
      if (is24Hours) {
        statusLabel = "Open 24 hours";
      } else if (openNow.isOpen && openNow.closesAt) {
        statusLabel = `Open now · closes ${formatCloseTime(openNow.closesAt)}`;
      } else if (openLate) {
        statusLabel = "Open late";
      } else if (venue.hours_display) {
        statusLabel = venue.hours_display;
      }

      return {
        id: venue.id,
        name: venue.name,
        slug: venue.slug,
        address: venue.address,
        neighborhood: venue.neighborhood,
        city: venue.city,
        venue_type: venue.venue_type,
        image_url: venue.image_url,
        website: venue.website,
        price_level: venue.price_level,
        distance_miles: Number(distanceMiles.toFixed(1)),
        is_open_now: openNow.isOpen,
        open_late: openLate || closesLate || is24Hours,
        status_label: statusLabel,
        relevance_score: 0,
        relevance_reason: "distance and availability",
      } satisfies HospitalNearbyVenue;
    })
    .filter((venue): venue is HospitalNearbyVenue => venue !== null)
    .sort((a, b) => a.distance_miles - b.distance_miles);

  const sourceById = new Map<number, VenueCandidate>();
  for (const venue of (data || []) as VenueCandidate[]) {
    sourceById.set(venue.id, venue);
  }

  const food = rankNearbyVenues(
    normalized
    .filter((venue) => {
      const source = sourceById.get(venue.id);
      return source ? isFoodVenue(source) && !isBarOrAlcoholVenue(source) : false;
    })
      .filter((venue) => venue.distance_miles <= 2.2)
      .slice(0, 32),
    "food",
    mode
  ).slice(0, 10);

  const stay = rankNearbyVenues(
    normalized
    .filter((venue) => {
      const source = sourceById.get(venue.id);
      return source ? isStayVenue(source) : false;
    })
      .filter((venue) => venue.distance_miles <= 3.2)
      .slice(0, 26),
    "stay",
    mode
  ).slice(0, 8);

  const lateCandidates = normalized
    .filter((venue) => {
      const source = sourceById.get(venue.id);
      if (!source) return false;
      return (
        venue.open_late
        && (isLateFriendlyVenue(source) || isEssentialVenue(source) || isBarOrAlcoholVenue(source))
      );
    })
    .filter((venue) => venue.distance_miles <= 2.6);

  const lateNonBarCandidates = lateCandidates.filter((venue) => {
    const source = sourceById.get(venue.id);
    if (!source) return false;
    return !isBarOrAlcoholVenue(source);
  });

  const latePool = (lateNonBarCandidates.length > 0 ? lateNonBarCandidates : lateCandidates).slice(0, 30);

  const late = rankNearbyVenues(latePool, "late", mode).slice(0, 10);

  const essentials = rankNearbyVenues(
    normalized
      .filter((venue) => {
        const source = sourceById.get(venue.id);
        return source ? isEssentialVenue(source) : false;
      })
      .filter((venue) => venue.distance_miles <= 2.8)
      .slice(0, 30),
    "essentials",
    mode
  ).slice(0, 10);

  const fitness = rankNearbyVenues(
    normalized
      .filter((venue) => {
        const source = sourceById.get(venue.id);
        return source ? isFitnessVenue(source) : false;
      })
      .filter((venue) => venue.distance_miles <= 2.8)
      .slice(0, 30),
    "fitness",
    mode
  ).slice(0, 10);

  const escapes = rankNearbyVenues(
    normalized
      .filter((venue) => {
        const source = sourceById.get(venue.id);
        return source ? isEscapeVenue(source) : false;
      })
      .filter((venue) => venue.distance_miles <= 2.8)
      .slice(0, 30),
    "escapes",
    mode
  ).slice(0, 10);

  const services = rankNearbyVenues(
    normalized
      .filter((venue) => {
        const source = sourceById.get(venue.id);
        return source ? isServiceVenue(source) : false;
      })
      .filter((venue) => venue.distance_miles <= 2.8)
      .slice(0, 30),
    "services",
    mode
  ).slice(0, 10);

  return { food, stay, late, essentials, services, fitness, escapes };
}

export async function getHospitalLandingData(
  portalId: string,
  hospitalSlug: string,
  mode: HospitalAudienceMode = DEFAULT_HOSPITAL_MODE
): Promise<HospitalLandingData | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("portal_hospital_locations")
    .select(`
      id,
      portal_id,
      slug,
      name,
      short_name,
      address,
      neighborhood,
      lat,
      lng,
      phone,
      emergency_phone,
      website,
      gozio_deeplink,
      wayfinding_url,
      metadata
    `)
    .eq("portal_id", portalId)
    .eq("slug", hospitalSlug)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) {
    if (error && !isTableMissing(error.message)) {
      console.error("Error fetching hospital landing data:", error);
    }
    return null;
  }

  const lat = toNumber((data.lat as number | string | null) ?? null);
  const lng = toNumber((data.lng as number | string | null) ?? null);

  if (lat === null || lng === null) {
    return null;
  }

  const hospital: HospitalLocation = {
    id: String(data.id),
    portal_id: String(data.portal_id),
    slug: String(data.slug),
    name: String(data.name),
    short_name: (data.short_name as string | null) ?? null,
    address: String(data.address),
    neighborhood: (data.neighborhood as string | null) ?? null,
    lat,
    lng,
    phone: (data.phone as string | null) ?? null,
    emergency_phone: (data.emergency_phone as string | null) ?? null,
    website: (data.website as string | null) ?? null,
    gozio_deeplink: (data.gozio_deeplink as string | null) ?? null,
    wayfinding_url: (data.wayfinding_url as string | null) ?? null,
    metadata: (data.metadata as Record<string, unknown> | null) ?? null,
  };

  const [services, nearby] = await Promise.all([
    getHospitalServices(hospital.id),
    getNearbyHospitalVenues(hospital, mode),
  ]);

  return {
    hospital,
    services,
    nearby,
  };
}

export function getHospitalWayfindingPayload(args: {
  hospital: HospitalLocation;
  nearby: HospitalLandingData["nearby"];
  mode: HospitalAudienceMode;
}): HospitalWayfindingPayload {
  const { hospital, nearby, mode } = args;
  const mapsHref = `https://maps.google.com/?q=${encodeURIComponent(`${hospital.name} ${hospital.address}`)}`;
  const launchUrl = getHospitalWayfindingHref(hospital);
  const integrationStatus = hospital.gozio_deeplink ? "configured" : "assumed-demo";

  const toDestination = (
    venue: HospitalNearbyVenue,
    category: HospitalWayfindingDestination["category"]
  ): HospitalWayfindingDestination => ({
    id: `${category}-${venue.id}`,
    name: venue.name,
    category,
    address: venue.address,
    lat: null,
    lng: null,
    distance_miles: venue.distance_miles,
    relevance_score: venue.relevance_score,
    launch_url: getVenueMapsHref(venue),
    fallback_maps_url: getVenueMapsHref(venue),
  });

  return {
    partner: "gozio",
    integration_status: integrationStatus,
    mode,
    generated_at: new Date().toISOString(),
    hospital: {
      id: hospital.id,
      slug: hospital.slug,
      name: hospital.name,
      address: hospital.address,
      lat: hospital.lat,
      lng: hospital.lng,
      phone: hospital.phone,
      emergency_phone: hospital.emergency_phone,
      launch_url: launchUrl,
      fallback_maps_url: mapsHref,
    },
    destinations: {
      food: nearby.food.slice(0, 8).map((venue) => toDestination(venue, "food")),
      stay: nearby.stay.slice(0, 8).map((venue) => toDestination(venue, "stay")),
      late: nearby.late.slice(0, 8).map((venue) => toDestination(venue, "late")),
      essentials: nearby.essentials.slice(0, 8).map((venue) => toDestination(venue, "essentials")),
    },
  };
}
