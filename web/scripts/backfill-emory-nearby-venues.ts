import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY in web/.env.local");
}

if (!GOOGLE_PLACES_API_KEY) {
  throw new Error("Missing GOOGLE_PLACES_API_KEY in web/.env.local");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const SEARCH_RADIUS_METERS = 3219; // 2 miles
const SEARCH_TYPES = [
  "restaurant",
  "meal_takeaway",
  "cafe",
  "coffee_shop",
  "bakery",
  "hotel",
  "lodging",
  "pharmacy",
  "drugstore",
  "grocery_store",
  "supermarket",
  "convenience_store",
];

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
  "places.googleMapsUri",
].join(",");

type HospitalLocationRow = {
  id: string;
  slug: string;
  name: string;
  neighborhood: string | null;
  lat: number;
  lng: number;
};

type VenueRow = {
  id: number;
  name: string;
  slug: string;
  address: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  lat: number | null;
  lng: number | null;
  venue_type: string | null;
  spot_type: string | null;
  spot_types: string[] | null;
  website: string | null;
  aliases: string[] | null;
  active: boolean | null;
  is_adult: boolean | null;
};

type GooglePlace = {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  types?: string[];
  primaryType?: string;
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  regularOpeningHours?: {
    periods?: Array<{
      open?: { day?: number; hour?: number; minute?: number };
      close?: { day?: number; hour?: number; minute?: number };
    }>;
    weekdayDescriptions?: string[];
  };
  websiteUri?: string;
  googleMapsUri?: string;
};

type VenueClassification = {
  venueType: string;
  spotType: string;
  spotTypes: string[];
};

const PRICE_LEVEL_MAP: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

function parseArgs() {
  const dryRun = process.argv.includes("--dry-run");
  const limitArg = process.argv.find((arg) => arg.startsWith("--limit-per-type="));
  const limitPerType = limitArg ? Number(limitArg.split("=")[1]) : 20;
  return {
    dryRun,
    limitPerType: Number.isFinite(limitPerType) && limitPerType > 0 ? Math.min(limitPerType, 20) : 20,
  };
}

function normalizeText(value: string | null | undefined): string {
  return (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 80);
}

function parseCityState(address: string | null | undefined): { city: string; state: string } {
  if (!address) return { city: "Atlanta", state: "GA" };
  const parts = address.split(",").map((part) => part.trim()).filter(Boolean);
  const city = parts.length >= 2 ? parts[parts.length - 3] || parts[parts.length - 2] : "Atlanta";
  const statePart = parts.length >= 2 ? parts[parts.length - 2] || "GA" : "GA";
  const stateMatch = statePart.match(/\b([A-Z]{2})\b/);
  return {
    city: city || "Atlanta",
    state: stateMatch ? stateMatch[1] : "GA",
  };
}

function classifyPlace(place: GooglePlace): VenueClassification {
  const primary = (place.primaryType || "").toLowerCase();
  const types = new Set((place.types || []).map((value) => value.toLowerCase()));
  const hasType = (value: string) => primary === value || types.has(value);

  if (hasType("coffee_shop") || hasType("cafe") || hasType("tea_house")) {
    return { venueType: "coffee_shop", spotType: "coffee_shop", spotTypes: ["coffee_shop", "cafe", "food"] };
  }
  if (hasType("restaurant") || hasType("meal_takeaway") || hasType("bakery")) {
    return { venueType: "restaurant", spotType: "restaurant", spotTypes: ["restaurant", "food"] };
  }
  if (hasType("hotel") || hasType("lodging")) {
    return { venueType: "hotel", spotType: "hotel", spotTypes: ["hotel"] };
  }
  if (hasType("pharmacy") || hasType("drugstore")) {
    return { venueType: "pharmacy", spotType: "pharmacy", spotTypes: ["pharmacy", "services"] };
  }
  if (hasType("grocery_store") || hasType("supermarket") || hasType("convenience_store")) {
    return { venueType: "market", spotType: "food", spotTypes: ["food", "shopping"] };
  }
  return { venueType: "venue", spotType: "venue", spotTypes: ["venue"] };
}

