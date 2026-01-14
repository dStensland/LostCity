import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// Lazy-load Supabase client to avoid build-time errors
let _supabase: SupabaseClient<Database> | null = null;

// Mock client for build time
const mockClient = {
  from: () => ({
    select: () => ({
      eq: () => ({
        single: async () => ({ data: null, error: null }),
        neq: () => ({
          gte: () => ({
            order: () => ({
              limit: async () => ({ data: [], error: null }),
            }),
          }),
        }),
      }),
      gte: () => ({
        order: () => ({
          order: () => ({
            limit: async () => ({ data: [], error: null }),
            range: async () => ({ data: [], error: null, count: 0 }),
          }),
        }),
      }),
    }),
  }),
} as unknown as SupabaseClient<Database>;

function getSupabase(): SupabaseClient<Database> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Return mock client during build when env vars are not available
  if (!supabaseUrl || !supabaseKey) {
    return mockClient;
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
  price_min: number | null;
  price_max: number | null;
  price_note: string | null;
  is_free: boolean;
  source_url: string;
  ticket_url: string | null;
  image_url: string | null;
  venue: Venue | null;
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

export async function getEventById(id: number): Promise<Event | null> {
  const { data, error } = await supabase
    .from("events")
    .select(
      `
      *,
      venue:venues(id, name, slug, address, neighborhood, city, state)
    `
    )
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching event:", error);
    return null;
  }

  return data as Event;
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
