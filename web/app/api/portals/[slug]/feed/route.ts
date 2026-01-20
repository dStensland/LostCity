import { supabase } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";
import { addDays, startOfDay, endOfDay, nextFriday, nextSunday, isFriday, isSaturday, isSunday } from "date-fns";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
};

type SectionItem = {
  id: string;
  entity_type: string;
  entity_id: number;
  display_order: number;
};

type Section = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  section_type: "auto" | "curated" | "mixed";
  block_type: string;
  layout: string;
  items_per_row: number;
  max_items: number;
  auto_filter: AutoFilter | null;
  block_content: Record<string, unknown> | null;
  display_order: number;
  is_visible: boolean;
  schedule_start: string | null;
  schedule_end: string | null;
  show_on_days: string[] | null;
  show_after_time: string | null;
  show_before_time: string | null;
  style: Record<string, unknown> | null;
  portal_section_items: SectionItem[];
};

type AutoFilter = {
  categories?: string[];
  subcategories?: string[];
  neighborhoods?: string[];
  tags?: string[];
  is_free?: boolean;
  price_max?: number;
  date_filter?: "today" | "tomorrow" | "this_weekend" | "next_7_days" | "next_30_days";
  sort_by?: "date" | "popularity" | "trending" | "random";
  source_ids?: number[];
  venue_ids?: number[];
  exclude_ids?: number[];
  exclude_categories?: string[]; // Categories to exclude from results
  event_ids?: number[]; // Specific events to show (for pinned/featured content)
};

type Event = {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  end_time: string | null;
  is_all_day: boolean;
  is_free: boolean;
  price_min: number | null;
  price_max: number | null;
  category: string | null;
  subcategory: string | null;
  image_url: string | null;
  description: string | null;
  going_count?: number;
  venue: {
    id: number;
    name: string;
    neighborhood: string | null;
    slug: string | null;
  } | null;
};

// Check if section should be visible based on schedule rules
function isSectionVisible(section: Section): boolean {
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const currentTime = now.toTimeString().slice(0, 5); // HH:MM
  const currentDay = now.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();

  // Check date range
  if (section.schedule_start && today < section.schedule_start) {
    return false;
  }
  if (section.schedule_end && today > section.schedule_end) {
    return false;
  }

  // Check day of week
  if (section.show_on_days && section.show_on_days.length > 0) {
    if (!section.show_on_days.includes(currentDay)) {
      return false;
    }
  }

  // Check time of day
  if (section.show_after_time && currentTime < section.show_after_time) {
    return false;
  }
  if (section.show_before_time && currentTime > section.show_before_time) {
    return false;
  }

  return true;
}

// Get date range for filter
function getDateRange(filter: string): { start: string; end: string } {
  const now = new Date();
  const today = startOfDay(now);

  switch (filter) {
    case "today":
      return {
        start: today.toISOString().split("T")[0],
        end: today.toISOString().split("T")[0],
      };
    case "tomorrow":
      const tomorrow = addDays(today, 1);
      return {
        start: tomorrow.toISOString().split("T")[0],
        end: tomorrow.toISOString().split("T")[0],
      };
    case "this_weekend": {
      // Friday through Sunday
      let friday: Date;
      let sunday: Date;

      if (isFriday(now) || isSaturday(now) || isSunday(now)) {
        // We're in the weekend, use current week
        friday = isFriday(now) ? today : addDays(today, -(now.getDay() - 5));
        sunday = isSunday(now) ? today : addDays(today, 7 - now.getDay());
      } else {
        // Use next weekend
        friday = nextFriday(today);
        sunday = nextSunday(today);
      }

      return {
        start: friday.toISOString().split("T")[0],
        end: sunday.toISOString().split("T")[0],
      };
    }
    case "next_7_days":
      return {
        start: today.toISOString().split("T")[0],
        end: addDays(today, 7).toISOString().split("T")[0],
      };
    case "next_30_days":
      return {
        start: today.toISOString().split("T")[0],
        end: addDays(today, 30).toISOString().split("T")[0],
      };
    default:
      return {
        start: today.toISOString().split("T")[0],
        end: addDays(today, 14).toISOString().split("T")[0],
      };
  }
}

