/**
 * Dog portal data layer.
 *
 * Server-side queries for the dog portal blended feed and deep pages.
 * Uses the anon Supabase client for public read-only data.
 */

import { supabase } from "./supabase";
import { getLocalDateString } from "@/lib/formats";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type DogEvent = {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  end_date: string | null;
  end_time: string | null;
  is_all_day: boolean;
  is_free: boolean;
  price_min: number | null;
  price_max: number | null;
  category: string | null;
  image_url: string | null;
  tags: string[] | null;
  is_class: boolean | null;
  venue: {
    id: number;
    name: string;
    neighborhood: string | null;
    slug: string;
  } | null;
};

export type DogVenue = {
  id: number;
  name: string;
  slug: string;
  address: string | null;
  neighborhood: string | null;
  venue_type: string | null;
  vibes: string[] | null;
  image_url: string | null;
  short_description: string | null;
  website: string | null;
  hours_display: string | null;
  lat: number | null;
  lng: number | null;
};

export type DogOrg = {
  id: string;
  name: string;
  slug: string;
  org_type: string;
  description: string | null;
  website: string | null;
  instagram: string | null;
  logo_url: string | null;
};

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const EVENT_SELECT = `
  id, title, start_date, start_time, end_date, end_time,
  is_all_day, is_free, price_min, price_max, category, image_url, tags, is_class,
  venue:venues(id, name, neighborhood, slug)
`;

const VENUE_SELECT = `
  id, name, slug, address, neighborhood, venue_type, vibes,
  image_url, short_description, website, hours_display, lat, lng
`;

const ORG_SELECT = `
  id, name, slug, org_type, description, website, instagram, logo_url
`;

/** Venue types that belong in "parks & trails" */
const PARK_TYPES = ["park", "dog_park", "trail", "nature_preserve"];

/** Venue types for food/drink */
const PATIO_TYPES = ["brewery", "restaurant", "bar", "coffee_shop", "cafe"];

/** Venue types for services */
const SERVICE_TYPES = ["vet", "groomer", "pet_store", "pet_daycare", "animal_shelter"];

/* ------------------------------------------------------------------ */
/*  Base Queries                                                       */
/* ------------------------------------------------------------------ */

/** Get upcoming events with dog-relevant tags */
export async function getDogEvents(limit = 20): Promise<DogEvent[]> {
  const today = getLocalDateString();

  const { data } = await supabase
    .from("events")
    .select(EVENT_SELECT)
    .gte("start_date", today)
    .is("canonical_event_id", null)
    .or("is_class.eq.false,is_class.is.null")
    .or("is_sensitive.eq.false,is_sensitive.is.null")
    .overlaps("tags", ["dog-friendly", "pets", "adoption", "outdoor", "family-friendly"])
    .order("start_date", { ascending: true })
    .limit(limit);

  return (data || []) as DogEvent[];
}

/** Get this weekend's events (Friday-Sunday) */
export async function getDogWeekendEvents(limit = 10): Promise<DogEvent[]> {
  const now = new Date();
  const dayOfWeek = now.getDay();

  const friday = new Date(now);
  if (dayOfWeek === 0) {
    friday.setDate(friday.getDate() + 5);
  } else if (dayOfWeek <= 4) {
    friday.setDate(friday.getDate() + (5 - dayOfWeek));
  }

  const sunday = new Date(friday);
  sunday.setDate(friday.getDate() + (friday.getDay() === 5 ? 2 : friday.getDay() === 6 ? 1 : 0));

  const fridayStr = friday.toISOString().split("T")[0];
  const sundayStr = sunday.toISOString().split("T")[0];

  const { data } = await supabase
    .from("events")
    .select(EVENT_SELECT)
    .gte("start_date", fridayStr)
    .lte("start_date", sundayStr)
    .is("canonical_event_id", null)
    .or("is_class.eq.false,is_class.is.null")
    .or("is_sensitive.eq.false,is_sensitive.is.null")
    .overlaps("tags", ["dog-friendly", "pets", "adoption", "outdoor", "family-friendly"])
    .order("start_date", { ascending: true })
    .limit(limit);

  return (data || []) as DogEvent[];
}

/** Get dog-friendly venues */
export async function getDogVenues(): Promise<DogVenue[]> {
  const { data } = await supabase
    .from("venues")
    .select(VENUE_SELECT)
    .contains("vibes", ["dog-friendly"])
    .eq("active", true)
    .order("name");

  return (data || []) as DogVenue[];
}

/** Get dog-friendly venues with coordinates (for map view) */
export async function getDogMapVenues(): Promise<DogVenue[]> {
  const { data } = await supabase
    .from("venues")
    .select(VENUE_SELECT)
    .contains("vibes", ["dog-friendly"])
    .eq("active", true)
    .not("lat", "is", null)
    .not("lng", "is", null)
    .order("name");

  return (data || []) as DogVenue[];
}

