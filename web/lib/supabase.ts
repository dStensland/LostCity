import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { getLocalDateString } from "@/lib/formats";

// Sanitize API key - remove any whitespace, control chars, or URL encoding artifacts
function sanitizeKey(key: string | undefined): string | undefined {
  if (!key) return undefined;
  return key
    .trim()
    .replace(/[\s\n\r\t]/g, '')
    .replace(/%0A/gi, '')
    .replace(/%0D/gi, '')
    .replace(/[^\x20-\x7E]/g, '');
}

// Lazy-load Supabase client to avoid build-time errors
let _supabase: SupabaseClient<Database> | null = null;

function getSupabase(): SupabaseClient<Database> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseKey = sanitizeKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables"
    );
  }

  if (!_supabase) {
    _supabase = createClient<Database>(supabaseUrl, supabaseKey);
  }
  return _supabase;
}

export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(_, prop) {
    return (getSupabase() as unknown as Record<string, unknown>)[prop as string];
  },
});

export type SeriesInfo = {
  id: string;
  slug: string;
  title: string;
  series_type: string;
  image_url: string | null;
  genres: string[] | null;
  festival?: {
    id: string;
    slug: string;
    name: string;
    image_url: string | null;
    festival_type?: string | null;
    location?: string | null;
    neighborhood?: string | null;
  } | null;
};

export type Event = {
  id: number;
  title: string;
  description: string | null;
  start_date: string;
  start_time: string | null;
  doors_time?: string | null;
  end_date: string | null;
  end_time: string | null;
  is_all_day: boolean;
  category: string | null;
  subcategory: string | null;
  category_id: string | null;
  subcategory_id: string | null;
  tags: string[] | null;
  genres: string[] | null;
  price_min: number | null;
  price_max: number | null;
  price_note: string | null;
  age_policy?: string | null;
  ticket_status?: string | null;
  reentry_policy?: string | null;
  set_times_mentioned?: boolean | null;
  is_free: boolean;
  is_adult?: boolean | null;
  source_url: string;
  ticket_url: string | null;
  image_url: string | null;
  venue: Venue | null;
  series_id?: string | null;
  series?: SeriesInfo | null;
  is_recurring?: boolean;
  recurrence_rule?: string | null;
  is_live?: boolean;
  attendee_count?: number | null;
  is_class?: boolean;
  class_category?: string | null;
  skill_level?: string | null;
  instructor?: string | null;
  capacity?: number | null;
  updated_at?: string | null;
};

export type Venue = {
  id: number;
  name: string;
  slug: string;
  address: string | null;
  neighborhood: string | null;
  city: string;
  state: string;
  vibes?: string[] | null;
  description?: string | null;
  venue_type?: string | null;
};

export type Producer = {
  id: string;
  name: string;
  slug: string;
  org_type: string;
  website: string | null;
  instagram: string | null;
  logo_url: string | null;
  description: string | null;
};

export type Organization = Producer;

export type EventWithProducer = Event & {
  organization?: Organization | null;
  producer?: Producer | null; // Legacy alias for compatibility
};

export async function getEventById(id: number): Promise<EventWithProducer | null> {
  const { data, error } = await supabase
    .from("events")
    .select(
      `
      *,
      venue:venues(id, name, slug, address, neighborhood, city, state, vibes, description, venue_type),
      organization:organizations(id, name, slug, org_type, website, instagram, logo_url, description),
      series:series_id(
        id,
        slug,
        title,
        series_type,
        image_url,
        genres,
        festival:festivals(id, slug, name, image_url, festival_type, location, neighborhood)
      )
    `
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    console.error("Error fetching event:", error);
    return null;
  }

  return data as EventWithProducer;
}

export async function getRelatedEvents(
  event: Event,
  options?: { portalId?: string },
  limit = 4
): Promise<{ venueEvents: Event[]; sameDateEvents: Event[] }> {
  const today = getLocalDateString();
  const venueId = event.venue?.id;
  const portalId = options?.portalId;

  // Parallelize independent queries
  const [venueEventsResult, sameDateEventsResult] = await Promise.all([
    // Get other events at the same venue
    venueId
      ? (() => {
          let q = supabase
            .from("events")
            .select(
              `
              *,
              venue:venues(id, name, slug, address, neighborhood, city, state)
            `
            )
            .eq("venue_id", venueId)
            .neq("id", event.id)
            .is("canonical_event_id", null)
            .gte("start_date", today);
          if (portalId) {
            q = q.or(`portal_id.eq.${portalId},portal_id.is.null`);
          }
          return q
            .order("start_date", { ascending: true })
            .order("start_time", { ascending: true })
            .limit(limit);
        })()
      : Promise.resolve({ data: null }),
    // Get other events on the same date (scoped to portal)
    (() => {
      let q = supabase
        .from("events")
        .select(
          `
          *,
          venue:venues(id, name, slug, address, neighborhood, city, state)
        `
        )
        .eq("start_date", event.start_date)
        .neq("id", event.id)
        .is("canonical_event_id", null);
      if (portalId) {
        q = q.or(`portal_id.eq.${portalId},portal_id.is.null`);
      }
      return q
        .order("start_time", { ascending: true })
        .limit(limit);
    })(),
  ]);

  const venueEvents = (venueEventsResult.data as Event[]) || [];
  const sameDateEvents = (sameDateEventsResult.data as Event[]) || [];

  return { venueEvents, sameDateEvents };
}

// Get platform stats for landing page
export async function getPlatformStats(): Promise<{ eventCount: number; venueCount: number; sourceCount: number }> {
  const today = getLocalDateString();

  const [eventsResult, venuesResult, sourcesResult] = await Promise.all([
    supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .gte("start_date", today),
    supabase
      .from("venues")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("sources")
      .select("id", { count: "exact", head: true }),
  ]);

  return {
    eventCount: eventsResult.count || 0,
    venueCount: venuesResult.count || 0,
    sourceCount: sourcesResult.count || 0,
  };
}