// GET /api/portals/[slug]/feed - Get feed content for a portal
export async function GET(request: NextRequest, { params }: Props) {
  const { slug } = await params;
  const { searchParams } = new URL(request.url);
  const sectionIds = searchParams.get("sections")?.split(",").filter(Boolean);
  const defaultLimit = parseInt(searchParams.get("limit") || "5");

  // Get portal
  const { data: portalData, error: portalError } = await supabase
    .from("portals")
    .select("id, slug, name, settings")
    .eq("slug", slug)
    .eq("status", "active")
    .single();

  if (portalError || !portalData) {
    return NextResponse.json({ error: "Portal not found" }, { status: 404 });
  }

  const portal = portalData as { id: string; slug: string; name: string; settings: Record<string, unknown> };
  const feedSettings = (portal.settings?.feed || {}) as {
    feed_type?: string;
    featured_section_ids?: string[];
    items_per_section?: number;
    default_layout?: string;
  };

  // Determine which sections to fetch
  let sectionsToFetch = sectionIds;
  if (!sectionsToFetch && feedSettings.featured_section_ids?.length) {
    sectionsToFetch = feedSettings.featured_section_ids;
  }

  // Fetch sections with their items
  let sectionsQuery = supabase
    .from("portal_sections")
    .select(`
      id,
      title,
      slug,
      description,
      section_type,
      block_type,
      layout,
      items_per_row,
      max_items,
      auto_filter,
      block_content,
      display_order,
      is_visible,
      schedule_start,
      schedule_end,
      show_on_days,
      show_after_time,
      show_before_time,
      style,
      portal_section_items(id, entity_type, entity_id, display_order)
    `)
    .eq("portal_id", portal.id)
    .eq("is_visible", true)
    .order("display_order", { ascending: true });

  if (sectionsToFetch?.length) {
    sectionsQuery = sectionsQuery.in("id", sectionsToFetch);
  }

  const { data: sectionsData, error: sectionsError } = await sectionsQuery;

  if (sectionsError) {
    return NextResponse.json({ error: sectionsError.message }, { status: 500 });
  }

  const allSections = (sectionsData || []) as Section[];

  // Filter sections by visibility rules
  const sections = allSections.filter(isSectionVisible);

  // Collect all event IDs from curated sections
  const eventIds = new Set<number>();
  for (const section of sections) {
    if (section.section_type === "curated" || section.section_type === "mixed") {
      for (const item of section.portal_section_items || []) {
        if (item.entity_type === "event") {
          eventIds.add(item.entity_id);
        }
      }
    }
  }

  // Fetch curated events
  const eventMap = new Map<number, Event>();
  if (eventIds.size > 0) {
    const { data: eventsData } = await supabase
      .from("events")
      .select(`
        id,
        title,
        start_date,
        start_time,
        end_time,
        is_all_day,
        is_free,
        price_min,
        price_max,
        category,
        subcategory,
        image_url,
        description,
        venue:venues(id, name, neighborhood, slug)
      `)
      .in("id", Array.from(eventIds))
      .gte("start_date", new Date().toISOString().split("T")[0]);

    for (const event of (eventsData || []) as Event[]) {
      eventMap.set(event.id, event);
    }
  }

  // Build response with events for each section
  const feedSections = await Promise.all(
    sections.map(async (section) => {
      let events: Event[] = [];
      const limit = section.max_items || feedSettings.items_per_section || defaultLimit;

      // Non-event block types don't need events
      if (["category_grid", "announcement", "external_link", "countdown"].includes(section.block_type)) {
        return {
          id: section.id,
          title: section.title,
          slug: section.slug,
          description: section.description,
          section_type: section.section_type,
          block_type: section.block_type,
          layout: section.layout,
          items_per_row: section.items_per_row,
          style: section.style,
          block_content: section.block_content,
          auto_filter: section.auto_filter,
          events: [],
        };
      }

      // Check for pinned event_ids first (works for any section type)
      if (section.auto_filter?.event_ids?.length) {
        const filter = section.auto_filter;
        const { data: pinnedEvents } = await supabase
          .from("events")
          .select(`
            id,
            title,
            start_date,
            start_time,
            end_time,
            is_all_day,
            is_free,
            price_min,
            price_max,
            category,
            subcategory,
            image_url,
            description,
            venue:venues(id, name, neighborhood, slug)
          `)
          .in("id", filter.event_ids!);

        events = (pinnedEvents || []) as Event[];
      } else if (section.section_type === "curated") {
        // Get events from curated items
        const items = (section.portal_section_items || [])
          .filter((item) => item.entity_type === "event")
          .sort((a, b) => a.display_order - b.display_order);

        events = items
          .map((item) => eventMap.get(item.entity_id))
          .filter((e): e is Event => e !== undefined)
          .slice(0, limit);
      } else if ((section.section_type === "auto" || section.section_type === "mixed") && section.auto_filter) {
        // Fetch events based on auto filter
        const filter = section.auto_filter;
        const today = new Date().toISOString().split("T")[0];

        let query = supabase
          .from("events")
          .select(`
            id,
            title,
            start_date,
            start_time,
            end_time,
            is_all_day,
            is_free,
            price_min,
            price_max,
            category,
            subcategory,
            image_url,
            description,
            venue:venues(id, name, neighborhood, slug)
          `)
          .gte("start_date", today);

        // Apply date filter
        if (filter.date_filter) {
          const { start, end } = getDateRange(filter.date_filter);
          query = query.gte("start_date", start).lte("start_date", end);
        }

        // Apply category filter
        if (filter.categories?.length) {
          query = query.in("category", filter.categories);
        }

        // Exclude categories
        if (filter.exclude_categories?.length) {
          query = query.not("category", "in", `(${filter.exclude_categories.join(",")})`);
        }

        // Apply subcategory filter
        if (filter.subcategories?.length) {
          query = query.in("subcategory", filter.subcategories);
        }

        // Apply free filter
        if (filter.is_free) {
          query = query.eq("is_free", true);
        }

        // Apply price max filter
        if (filter.price_max !== undefined) {
          query = query.or(`price_min.lte.${filter.price_max},is_free.eq.true`);
        }

        // Apply venue filter
        if (filter.venue_ids?.length) {
          query = query.in("venue_id", filter.venue_ids);
        }

        // Apply source filter
        if (filter.source_ids?.length) {
          query = query.in("source_id", filter.source_ids);
        }

        // Apply exclusions
        if (filter.exclude_ids?.length) {
          query = query.not("id", "in", `(${filter.exclude_ids.join(",")})`);
        }

        // Apply sorting
        switch (filter.sort_by) {
          case "popularity":
            // We'll sort by RSVP count after fetching
            query = query.order("start_date", { ascending: true });
            break;
          case "trending":
            // Recent RSVPs - for now just use date
            query = query.order("start_date", { ascending: true });
            break;
          case "random":
            // Postgres random ordering
            query = query.order("id", { ascending: true }); // Will shuffle client-side
            break;
          default:
            query = query.order("start_date", { ascending: true }).order("start_time", { ascending: true });
        }

        query = query.limit(limit * 2); // Fetch extra for filtering

        const { data: autoEvents } = await query;
        events = (autoEvents || []) as Event[];

        // If sorting by popularity, fetch RSVP counts
        if (filter.sort_by === "popularity" && events.length > 0) {
          const eventIdsForRsvp = events.map((e) => e.id);
          const { data: rsvpData } = await supabase
            .from("event_rsvps")
            .select("event_id")
            .in("event_id", eventIdsForRsvp)
            .eq("status", "going");

          const rsvpCounts: Record<number, number> = {};
          for (const rsvp of (rsvpData || []) as { event_id: number }[]) {
            rsvpCounts[rsvp.event_id] = (rsvpCounts[rsvp.event_id] || 0) + 1;
          }

          events = events.map((e) => ({ ...e, going_count: rsvpCounts[e.id] || 0 }));
          events.sort((a, b) => (b.going_count || 0) - (a.going_count || 0));
        }

        // Random shuffle if requested
        if (filter.sort_by === "random") {
          events = events.sort(() => Math.random() - 0.5);
        }

        events = events.slice(0, limit);

        // For mixed sections, also add curated items at the top
        if (section.section_type === "mixed") {
          const curatedItems = (section.portal_section_items || [])
            .filter((item) => item.entity_type === "event")
            .sort((a, b) => a.display_order - b.display_order);

          const curatedEvents = curatedItems
            .map((item) => eventMap.get(item.entity_id))
            .filter((e): e is Event => e !== undefined);

          // Merge: curated first, then auto (avoiding duplicates)
          const curatedIds = new Set(curatedEvents.map((e) => e.id));
          const autoEventsFiltered = events.filter((e) => !curatedIds.has(e.id));
          events = [...curatedEvents, ...autoEventsFiltered].slice(0, limit);
        }
      }

      return {
        id: section.id,
        title: section.title,
        slug: section.slug,
        description: section.description,
        section_type: section.section_type,
        block_type: section.block_type,
        layout: section.layout,
        items_per_row: section.items_per_row,
        style: section.style,
        block_content: section.block_content,
        auto_filter: section.auto_filter,
        events,
      };
    })
  );

  return NextResponse.json({
    portal: {
      slug: portal.slug,
      name: portal.name,
    },
    feedSettings: {
      feed_type: feedSettings.feed_type || "sections",
      items_per_section: feedSettings.items_per_section || 5,
      default_layout: feedSettings.default_layout || "list",
    },
    sections: feedSections,
  });
}