/** Get parks and outdoor spaces */
export async function getDogParks(limit = 15): Promise<DogVenue[]> {
  const { data } = await supabase
    .from("venues")
    .select(VENUE_SELECT)
    .in("venue_type", PARK_TYPES)
    .eq("active", true)
    .order("name")
    .limit(limit);

  return (data || []) as DogVenue[];
}

/** Get dog-friendly patios and restaurants */
export async function getDogPatios(limit = 15): Promise<DogVenue[]> {
  const { data } = await supabase
    .from("venues")
    .select(VENUE_SELECT)
    .contains("vibes", ["dog-friendly"])
    .in("venue_type", PATIO_TYPES)
    .eq("active", true)
    .order("name")
    .limit(limit);

  return (data || []) as DogVenue[];
}

/** Get trails and nature spots */
export async function getDogTrails(limit = 10): Promise<DogVenue[]> {
  const { data } = await supabase
    .from("venues")
    .select(VENUE_SELECT)
    .eq("active", true)
    .or(PARK_TYPES.map((t) => `venue_type.eq.${t}`).join(","))
    .overlaps("vibes", ["nature", "hiking", "outdoor", "scenic", "dog-friendly"])
    .order("name")
    .limit(limit);

  return (data || []) as DogVenue[];
}

/* ------------------------------------------------------------------ */
/*  Deep Page Queries                                                  */
/* ------------------------------------------------------------------ */

/** Off-leash parks for the Parks deep page */
export async function getDogOffLeashParks(
  filter?: string
): Promise<DogVenue[]> {
  let query = supabase
    .from("venues")
    .select(VENUE_SELECT)
    .eq("active", true)
    .or(PARK_TYPES.map((t) => `venue_type.eq.${t}`).join(","))
    .contains("vibes", ["off-leash"])
    .order("name");

  if (filter && filter !== "all") {
    query = query.contains("vibes", [filter]);
  }

  const { data } = await query;
  return (data || []) as DogVenue[];
}

/** Pup cup spots for the directory */
export async function getDogPupCupSpots(): Promise<DogVenue[]> {
  const { data } = await supabase
    .from("venues")
    .select(VENUE_SELECT)
    .eq("active", true)
    .overlaps("vibes", ["pup-cup", "dog-menu", "treats-available"])
    .order("name");

  return (data || []) as DogVenue[];
}

/** Adoption events from shelters/rescues */
export async function getDogAdoptionEvents(limit = 20): Promise<DogEvent[]> {
  const today = getLocalDateString();

  const { data } = await supabase
    .from("events")
    .select(EVENT_SELECT)
    .gte("start_date", today)
    .is("canonical_event_id", null)
    .or("is_sensitive.eq.false,is_sensitive.is.null")
    .overlaps("tags", ["adoption", "adoption-event", "pets"])
    .order("start_date", { ascending: true })
    .limit(limit);

  return (data || []) as DogEvent[];
}

/** Shelter/rescue orgs for adoption hub */
export async function getDogAdoptionOrgs(): Promise<DogOrg[]> {
  const { data } = await supabase
    .from("organizations")
    .select(ORG_SELECT)
    .in("org_type", ["animal_shelter", "rescue", "nonprofit"])
    .order("name");

  // Fallback: also check venues that are shelters
  if (!data || data.length === 0) {
    const { data: venueOrgs } = await supabase
      .from("venues")
      .select(VENUE_SELECT)
      .eq("active", true)
      .in("venue_type", ["animal_shelter", "nonprofit_hq"])
      .overlaps("vibes", ["dog-friendly", "adoption"])
      .order("name");

    // Convert venue to org-like shape
    return (venueOrgs || []).map((v) => ({
      id: String((v as DogVenue).id),
      name: (v as DogVenue).name,
      slug: (v as DogVenue).slug,
      org_type: (v as DogVenue).venue_type || "shelter",
      description: (v as DogVenue).short_description,
      website: (v as DogVenue).website,
      instagram: null,
      logo_url: (v as DogVenue).image_url,
    }));
  }

  return (data || []) as DogOrg[];
}

/** Training events/classes */
export async function getDogTrainingEvents(
  filter?: string,
  limit = 30
): Promise<DogEvent[]> {
  const today = getLocalDateString();

  // Find events that are either marked as classes with dog tags,
  // or any event with specific dog-training tags (regardless of is_class)
  let query = supabase
    .from("events")
    .select(EVENT_SELECT)
    .gte("start_date", today)
    .is("canonical_event_id", null)
    .or("is_sensitive.eq.false,is_sensitive.is.null")
    .overlaps("tags", [
      "dog-training",
      "puppy-class",
      "obedience",
      "agility",
      "dog-social",
    ])
    .order("start_date", { ascending: true })
    .limit(limit);

  if (filter && filter !== "all") {
    query = query.contains("tags", [filter]);
  }

  const { data } = await query;
  return (data || []) as DogEvent[];
}

