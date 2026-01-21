import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

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
};

export type Event = {
  id: number;
  title: string;
  description: string | null;
  start_date: string;
  start_time: string | null;
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
  is_free: boolean;
  source_url: string;
  ticket_url: string | null;
  image_url: string | null;
  venue: Venue | null;
  series_id?: string | null;
  series?: SeriesInfo | null;
};

export type Venue = {
  id: number;
  name: string;
  slug: string;
  address: string | null;
  neighborhood: string | null;
  city: string;
  state: string;
};

export async function getUpcomingEvents(limit = 50): Promise<Event[]> {
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("events")
    .select(
      `
      *,
      venue:venues(id, name, slug, address, neighborhood, city, state)
    `
    )
    .gte("start_date", today)
    .order("start_date", { ascending: true })
    .order("start_time", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("Error fetching events:", error);
    return [];
  }

  return data as Event[];
}

export async function getUpcomingEventsPaginated(
  page = 1,
  pageSize = 20
): Promise<{ events: Event[]; total: number }> {
  const today = new Date().toISOString().split("T")[0];
  const offset = (page - 1) * pageSize;

  const { data, error, count } = await supabase
    .from("events")
    .select(
      `
      *,
      venue:venues(id, name, slug, address, neighborhood, city, state)
    `,
      { count: "exact" }
    )
    .gte("start_date", today)
    .order("start_date", { ascending: true })
    .order("start_time", { ascending: true })
    .range(offset, offset + pageSize - 1);

  if (error) {
    console.error("Error fetching events:", error);
    return { events: [], total: 0 };
  }

  return { events: data as Event[], total: count ?? 0 };
}

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

export type EventWithProducer = Event & {
  producer?: Producer | null;
};

export async function getEventById(id: number): Promise<EventWithProducer | null> {
  const { data, error } = await supabase
    .from("events")
    .select(
      `
      *,
      venue:venues(id, name, slug, address, neighborhood, city, state),
      producer:event_producers(id, name, slug, org_type, website, instagram, logo_url, description)
    `
    )
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching event:", error);
    return null;
  }

  return data as EventWithProducer;
}

export async function getEventsByCategory(
  categoryId: string,
  limit = 50
): Promise<Event[]> {
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("events")
    .select(
      `
      *,
      venue:venues(id, name, slug, address, neighborhood, city, state)
    `
    )
    .eq("category_id", categoryId)
    .gte("start_date", today)
    .order("start_date", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("Error fetching events:", error);
    return [];
  }

  return data as Event[];
}

export async function getRelatedEvents(
  event: Event,
  limit = 4
): Promise<{ venueEvents: Event[]; sameDateEvents: Event[] }> {
  const today = new Date().toISOString().split("T")[0];
  const venueId = event.venue?.id;

  // Get other events at the same venue
  let venueEvents: Event[] = [];
  if (venueId) {
    const { data } = await supabase
      .from("events")
      .select(
        `
        *,
        venue:venues(id, name, slug, address, neighborhood, city, state)
      `
      )
      .eq("venue_id", venueId)
      .neq("id", event.id)
      .gte("start_date", today)
      .order("start_date", { ascending: true })
      .limit(limit);

    venueEvents = (data as Event[]) || [];
  }

  // Get other events on the same date
  const { data: sameDateData } = await supabase
    .from("events")
    .select(
      `
      *,
      venue:venues(id, name, slug, address, neighborhood, city, state)
    `
    )
    .eq("start_date", event.start_date)
    .neq("id", event.id)
    .order("start_time", { ascending: true })
    .limit(limit);

  const sameDateEvents = (sameDateData as Event[]) || [];

  return { venueEvents, sameDateEvents };
}

// Get similar events based on category
export async function getSimilarEvents(
  event: Event,
  limit = 4
): Promise<Event[]> {
  if (!event.category) {
    return [];
  }

  const today = new Date().toISOString().split("T")[0];

  // Get events in the same category, excluding same venue and same date
  const { data } = await supabase
    .from("events")
    .select(
      `
      *,
      venue:venues(id, name, slug, address, neighborhood, city, state)
    `
    )
    .eq("category", event.category)
    .neq("id", event.id)
    .neq("start_date", event.start_date) // Exclude same date (covered by "That same night")
    .gte("start_date", today)
    .order("start_date", { ascending: true })
    .limit(limit * 2); // Fetch extra to filter out same venue

  let similarEvents = (data as Event[]) || [];

  // Filter out events at the same venue (covered by "More at this venue")
  if (event.venue?.id) {
    similarEvents = similarEvents.filter((e) => e.venue?.id !== event.venue?.id);
  }

  return similarEvents.slice(0, limit);
}

// Get platform stats for landing page
export async function getPlatformStats(): Promise<{ eventCount: number; venueCount: number; sourceCount: number }> {
  const today = new Date().toISOString().split("T")[0];

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
      .select("id", { count: "exact", head: true })
      .eq("is_active", true),
  ]);

  return {
    eventCount: eventsResult.count || 0,
    venueCount: venuesResult.count || 0,
    sourceCount: sourcesResult.count || 0,
  };
}