function toHoursJson(place: GooglePlace): Record<string, { open: string; close: string }> | null {
  const periods = place.regularOpeningHours?.periods;
  if (!periods || periods.length === 0) return null;

  const byDay = new Map<number, { open: string; close: string }>();
  for (const period of periods) {
    const day = period.open?.day;
    if (day === undefined || day < 0 || day > 6) continue;
    const openHour = period.open?.hour ?? 0;
    const openMinute = period.open?.minute ?? 0;
    const closeHour = period.close?.hour ?? 23;
    const closeMinute = period.close?.minute ?? 59;
    const open = `${String(openHour).padStart(2, "0")}:${String(openMinute).padStart(2, "0")}`;
    const close = `${String(closeHour).padStart(2, "0")}:${String(closeMinute).padStart(2, "0")}`;

    const existing = byDay.get(day);
    if (!existing) {
      byDay.set(day, { open, close });
      continue;
    }
    byDay.set(day, {
      open: open < existing.open ? open : existing.open,
      close: close > existing.close ? close : existing.close,
    });
  }

  const result: Record<string, { open: string; close: string }> = {};
  for (let day = 0; day < DAY_KEYS.length; day += 1) {
    const key = DAY_KEYS[day];
    const value = byDay.get(day);
    if (value) result[key] = value;
  }
  return Object.keys(result).length > 0 ? result : null;
}