/** Vet, groomer, pet store, daycare directory */
export async function getDogServices(
  typeFilter?: string
): Promise<DogVenue[]> {
  let query = supabase
    .from("venues")
    .select(VENUE_SELECT)
    .eq("active", true)
    .order("name");

  if (typeFilter && typeFilter !== "all") {
    query = query.eq("venue_type", typeFilter);
  } else {
    query = query.in("venue_type", SERVICE_TYPES);
  }

  const { data } = await query;
  return (data || []) as DogVenue[];
}

/* ------------------------------------------------------------------ */
/*  Feed builder                                                       */
/* ------------------------------------------------------------------ */

export type DogFeedSection = {
  key: string;
  title: string;
  subtitle?: string;
  type: "events" | "venues" | "orgs";
  items: DogEvent[] | DogVenue[] | DogOrg[];
  deepPageHref?: string;
};

/** Build the full dog portal feed */
export async function getDogFeed(): Promise<DogFeedSection[]> {
  const [
    weekendEvents,
    allEvents,
    offLeashParks,
    pupCupSpots,
    patios,
    adoptionEvents,
    adoptionOrgs,
    services,
    trails,
  ] = await Promise.all([
    getDogWeekendEvents(10),
    getDogEvents(20),
    getDogOffLeashParks(),
    getDogPupCupSpots(),
    getDogPatios(15),
    getDogAdoptionEvents(6),
    getDogAdoptionOrgs(),
    getDogServices(),
    getDogTrails(10),
  ]);

  const sections: DogFeedSection[] = [];

  // 1. This Weekend (highest intent)
  if (weekendEvents.length > 0) {
    sections.push({
      key: "this_weekend",
      title: "This Weekend",
      subtitle: "Dog-friendly events happening soon",
      type: "events",
      items: weekendEvents,
    });
  }

  // 2. Off-Leash Parks (#1 search query)
  if (offLeashParks.length > 0) {
    sections.push({
      key: "off_leash",
      title: "Off-Leash Parks",
      subtitle: "Let them run free",
      type: "venues",
      items: offLeashParks.slice(0, 10),
      deepPageHref: "/parks",
    });
  }

  // 3. Pup Cup Spots (fun, shareable)
  if (pupCupSpots.length > 0) {
    sections.push({
      key: "pup_cups",
      title: "Pup Cup Spots",
      subtitle: "Treats for the good ones",
      type: "venues",
      items: pupCupSpots.slice(0, 10),
      deepPageHref: "/pup-cups",
    });
  }

  // 4. Dog-Friendly Patios (rows)
  if (patios.length > 0) {
    sections.push({
      key: "patios",
      title: "Dog-Friendly Patios",
      subtitle: "Grab a drink, bring the dog",
      type: "venues",
      items: patios.slice(0, 6),
    });
  }

  // 5. Adopt (emotional value)
  if (adoptionEvents.length > 0 || adoptionOrgs.length > 0) {
    if (adoptionEvents.length > 0) {
      sections.push({
        key: "adopt",
        title: "Adopt",
        subtitle: "Give a dog a home",
        type: "events",
        items: adoptionEvents,
        deepPageHref: "/adopt",
      });
    } else {
      sections.push({
        key: "adopt",
        title: "Adopt",
        subtitle: "Atlanta shelters & rescues",
        type: "orgs",
        items: adoptionOrgs.slice(0, 4),
        deepPageHref: "/adopt",
      });
    }
  }

  // 6. Services (rows)
  if (services.length > 0) {
    sections.push({
      key: "services",
      title: "Services",
      subtitle: "Vets, groomers, and more",
      type: "venues",
      items: services.slice(0, 6),
      deepPageHref: "/services",
    });
  }

  // 7. Trails & Nature
  if (trails.length > 0) {
    sections.push({
      key: "trails",
      title: "Trails & Nature",
      subtitle: "Get outside together",
      type: "venues",
      items: trails,
      deepPageHref: "/parks?tab=trails",
    });
  }

  // 8. Coming Up (catch-all)
  if (allEvents.length > 0) {
    const usedIds = new Set(weekendEvents.map((e) => e.id));
    const upcoming = allEvents.filter((e) => !usedIds.has(e.id));
    if (upcoming.length > 0) {
      sections.push({
        key: "upcoming",
        title: "Coming Up",
        subtitle: "More on the calendar",
        type: "events",
        items: upcoming.slice(0, 12),
      });
    }
  }

  return sections;
}
