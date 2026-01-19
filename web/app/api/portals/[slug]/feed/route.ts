import { supabase } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

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
  auto_filter: Record<string, unknown> | null;
  display_order: number;
  is_visible: boolean;
  portal_section_items: SectionItem[];
};

type Event = {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  is_all_day: boolean;
  is_free: boolean;
  category: string | null;
  venue: {
    id: number;
    name: string;
    neighborhood: string | null;
  } | null;
};

// GET /api/portals/[slug]/feed - Get feed content for a portal
export async function GET(request: NextRequest, { params }: Props) {
  const { slug } = await params;
  const { searchParams } = new URL(request.url);
  const sectionIds = searchParams.get("sections")?.split(",").filter(Boolean);
  const limit = parseInt(searchParams.get("limit") || "5");

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
      auto_filter,
      display_order,
      is_visible,
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

  const sections = (sectionsData || []) as Section[];

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

  // Fetch events
  const eventMap = new Map<number, Event>();
  if (eventIds.size > 0) {
    const { data: eventsData } = await supabase
      .from("events")
      .select(`
        id,
        title,
        start_date,
        start_time,
        is_all_day,
        is_free,
        category,
        venue:venues(id, name, neighborhood)
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

      if (section.section_type === "curated") {
        // Get events from curated items
        const items = (section.portal_section_items || [])
          .filter((item) => item.entity_type === "event")
          .sort((a, b) => a.display_order - b.display_order);

        events = items
          .map((item) => eventMap.get(item.entity_id))
          .filter((e): e is Event => e !== undefined)
          .slice(0, feedSettings.items_per_section || limit);
      } else if (section.section_type === "auto" && section.auto_filter) {
        // Fetch events based on auto filter
        const filter = section.auto_filter as {
          categories?: string[];
          neighborhoods?: string[];
          is_free?: boolean;
        };

        let query = supabase
          .from("events")
          .select(`
            id,
            title,
            start_date,
            start_time,
            is_all_day,
            is_free,
            category,
            venue:venues(id, name, neighborhood)
          `)
          .gte("start_date", new Date().toISOString().split("T")[0])
          .order("start_date", { ascending: true })
          .limit(feedSettings.items_per_section || limit);

        if (filter.categories?.length) {
          query = query.in("category", filter.categories);
        }
        if (filter.is_free) {
          query = query.eq("is_free", true);
        }

        const { data: autoEvents } = await query;
        events = (autoEvents || []) as Event[];
      }

      return {
        id: section.id,
        title: section.title,
        slug: section.slug,
        description: section.description,
        section_type: section.section_type,
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
      feed_type: feedSettings.feed_type || "default",
      items_per_section: feedSettings.items_per_section || 5,
    },
    sections: feedSections,
  });
}