function toHoursDisplay(place: GooglePlace): string | null {
  const weekdayDescriptions = place.regularOpeningHours?.weekdayDescriptions || [];
  if (weekdayDescriptions.length === 0) return null;
  return weekdayDescriptions.join("\n");
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function getDistanceMiles(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const earthMiles = 3958.8;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const a =
    sinLat * sinLat
    + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * sinLng * sinLng;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthMiles * c;
}

async function fetchNearbyPlaces(args: {
  lat: number;
  lng: number;
  type: string;
  maxResultCount: number;
}): Promise<GooglePlace[]> {
  const response = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY as string,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify({
      includedTypes: [args.type],
      maxResultCount: args.maxResultCount,
      locationRestriction: {
        circle: {
          center: { latitude: args.lat, longitude: args.lng },
          radius: SEARCH_RADIUS_METERS,
        },
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google Places error (${args.type}): ${response.status} ${error}`);
  }

  const body = await response.json() as { places?: GooglePlace[] };
  return body.places || [];
}

async function getEmoryPortalId(): Promise<string> {
  const { data, error } = await supabase
    .from("portals")
    .select("id, slug")
    .in("slug", ["emory-demo", "emory-test", "emory"]);

  if (error || !data || data.length === 0) {
    throw new Error(`Unable to resolve Emory portal: ${error?.message || "not found"}`);
  }

  const preferred = ["emory-demo", "emory-test", "emory"];
  for (const slug of preferred) {
    const match = data.find((portal) => portal.slug === slug);
    if (match?.id) return match.id;
  }
  throw new Error("Emory portal id missing");
}

async function getEmoryHospitals(portalId: string): Promise<HospitalLocationRow[]> {
  const { data, error } = await supabase
    .from("portal_hospital_locations")
    .select("id, slug, name, neighborhood, lat, lng")
    .eq("portal_id", portalId)
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (error) {
    throw new Error(`Failed to load Emory hospitals: ${error.message}`);
  }

  return (data || [])
    .map((row) => ({
      id: String(row.id),
      slug: String(row.slug),
      name: String(row.name),
      neighborhood: (row.neighborhood as string | null) ?? null,
      lat: Number(row.lat),
      lng: Number(row.lng),
    }))
    .filter((row) => Number.isFinite(row.lat) && Number.isFinite(row.lng));
}

async function getNearbyExistingVenues(hospitals: HospitalLocationRow[]): Promise<VenueRow[]> {
  const aggregated = new Map<number, VenueRow>();
  for (const hospital of hospitals) {
    const latDelta = 0.14;
    const lngDelta = 0.14;
    const { data, error } = await supabase
      .from("venues")
      .select("id,name,slug,address,neighborhood,city,state,lat,lng,venue_type,spot_type,spot_types,website,aliases,active,is_adult")
      .gte("lat", hospital.lat - latDelta)
      .lte("lat", hospital.lat + latDelta)
      .gte("lng", hospital.lng - lngDelta)
      .lte("lng", hospital.lng + lngDelta)
      .limit(1800);

    if (error) {
      throw new Error(`Failed loading nearby venues for ${hospital.slug}: ${error.message}`);
    }

    for (const row of (data || []) as VenueRow[]) {
      aggregated.set(row.id, row);
    }
  }
  return [...aggregated.values()];
}

async function printCoverage(hospitals: HospitalLocationRow[]) {
  for (const hospital of hospitals) {
    const latDelta = 0.14;
    const lngDelta = 0.14;
    const { data } = await supabase
      .from("venues")
      .select("id,name,venue_type,spot_type,lat,lng,active,is_adult")
      .gte("lat", hospital.lat - latDelta)
      .lte("lat", hospital.lat + latDelta)
      .gte("lng", hospital.lng - lngDelta)
      .lte("lng", hospital.lng + lngDelta)
      .limit(2400);

    let restaurants = 0;
    let coffee = 0;
    let lodging = 0;
    let services = 0;
    let total = 0;

    for (const venue of (data || []) as Array<{
      name: string;
      venue_type: string | null;
      spot_type: string | null;
      lat: number | null;
      lng: number | null;
      active: boolean | null;
      is_adult: boolean | null;
    }>) {
      if (venue.active === false || venue.is_adult === true) continue;
      const lat = toNumber(venue.lat);
      const lng = toNumber(venue.lng);
      if (lat === null || lng === null) continue;
      const distance = getDistanceMiles(hospital.lat, hospital.lng, lat, lng);
      if (distance > 2.0) continue;

      total += 1;
      const type = `${venue.venue_type || ""} ${venue.spot_type || ""}`.toLowerCase();
      const name = (venue.name || "").toLowerCase();
      if (/restaurant|food_hall|brewery|bar|bakery|diner|kitchen/.test(type) || /grill|kitchen|eatery|pizza|bistro/.test(name)) {
        restaurants += 1;
      }
      if (/coffee_shop|cafe/.test(type) || /coffee|cafe/.test(name)) {
        coffee += 1;
      }
      if (/hotel|lodging/.test(type) || /hotel|inn|suites/.test(name)) {
        lodging += 1;
      }
      if (/pharmacy|market|grocery|wellness|fitness|urgent/.test(type) || /pharmacy|grocery|market|clinic|urgent care/.test(name)) {
        services += 1;
      }
    }

    console.log(
      `${hospital.slug}: total=${total}, restaurants=${restaurants}, coffee=${coffee}, lodging=${lodging}, services=${services}`
    );
  }
}

async function main() {
  const { dryRun, limitPerType } = parseArgs();
  console.log(`Backfill Emory nearby venues (dryRun=${dryRun}, limitPerType=${limitPerType})`);

  const portalId = await getEmoryPortalId();
  const hospitals = await getEmoryHospitals(portalId);
  if (hospitals.length === 0) {
    throw new Error("No active Emory hospitals found");
  }

  const existingVenues = await getNearbyExistingVenues(hospitals);
  const byId = new Map<number, VenueRow>(existingVenues.map((venue) => [venue.id, venue]));
  const aliasToVenueId = new Map<string, number>();
  const keyToVenueId = new Map<string, number>();
  const slugSet = new Set(existingVenues.map((venue) => venue.slug));

  for (const venue of existingVenues) {
    const aliases = venue.aliases || [];
    for (const alias of aliases) aliasToVenueId.set(alias, venue.id);
    const key = `${normalizeText(venue.name)}|${normalizeText(venue.address)}`;
    keyToVenueId.set(key, venue.id);
  }

  const placeMap = new Map<string, { place: GooglePlace; neighborhood: string | null }>();
  for (const hospital of hospitals) {
    console.log(`Scanning ${hospital.name} (${hospital.slug})`);
    for (const type of SEARCH_TYPES) {
      try {
        const places = await fetchNearbyPlaces({
          lat: hospital.lat,
          lng: hospital.lng,
          type,
          maxResultCount: limitPerType,
        });
        for (const place of places) {
          if (!place.id) continue;
          const existing = placeMap.get(place.id);
          if (existing) continue;
          placeMap.set(place.id, { place, neighborhood: hospital.neighborhood });
        }
        process.stdout.write(`  ${type}: ${places.length}\n`);
      } catch (error) {
        console.error(`  ${type}: ${(error as Error).message}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const { place, neighborhood } of placeMap.values()) {
    const name = place.displayName?.text?.trim();
    const lat = toNumber(place.location?.latitude);
    const lng = toNumber(place.location?.longitude);
    if (!name || lat === null || lng === null) {
      skipped += 1;
      continue;
    }

    const address = place.formattedAddress || null;
    const alias = `google_place:${place.id}`;
    const key = `${normalizeText(name)}|${normalizeText(address)}`;

    const existingId = aliasToVenueId.get(alias) ?? keyToVenueId.get(key) ?? null;
    const existingVenue = existingId !== null ? byId.get(existingId) || null : null;
    const classification = classifyPlace(place);
    const cityState = parseCityState(address);
    const hours = toHoursJson(place);
    const hoursDisplay = toHoursDisplay(place);
    const aliases = Array.from(new Set([...(existingVenue?.aliases || []), alias]));
    const priceLevel = place.priceLevel ? PRICE_LEVEL_MAP[place.priceLevel] ?? null : null;

    try {
      if (existingVenue) {
        const payload = {
          name,
          address,
          neighborhood: existingVenue.neighborhood || neighborhood || null,
          city: existingVenue.city || cityState.city,
          state: existingVenue.state || cityState.state,
          lat,
          lng,
          venue_type: existingVenue.venue_type || classification.venueType,
          spot_type: existingVenue.spot_type || classification.spotType,
          spot_types: existingVenue.spot_types && existingVenue.spot_types.length > 0
            ? Array.from(new Set([...existingVenue.spot_types, ...classification.spotTypes]))
            : classification.spotTypes,
          website: existingVenue.website || place.websiteUri || null,
          aliases,
          price_level: priceLevel,
          hours: hours || null,
          hours_display: hoursDisplay,
          active: true,
          is_adult: false,
          last_verified_at: new Date().toISOString(),
        };

        if (!dryRun) {
          const { error } = await supabase
            .from("venues")
            .update(payload)
            .eq("id", existingVenue.id);
          if (error) throw error;
        }
        updated += 1;
      } else {
        const baseSlug = slugify(name) || "venue";
        const suffix = place.id.slice(-6).toLowerCase();
        const slugCandidates = [
          baseSlug,
          `${baseSlug}-${suffix}`,
          `${baseSlug}-${suffix.slice(0, 3)}-${suffix.slice(3)}`,
        ].filter((candidate, index, arr) => candidate && arr.indexOf(candidate) === index);

        const payloadBase = {
          name,
          address,
          neighborhood: neighborhood || null,
          city: cityState.city,
          state: cityState.state,
          lat,
          lng,
          venue_type: classification.venueType,
          spot_type: classification.spotType,
          spot_types: classification.spotTypes,
          website: place.websiteUri || null,
          aliases: [alias],
          price_level: priceLevel,
          hours: hours || null,
          hours_display: hoursDisplay,
          active: true,
          is_adult: false,
          last_verified_at: new Date().toISOString(),
        };

        if (!dryRun) {
          let insertedRow: VenueRow | null = null;
          let lastError: Error | null = null;

          for (const candidate of slugCandidates) {
            if (slugSet.has(candidate)) continue;
            const { data, error } = await supabase
              .from("venues")
              .insert({
                ...payloadBase,
                slug: candidate,
              })
              .select("id,name,slug,address,neighborhood,city,state,lat,lng,venue_type,spot_type,spot_types,website,aliases,active,is_adult")
              .single();

            if (error) {
              lastError = error;
              if (String(error.message || "").includes("venues_slug_key")) {
                continue;
              }
              throw error;
            }

            if (data) {
              insertedRow = data as VenueRow;
              slugSet.add(candidate);
              break;
            }
          }

          if (!insertedRow) {
            throw lastError || new Error("Unable to insert venue after slug retries");
          }

          byId.set(insertedRow.id, insertedRow);
          aliasToVenueId.set(alias, insertedRow.id);
          keyToVenueId.set(key, insertedRow.id);
        } else {
          slugSet.add(slugCandidates[0]);
        }
        inserted += 1;
      }
    } catch (error) {
      failed += 1;
      console.error(`Failed upsert for ${name}: ${(error as Error).message}`);
    }
  }

  console.log(`Unique Google places: ${placeMap.size}`);
  console.log(`Inserted: ${inserted}`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Failed: ${failed}`);
  if (!dryRun) {
    console.log("Coverage within 2mi after upsert:");
    await printCoverage(hospitals);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
