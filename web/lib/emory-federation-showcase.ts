import { getDistanceMiles } from "@/lib/geo";
import { getLocalDateString, formatSmartDate, formatTime } from "@/lib/formats";
import { getPortalSourceAccess } from "@/lib/federation";
import {
  EMORY_COMPETITOR_EXCLUSIONS,
  isCompetitorExcluded,
  resolveEmorySourcePolicy,
} from "@/lib/emory-source-policy";
import { resolveSupportSourcePolicy } from "@/lib/support-source-policy";
import type { HospitalLocation } from "@/lib/hospitals";
import { supabase } from "@/lib/supabase";
import { createServiceClient } from "@/lib/supabase/service";

type SourceAccessType = "owner" | "global" | "subscription";

type EventPreviewRow = {
  id: number;
  title: string;
  image_url: string | null;
  start_date: string;
  start_time: string | null;
  is_all_day: boolean;
  category: string | null;
  source_url: string | null;
  source: {
    name: string | null;
    slug: string | null;
    url: string | null;
  } | null;
  venue: {
    id: number | null;
    name: string | null;
    slug: string | null;
    neighborhood: string | null;
    address: string | null;
    lat: number | null;
    lng: number | null;
    image_url: string | null;
    venue_type?: string | null;
  } | null;
  organization?: {
    id: string | null;
    name: string | null;
    slug: string | null;
    org_type: string | null;
  } | null;
};

type NearbyVenueRow = {
  id: number;
  name: string;
  slug: string | null;
  venue_type: string | null;
  neighborhood: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  image_url: string | null;
  spot_type: string | null;
  active: boolean | null;
  is_adult: boolean | null;
};

export type EmoryFederationEventPreview = {
  id: number;
  title: string;
  imageUrl: string | null;
  scheduleLabel: string;
  startDate: string;
  startTime: string | null;
  isAllDay: boolean;
  category: string | null;
  venueName: string | null;
  neighborhood: string | null;
  lat: number | null;
  lng: number | null;
  mapsHref: string | null;
  detailHref: string;
};

export type EmoryFederationVenuePreview = {
  id: number;
  name: string;
  slug: string | null;
  venueType: string | null;
  neighborhood: string | null;
  lat: number | null;
  lng: number | null;
  mapsHref: string;
  imageUrl: string | null;
  distanceMiles: number | null;
  distanceLabel: string | null;
  upcomingCount: number;
  detailHref: string;
};

export type EmoryFederationOrgPreview = {
  id: string;
  name: string;
  slug: string | null;
  orgType: string | null;
  imageUrl: string | null;
  upcomingCount: number;
  detailHref: string;
};

export type EmoryFederationSourcePreview = {
  sourceName: string;
  accessType: SourceAccessType;
  categoryCount: number;
};

export type EmoryFederationShowcase = {
  counts: {
    sources: number;
    events: number;
    venues: number;
    organizations: number;
  };
  events: EmoryFederationEventPreview[];
  venues: EmoryFederationVenuePreview[];
  organizations: EmoryFederationOrgPreview[];
  sourceHighlights: EmoryFederationSourcePreview[];
};

const COMMUNITY_FOCUS_KEYWORDS = /\b(health|wellness|caregiver|clinic|screen|screening|immun|prevention|public health|care|patient|family|nutrition|meal|food|pharmacy|support|mental|mindful|fitness|walk|movement|yoga|volunteer)\b/i;
const COMMUNITY_CATEGORIES = new Set([
  "community",
  "family",
  "fitness",
  "learning",
  "wellness",
  "food_drink",
  "other",
]);

function getReadClient() {
  try {
    return createServiceClient();
  } catch {
    return supabase;
  }
}

function toScheduleLabel(date: string, time: string | null, isAllDay: boolean): string {
  const day = formatSmartDate(date).label;
  if (isAllDay) return `${day} · All Day`;
  return `${day} · ${formatTime(time, false)}`;
}

function safeText(value: string | null | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed || fallback;
}

function toMapsHref(name: string, address?: string | null): string {
  const q = address ? `${name} ${address}` : name;
  return `https://maps.google.com/?q=${encodeURIComponent(q)}`;
}

function formatLocalISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(base: Date, days: number): Date {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

function normalizePolicyText(value: string | null | undefined): string {
  return (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasCommunitySignal(event: EventPreviewRow): boolean {
  const category = normalizePolicyText(event.category);
  if (category && COMMUNITY_CATEGORIES.has(category)) return true;

  const searchable = [
    event.title,
    event.category,
    event.source?.name,
    event.source?.slug,
    event.venue?.name,
  ]
    .filter(Boolean)
    .join(" ");

  return COMMUNITY_FOCUS_KEYWORDS.test(searchable);
}

function getSourceFallbackId(event: EventPreviewRow): string | null {
  const slug = normalizePolicyText(event.source?.slug);
  if (slug) return `source:${slug}`;
  const name = normalizePolicyText(event.source?.name);
  if (name) return `source:${name}`;
  return null;
}

function getVenueUtilityScore(venue: EmoryFederationVenuePreview): number {
  const type = normalizePolicyText(venue.venueType);
  let score = 8;

  if (type === "coffee shop") score = 34;
  else if (type === "restaurant") score = 32;
  else if (type === "hotel") score = 30;
  else if (type === "pharmacy" || type === "market" || type === "grocery") score = 30;
  else if (type === "fitness" || type === "wellness") score = 20;
  else if (type === "park") score = 16;

  if (venue.distanceMiles !== null) {
    if (venue.distanceMiles <= 0.5) score += 22;
    else if (venue.distanceMiles <= 1.0) score += 18;
    else if (venue.distanceMiles <= 2.0) score += 12;
    else score += 4;
  }

  score += Math.min(venue.upcomingCount, 4) * 2;
  return score;
}

function isHospitalUtilityVenue(args: {
  venueType?: string | null;
  spotType?: string | null;
  name: string;
}): boolean {
  const venueType = normalizePolicyText(args.venueType);
  const spotType = normalizePolicyText(args.spotType);
  const name = normalizePolicyText(args.name);

  if (/\b(airbnb|vrbo|bedroom|private room|entire home)\b/.test(name)) {
    return false;
  }
  if (
    venueType === "hotel"
    && !/\b(hotel|inn|suite|suites|lodge|residence|marriott|hilton|hyatt|holiday inn|hampton|homewood|courtyard)\b/.test(name)
  ) {
    return false;
  }
  if (/\b(chevron|shell|exxon|bp|citgo)\b/.test(name) && (venueType === "market" || spotType === "food")) {
    return false;
  }

  if (["coffee shop", "restaurant", "hotel", "pharmacy", "market", "grocery", "fitness", "wellness"].includes(venueType)) {
    return true;
  }
  if (["coffee shop", "cafe", "restaurant", "hotel", "pharmacy", "food", "fitness", "wellness"].includes(spotType)) {
    return true;
  }
  return /\b(coffee|cafe|restaurant|kitchen|grill|diner|bistro|hotel|inn|suites|pharmacy|drugstore|market|grocery|laundry|urgent care)\b/.test(name);
}

async function getNearbyVenuePreviews(args: {
  client: ReturnType<typeof getReadClient>;
  hospital: HospitalLocation;
  portalSlug: string;
  existingVenueIds: Set<number>;
}): Promise<EmoryFederationVenuePreview[]> {
  const { client, hospital, portalSlug, existingVenueIds } = args;
  const latDelta = 0.14;
  const lngDelta = 0.14;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client as any)
    .from("venues")
    .select(`
      id,
      name,
      slug,
      venue_type,
      neighborhood,
      address,
      lat,
      lng,
      image_url,
      spot_type,
      active,
      is_adult
    `)
    .gte("lat", hospital.lat - latDelta)
    .lte("lat", hospital.lat + latDelta)
    .gte("lng", hospital.lng - lngDelta)
    .lte("lng", hospital.lng + lngDelta)
    .limit(560);

  if (error) {
    console.error("Error fetching nearby venue previews:", error);
    return [];
  }

  const previews: EmoryFederationVenuePreview[] = [];
  for (const venue of (data || []) as NearbyVenueRow[]) {
    if (venue.active === false) continue;
    if (venue.is_adult === true) continue;
    if (!isHospitalUtilityVenue({
      venueType: venue.venue_type,
      spotType: venue.spot_type,
      name: venue.name,
    })) continue;
    if (isCompetitorExcluded(venue.name, EMORY_COMPETITOR_EXCLUSIONS)) continue;
    if (isCompetitorExcluded(venue.slug, EMORY_COMPETITOR_EXCLUSIONS)) continue;
    if (existingVenueIds.has(venue.id)) continue;
    if (venue.lat === null || venue.lng === null) continue;

    const distanceMiles = getDistanceMiles(hospital.lat, hospital.lng, venue.lat, venue.lng);
    if (distanceMiles > 2.05) continue;

    previews.push({
      id: venue.id,
      name: venue.name,
      slug: venue.slug || null,
      venueType: venue.venue_type || null,
      neighborhood: venue.neighborhood || null,
      lat: venue.lat,
      lng: venue.lng,
      mapsHref: toMapsHref(venue.name, venue.address || null),
      imageUrl: venue.image_url || null,
      distanceMiles,
      distanceLabel: `${distanceMiles.toFixed(1)} mi from campus`,
      upcomingCount: 0,
      detailHref: venue.slug ? `/${portalSlug}?spot=${venue.slug}` : `/${portalSlug}?view=community`,
    });
  }

  return previews
    .sort((a, b) =>
      (a.distanceMiles ?? Number.MAX_SAFE_INTEGER) - (b.distanceMiles ?? Number.MAX_SAFE_INTEGER)
      || a.name.localeCompare(b.name)
    )
    .slice(0, 18);
}

function buildFallbackShowcase(args: {
  portalSlug: string;
  hospital: HospitalLocation | null;
  sourceHighlights: EmoryFederationSourcePreview[];
  sourceCount: number;
}): EmoryFederationShowcase {
  const { portalSlug, hospital, sourceHighlights, sourceCount } = args;
  const baseLat = hospital?.lat ?? 33.7915;
  const baseLng = hospital?.lng ?? -84.3224;
  const today = new Date();

  const venueSeeds = [
    {
      id: 880001,
      slug: "clifton-community-kitchen",
      name: "Clifton Community Kitchen",
      neighborhood: "Clifton Corridor",
      venueType: "food",
      offsetLat: 0.0022,
      offsetLng: -0.0014,
      imageUrl: "https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=900&q=80",
    },
    {
      id: 880002,
      slug: "emory-quiet-lounge",
      name: "Emory Quiet Lounge",
      neighborhood: "Druid Hills",
      venueType: "quiet_space",
      offsetLat: -0.0018,
      offsetLng: 0.0021,
      imageUrl: "https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=900&q=80",
    },
    {
      id: 880003,
      slug: "north-druid-pharmacy",
      name: "North Druid Pharmacy",
      neighborhood: "North Druid Hills",
      venueType: "pharmacy",
      offsetLat: 0.0036,
      offsetLng: 0.0028,
      imageUrl: "https://images.pexels.com/photos/208512/pexels-photo-208512.jpeg?auto=compress&cs=tinysrgb&w=900",
    },
    {
      id: 880004,
      slug: "candor-park-wellness-grove",
      name: "Candor Park Wellness Grove",
      neighborhood: "Candler Park",
      venueType: "outdoor",
      offsetLat: -0.0051,
      offsetLng: -0.0044,
      imageUrl: "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?auto=format&fit=crop&w=900&q=80",
    },
    {
      id: 880005,
      slug: "family-resource-corner",
      name: "Family Resource Corner",
      neighborhood: "Decatur",
      venueType: "support",
      offsetLat: 0.0068,
      offsetLng: -0.0029,
      imageUrl: "https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=900&q=80",
    },
    {
      id: 880006,
      slug: "green-bowl-kitchen",
      name: "Green Bowl Kitchen",
      neighborhood: "Midtown",
      venueType: "food",
      offsetLat: 0.0102,
      offsetLng: -0.0074,
      imageUrl: "https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?auto=format&fit=crop&w=900&q=80",
    },
  ];

  const venues: EmoryFederationVenuePreview[] = venueSeeds.map((seed, index) => {
    const lat = baseLat + seed.offsetLat;
    const lng = baseLng + seed.offsetLng;
    const distanceMiles = getDistanceMiles(baseLat, baseLng, lat, lng);
    return {
      id: seed.id,
      name: seed.name,
      slug: seed.slug,
      venueType: seed.venueType,
      neighborhood: seed.neighborhood,
      lat,
      lng,
      mapsHref: toMapsHref(seed.name, `${seed.neighborhood}, Atlanta`),
      imageUrl: seed.imageUrl,
      distanceMiles,
      distanceLabel: `${distanceMiles.toFixed(1)} mi from campus`,
      upcomingCount: 2 + (index % 3),
      detailHref: `/${portalSlug}?view=community`,
    };
  });

  const orgSeeds = [
    { id: "org-fallback-1", name: "Atlanta Caregiver Collective", orgType: "Support group" },
    { id: "org-fallback-2", name: "West End Wellness Project", orgType: "Community program" },
    { id: "org-fallback-3", name: "Neighborhood Nutrition Network", orgType: "Food access" },
    { id: "org-fallback-4", name: "Mindful Mondays Atlanta", orgType: "Mental wellness" },
  ];

  const organizations: EmoryFederationOrgPreview[] = orgSeeds.map((org, index) => ({
    id: org.id,
    name: org.name,
    slug: null,
    orgType: org.orgType,
    imageUrl: venues[index % venues.length]?.imageUrl || null,
    upcomingCount: 2 + (index % 2),
    detailHref: `/${portalSlug}?view=community&tab=groups`,
  }));

  const eventSeeds = [
    { id: 990001, title: "Sunrise Mobility for Caregivers", dayOffset: 0, time: "07:30:00", venueIndex: 3, category: "Fitness" },
    { id: 990002, title: "Low-Sodium Breakfast Hour", dayOffset: 0, time: "08:00:00", venueIndex: 0, category: "Food access" },
    { id: 990003, title: "Pharmacy Q&A for Discharge Planning", dayOffset: 0, time: "11:30:00", venueIndex: 2, category: "Care support" },
    { id: 990004, title: "Heart-Healthy Cooking Night", dayOffset: 1, time: "18:00:00", venueIndex: 5, category: "Class" },
    { id: 990005, title: "Family Resource Navigation Clinic", dayOffset: 1, time: "13:00:00", venueIndex: 4, category: "Support" },
    { id: 990006, title: "Mindful Mondays Peer Circle", dayOffset: 2, time: "17:30:00", venueIndex: 1, category: "Mental wellness" },
    { id: 990007, title: "Community Meal Prep Lab", dayOffset: 3, time: "16:00:00", venueIndex: 0, category: "Program" },
    { id: 990008, title: "Neighborhood Walk + Blood Pressure Check", dayOffset: 4, time: "09:00:00", venueIndex: 3, category: "Public health" },
  ];

  const events: EmoryFederationEventPreview[] = eventSeeds.map((seed) => {
    const venue = venues[seed.venueIndex];
    const date = formatLocalISODate(addDays(today, seed.dayOffset));
    return {
      id: seed.id,
      title: seed.title,
      imageUrl: venue?.imageUrl || null,
      scheduleLabel: toScheduleLabel(date, seed.time, false),
      startDate: date,
      startTime: seed.time,
      isAllDay: false,
      category: seed.category,
      venueName: venue?.name || null,
      neighborhood: venue?.neighborhood || null,
      lat: venue?.lat || null,
      lng: venue?.lng || null,
      mapsHref: venue?.mapsHref || null,
      detailHref: `/${portalSlug}?view=community`,
    };
  });

  return {
    counts: {
      sources: sourceCount,
      events: events.length,
      venues: venues.length,
      organizations: organizations.length,
    },
    events,
    venues,
    organizations,
    sourceHighlights,
  };
}

export async function getEmoryFederationShowcase(args: {
  portalId: string;
  portalSlug: string;
  hospital: HospitalLocation | null;
  includeSensitive?: boolean;
}): Promise<EmoryFederationShowcase> {
  const { portalId, portalSlug, hospital, includeSensitive = false } = args;
  const client = getReadClient();
  const access = await getPortalSourceAccess(portalId);
  const today = getLocalDateString();

  const scopedAccess = access.accessDetails.filter((source) => {
    if (source.accessType !== "global") return true;
    if (resolveEmorySourcePolicy({ name: source.sourceName })) return true;
    return Boolean(resolveSupportSourcePolicy({ name: source.sourceName }));
  });
  const selectedAccess = scopedAccess.length > 0 ? scopedAccess : access.accessDetails;
  const selectedSourceIds = selectedAccess.map((source) => source.sourceId);

  const sourceHighlights = selectedAccess
    .slice(0, 6)
    .map((source) => ({
      sourceName: source.sourceName,
      accessType: source.accessType,
      categoryCount: source.accessibleCategories?.length || 0,
    }));

  if (selectedSourceIds.length === 0) {
    return buildFallbackShowcase({
      portalSlug,
      hospital,
      sourceHighlights,
      sourceCount: 0,
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let eventsQuery = (client as any)
    .from("events")
    .select(
      `
      id,
      title,
      image_url,
      start_date,
      start_time,
      is_all_day,
      category,
      source_url,
      source:sources!events_source_id_fkey(name, slug, url),
      venue:venues!events_venue_id_fkey(id, name, slug, neighborhood, address, lat, lng, image_url, venue_type),
      organization:organizations!events_producer_id_fkey(id, name, slug, org_type)
    `,
      { count: "exact" }
    )
    .in("source_id", selectedSourceIds)
    .gte("start_date", today)
    .order("start_date", { ascending: true })
    .order("start_time", { ascending: true, nullsFirst: false })
    .limit(380);

  if (!includeSensitive) {
    eventsQuery = eventsQuery.or("is_sensitive.eq.false,is_sensitive.is.null");
  }

  const { data, count } = await eventsQuery;

  const rows = ((data || []) as EventPreviewRow[]).filter((event) => {
    const sourceName = safeText(event.source?.name, "");
    const sourceSlug = safeText(event.source?.slug, "");
    const emoryPolicy = resolveEmorySourcePolicy({
      slug: event.source?.slug,
      name: event.source?.name,
    });
    const supportPolicy = emoryPolicy ? null : resolveSupportSourcePolicy({
      slug: event.source?.slug,
      name: event.source?.name,
    });
    const isPolicySource = Boolean(emoryPolicy) || Boolean(supportPolicy);
    const isRelevant = isPolicySource || hasCommunitySignal(event);

    return (
      !isCompetitorExcluded(sourceName, EMORY_COMPETITOR_EXCLUSIONS) &&
      !isCompetitorExcluded(sourceSlug, EMORY_COMPETITOR_EXCLUSIONS) &&
      isRelevant
    );
  });

  const eventPreviews: EmoryFederationEventPreview[] = rows.slice(0, 42).map((event) => ({
    id: event.id,
    title: safeText(event.title, "Community event"),
    imageUrl: event.image_url || event.venue?.image_url || null,
    scheduleLabel: toScheduleLabel(event.start_date, event.start_time, event.is_all_day),
    startDate: event.start_date,
    startTime: event.start_time,
    isAllDay: event.is_all_day,
    category: event.category || null,
    venueName: event.venue?.name || null,
    neighborhood: event.venue?.neighborhood || null,
    lat: event.venue?.lat || null,
    lng: event.venue?.lng || null,
    mapsHref: event.venue?.name ? toMapsHref(event.venue.name, event.venue?.address || null) : null,
    detailHref: `/${portalSlug}?view=community&event=${event.id}`,
  }));

  const venueMap = new Map<number, EmoryFederationVenuePreview>();
  for (const event of rows) {
    const venue = event.venue;
    if (!venue?.id || !venue.name) continue;
    if (venue.lat === null || venue.lng === null) continue;
    if (!isHospitalUtilityVenue({ venueType: venue.venue_type, name: venue.name })) continue;
    if (venue.slug && event.source?.slug && normalizePolicyText(venue.slug) === normalizePolicyText(event.source.slug)) {
      continue;
    }
    const existing = venueMap.get(venue.id);
    const distanceMiles =
      hospital
        ? getDistanceMiles(hospital.lat, hospital.lng, venue.lat, venue.lng)
        : null;
    if (distanceMiles !== null && distanceMiles > 2.05) continue;
    const distanceLabel = distanceMiles !== null ? `${distanceMiles.toFixed(1)} mi from campus` : null;

    if (existing) {
      existing.upcomingCount += 1;
      continue;
    }
    venueMap.set(venue.id, {
      id: venue.id,
      name: venue.name,
      slug: venue.slug || null,
      venueType: venue.venue_type || null,
      neighborhood: venue.neighborhood || null,
      lat: venue.lat,
      lng: venue.lng,
      mapsHref: toMapsHref(venue.name, venue.address || null),
      imageUrl: venue.image_url || null,
      distanceMiles,
      distanceLabel,
      upcomingCount: 1,
      detailHref: venue.slug ? `/${portalSlug}?spot=${venue.slug}` : `/${portalSlug}?view=community`,
    });
  }

  const venues = [...venueMap.values()]
    .sort((a, b) => b.upcomingCount - a.upcomingCount)
    .slice(0, 24);

  if (hospital) {
    const nearbyVenuePreviews = await getNearbyVenuePreviews({
      client,
      hospital,
      portalSlug,
      existingVenueIds: new Set([...venueMap.keys()]),
    });
    for (const venue of nearbyVenuePreviews) {
      venues.push(venue);
    }
  }

  const rankedVenues = venues
    .sort((a, b) =>
      getVenueUtilityScore(b) - getVenueUtilityScore(a)
      || (a.distanceMiles ?? Number.MAX_SAFE_INTEGER) - (b.distanceMiles ?? Number.MAX_SAFE_INTEGER)
      || b.upcomingCount - a.upcomingCount
      || a.name.localeCompare(b.name)
    )
    .slice(0, 24);

  const orgMap = new Map<string, EmoryFederationOrgPreview>();
  const orgImageMap = new Map<string, string | null>();
  for (const event of rows) {
    const org = event.organization;
    const sourceFallbackId = getSourceFallbackId(event);
    const sourceFallbackName = safeText(event.source?.name, "");
    const orgId = org?.id || sourceFallbackId;
    const orgName = org?.name || sourceFallbackName;

    if (!orgId || !orgName) continue;

    const existing = orgMap.get(orgId);
    if (existing) {
      existing.upcomingCount += 1;
      if (!existing.imageUrl) {
        const nextImage = event.image_url || event.venue?.image_url || null;
        if (nextImage) {
          existing.imageUrl = nextImage;
          orgImageMap.set(orgId, nextImage);
        }
      }
      continue;
    }
    const imageUrl = event.image_url || event.venue?.image_url || orgImageMap.get(orgId) || null;
    orgMap.set(orgId, {
      id: orgId,
      name: orgName,
      slug: org?.slug || null,
      orgType: org?.org_type || "Source",
      imageUrl,
      upcomingCount: 1,
      detailHref: org?.slug ? `/${portalSlug}?view=community&org=${org.slug}` : `/${portalSlug}?view=community&tab=groups`,
    });
  }

  const organizations = [...orgMap.values()]
    .sort((a, b) => b.upcomingCount - a.upcomingCount)
    .slice(0, 24);

  if (eventPreviews.length === 0 && rankedVenues.length === 0 && organizations.length === 0) {
    return buildFallbackShowcase({
      portalSlug,
      hospital,
      sourceHighlights,
      sourceCount: selectedSourceIds.length,
    });
  }

  return {
    counts: {
      sources: selectedSourceIds.length,
      events: rows.length || count || 0,
      venues: rankedVenues.length,
      organizations: organizations.length,
    },
    events: eventPreviews,
    venues: rankedVenues,
    organizations,
    sourceHighlights,
  };
}
