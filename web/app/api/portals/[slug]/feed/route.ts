import { supabase } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";
import { addDays, startOfDay, nextFriday, nextSunday, isFriday, isSaturday, isSunday } from "date-fns";

// Cache feed for 5 minutes at CDN, allow stale for 1 hour while revalidating
export const revalidate = 300;

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
  featured_blurb: string | null;
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
    .select("id, slug, name, portal_type, settings")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  if (portalError || !portalData) {
    return NextResponse.json({ error: "Portal not found" }, { status: 404 });
  }

  const portal = portalData as { id: string; slug: string; name: string; portal_type: string; settings: Record<string, unknown> };
  const isBusinessPortal = portal.portal_type === "business";
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
        featured_blurb,
        venue:venues(id, name, neighborhood, slug)
      `)
      .in("id", Array.from(eventIds))
      .gte("start_date", new Date().toISOString().split("T")[0])
      .is("canonical_event_id", null); // Only show canonical events, not duplicates

    for (const event of (eventsData || []) as Event[]) {
      eventMap.set(event.id, event);
    }
  }

  // PERFORMANCE OPTIMIZATION: Batch all event fetching upfront
  // Instead of N queries (one per section), we do 1-2 queries total

  const today = new Date().toISOString().split("T")[0];

  // Step 1: Collect all pinned event IDs from sections
  const pinnedEventIds = new Set<number>();
  for (const section of sections) {
    if (section.auto_filter?.event_ids?.length) {
      for (const id of section.auto_filter.event_ids) {
        pinnedEventIds.add(id);
      }
    }
  }

  // Step 2: Fetch pinned events in one query
  if (pinnedEventIds.size > 0) {
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
        featured_blurb,
        venue:venues(id, name, neighborhood, slug)
      `)
      .in("id", Array.from(pinnedEventIds))
      .is("canonical_event_id", null); // Only show canonical events, not duplicates

    for (const event of (pinnedEvents || []) as Event[]) {
      eventMap.set(event.id, event);
    }
  }

  // Step 3: Determine if we need auto-filtered events and get widest date range needed
  const sectionsNeedingAutoEvents = sections.filter(
    s => (s.section_type === "auto" || s.section_type === "mixed") &&
         s.auto_filter &&
         !s.auto_filter.event_ids?.length &&
         !["category_grid", "announcement", "external_link", "countdown"].includes(s.block_type)
  );

  // Build master event pool for auto sections
  const autoEventPool = new Map<number, Event>();

  if (sectionsNeedingAutoEvents.length > 0) {
    // Find the widest date range needed across all sections
    let maxEndDate = addDays(new Date(), 14).toISOString().split("T")[0]; // Default 2 weeks

    for (const section of sectionsNeedingAutoEvents) {
      const filter = section.auto_filter!;
      if (filter.date_filter) {
        const { end } = getDateRange(filter.date_filter);
        if (end > maxEndDate) maxEndDate = end;
      }
    }

    // Calculate max events needed
    const maxEventsNeeded = sectionsNeedingAutoEvents.reduce((sum, s) => {
      return sum + ((s.max_items || feedSettings.items_per_section || defaultLimit) * 2);
    }, 0);

    // Fetch a pool of events that covers all sections' needs
    let poolQuery = supabase
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
        featured_blurb,
        venue:venues(id, name, neighborhood, slug)
      `)
      .gte("start_date", today)
      .lte("start_date", maxEndDate)
      .is("canonical_event_id", null); // Only show canonical events, not duplicates

    // Apply portal filter - business portals only show their own events
    if (isBusinessPortal) {
      poolQuery = poolQuery.eq("portal_id", portal.id);
    } else {
      // City portals show public events + portal-specific events
      poolQuery = poolQuery.or(`portal_id.eq.${portal.id},portal_id.is.null`);
    }

    const { data: poolEvents } = await poolQuery
      .order("start_date", { ascending: true })
      .order("start_time", { ascending: true })
      .limit(Math.min(maxEventsNeeded, 200)); // Cap at 200 for safety

    for (const event of (poolEvents || []) as Event[]) {
      autoEventPool.set(event.id, event);
    }
  }

  // Step 4: Check if any section needs popularity sorting - batch fetch RSVP counts
  const needsPopularitySort = sectionsNeedingAutoEvents.some(s => s.auto_filter?.sort_by === "popularity");
  const rsvpCounts: Record<number, number> = {};

  if (needsPopularitySort && autoEventPool.size > 0) {
    const { data: rsvpData } = await supabase
      .from("event_rsvps")
      .select("event_id")
      .in("event_id", Array.from(autoEventPool.keys()))
      .eq("status", "going");

    for (const rsvp of (rsvpData || []) as { event_id: number }[]) {
      rsvpCounts[rsvp.event_id] = (rsvpCounts[rsvp.event_id] || 0) + 1;
    }
  }

  // Step 5: Add programmatic featured events and holiday sections
  const holidaySections: Section[] = [];
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1; // 1-12
  const currentDay = currentDate.getDate();

  // Featured events carousel (always show if there are featured events)
  holidaySections.push({
    id: "featured-events",
    title: "Featured Events",
    slug: "featured-events",
    description: "Handpicked by our editors",
    section_type: "auto",
    block_type: "featured_carousel",
    layout: "carousel",
    items_per_row: 3,
    max_items: 10,
    auto_filter: {
      date_filter: "next_30_days",
      sort_by: "date",
    },
    block_content: null,
    display_order: -10,
    is_visible: true,
    schedule_start: null,
    schedule_end: null,
    show_on_days: null,
    show_after_time: null,
    show_before_time: null,
    style: null,
    portal_section_items: [],
  });

  // Add holiday sections starting late January through early March
  const showHolidaySections =
    (currentMonth === 1 && currentDay >= 20) || // Late January
    currentMonth === 2 || // All of February
    (currentMonth === 3 && currentDay <= 5); // Early March for Mardi Gras

  if (showHolidaySections) {
    // Valentine's Day section (Jan 20 - Feb 16)
    if ((currentMonth === 1 && currentDay >= 20) || (currentMonth === 2 && currentDay <= 16)) {
      holidaySections.push({
        id: "valentines-2025",
        title: "Valentine's Day",
        slug: "valentines-day",
        description: "Be still thy beating heart",
        section_type: "auto",
        block_type: "event_carousel",
        layout: "carousel",
        items_per_row: 2,
        max_items: 8,
        auto_filter: {
          tags: ["valentines"],
          date_filter: "next_30_days",
          sort_by: "date",
        },
        block_content: null,
        display_order: -5,
        is_visible: true,
        schedule_start: null,
        schedule_end: null,
        show_on_days: null,
        show_after_time: null,
        show_before_time: null,
        style: {
          accent_color: "#FF69B4", // Neon pink
          icon: "anatomical-heart",
        },
        portal_section_items: [],
      });
    }

    // Lunar New Year section (Jan 20 - Feb 28)
    if ((currentMonth === 1 && currentDay >= 20) || currentMonth === 2) {
      holidaySections.push({
        id: "lunar-new-year-2025",
        title: "Lunar New Year",
        slug: "lunar-new-year",
        description: "A whole year of fire horsin around",
        section_type: "auto",
        block_type: "event_carousel",
        layout: "carousel",
        items_per_row: 2,
        max_items: 8,
        auto_filter: {
          tags: ["lunar-new-year"],
          date_filter: "next_30_days",
          sort_by: "date",
        },
        block_content: null,
        display_order: -4,
        is_visible: true,
        schedule_start: null,
        schedule_end: null,
        show_on_days: null,
        show_after_time: null,
        show_before_time: null,
        style: {
          accent_color: "#DC143C", // Crimson red
          icon: "fire-horse",
        },
        portal_section_items: [],
      });
    }

    // Super Bowl section (Feb 7-9)
    if (currentMonth === 2 && currentDay >= 5 && currentDay <= 10) {
      holidaySections.push({
        id: "super-bowl-2026",
        title: "Super Bowl Sunday",
        slug: "super-bowl",
        description: "Watch parties and game day events",
        section_type: "auto",
        block_type: "event_carousel",
        layout: "carousel",
        items_per_row: 2,
        max_items: 8,
        auto_filter: {
          tags: ["super-bowl"],
          date_filter: "next_7_days",
          sort_by: "date",
        },
        block_content: null,
        display_order: -3,
        is_visible: true,
        schedule_start: null,
        schedule_end: null,
        show_on_days: null,
        show_after_time: null,
        show_before_time: null,
        style: {
          accent_color: "var(--neon-green)",
        },
        portal_section_items: [],
      });
    }

    // Black History Month section (Jan 20 - Feb 28)
    if ((currentMonth === 1 && currentDay >= 20) || currentMonth === 2) {
      holidaySections.push({
        id: "black-history-month-2026",
        title: "Black History Month",
        slug: "black-history-month",
        description: "Celebrate and learn",
        section_type: "auto",
        block_type: "event_carousel",
        layout: "carousel",
        items_per_row: 2,
        max_items: 8,
        auto_filter: {
          tags: ["black-history-month"],
          date_filter: "next_30_days",
          sort_by: "date",
        },
        block_content: null,
        display_order: -6,
        is_visible: true,
        schedule_start: null,
        schedule_end: null,
        show_on_days: null,
        show_after_time: null,
        show_before_time: null,
        style: {
          accent_color: "#9B59B6", // Purple
          icon: "raised-fist",
        },
        portal_section_items: [],
      });
    }
  }

  // Fetch featured events for carousel
  let featuredEvents: Event[] = [];
  const { data: featuredEventsData } = await supabase
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
      featured_blurb,
      venue:venues(id, name, neighborhood, slug)
    `)
    .eq("is_featured", true)
    .gte("start_date", today)
    .lte("start_date", addDays(new Date(), 30).toISOString().split("T")[0])
    .is("canonical_event_id", null)
    .order("start_date", { ascending: true })
    .limit(10);

  if (featuredEventsData && featuredEventsData.length > 0) {
    featuredEvents = featuredEventsData as Event[];
    for (const event of featuredEvents) {
      eventMap.set(event.id, event);
    }
  }

  // Fetch events for holiday sections and track them by tag
  const holidayEventsByTag = new Map<string, Event[]>();
  if (holidaySections.length > 0) {
    for (const holidaySection of holidaySections) {
      // Skip featured events section (handled separately)
      if (holidaySection.block_type === "featured_carousel") continue;

      const tag = holidaySection.auto_filter?.tags?.[0];
      if (tag) {
        const { data: holidayEvents } = await supabase
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
            featured_blurb,
            venue:venues(id, name, neighborhood, slug)
          `)
          .contains("tags", [tag])
          .gte("start_date", today)
          .lte("start_date", addDays(new Date(), 30).toISOString().split("T")[0])
          .is("canonical_event_id", null)
          .order("start_date", { ascending: true })
          .limit(holidaySection.max_items);

        // Store by tag for section building
        if (holidayEvents && holidayEvents.length > 0) {
          holidayEventsByTag.set(tag, holidayEvents as Event[]);
          // Also store in eventMap
          for (const event of holidayEvents as Event[]) {
            eventMap.set(event.id, event);
          }
        }
      }
    }
  }

  // Step 6: Build sections synchronously using pre-fetched data
  const feedSections = sections.map((section) => {
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
      events = section.auto_filter.event_ids
        .map(id => eventMap.get(id))
        .filter((e): e is Event => e !== undefined);
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
      // Filter from pre-fetched pool instead of making new query
      const filter = section.auto_filter;

      // Start with all pool events
      let filtered = Array.from(autoEventPool.values());

      // Apply date filter
      if (filter.date_filter) {
        const { start, end } = getDateRange(filter.date_filter);
        filtered = filtered.filter(e => e.start_date >= start && e.start_date <= end);
      }

      // Apply category filter
      if (filter.categories?.length) {
        filtered = filtered.filter(e => e.category && filter.categories!.includes(e.category));
      }

      // Exclude categories
      if (filter.exclude_categories?.length) {
        filtered = filtered.filter(e => !e.category || !filter.exclude_categories!.includes(e.category));
      }

      // Apply subcategory filter
      // If event has a subcategory, it must match one of the selected subcategories
      // If event has no subcategory, include it if its category matches the parent category
      if (filter.subcategories?.length) {
        // Extract parent categories from subcategory values (e.g., "music.live" -> "music")
        const parentCategories = new Set(
          filter.subcategories.map((sub) => sub.split(".")[0])
        );

        filtered = filtered.filter(e => {
          // If event has a subcategory, it must match exactly
          if (e.subcategory) {
            return filter.subcategories!.includes(e.subcategory);
          }
          // If event has no subcategory, include it if its category matches a parent category
          return e.category && parentCategories.has(e.category);
        });
      }

      // Apply free filter
      if (filter.is_free) {
        filtered = filtered.filter(e => e.is_free);
      }

      // Apply price max filter
      if (filter.price_max !== undefined) {
        filtered = filtered.filter(e => e.is_free || (e.price_min !== null && e.price_min <= filter.price_max!));
      }

      // Apply exclusions
      if (filter.exclude_ids?.length) {
        const excludeSet = new Set(filter.exclude_ids);
        filtered = filtered.filter(e => !excludeSet.has(e.id));
      }

      // Apply sorting
      switch (filter.sort_by) {
        case "popularity":
          filtered = filtered.map(e => ({ ...e, going_count: rsvpCounts[e.id] || 0 }));
          filtered.sort((a, b) => (b.going_count || 0) - (a.going_count || 0));
          break;
        case "trending":
          // For now, same as date sort
          filtered.sort((a, b) => a.start_date.localeCompare(b.start_date));
          break;
        case "random":
          filtered = filtered.sort(() => Math.random() - 0.5);
          break;
        default:
          // Already sorted by date from query
          break;
      }

      events = filtered.slice(0, limit);

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
  });

  // Step 7: Build holiday sections using the same pattern
  const holidayFeedSections = holidaySections.map((section) => {
    let events: Event[] = [];

    // Featured carousel gets featured events
    if (section.block_type === "featured_carousel") {
      events = featuredEvents;
    } else {
      // Holiday sections get events by tag
      const tag = section.auto_filter?.tags?.[0];
      events = tag ? (holidayEventsByTag.get(tag) || []) : [];
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
  });

  // Sort holiday sections by display_order and combine with regular sections
  const sortedHolidaySections = holidayFeedSections
    .filter(s => s.events.length > 0)
    .sort((a, b) => {
      const orderA = holidaySections.find(h => h.id === a.id)?.display_order ?? 0;
      const orderB = holidaySections.find(h => h.id === b.id)?.display_order ?? 0;
      return orderA - orderB;
    });

  const finalSections = [
    ...sortedHolidaySections,
    ...feedSections
  ];

  return NextResponse.json(
    {
      portal: {
        slug: portal.slug,
        name: portal.name,
      },
      feedSettings: {
        feed_type: feedSettings.feed_type || "sections",
        items_per_section: feedSettings.items_per_section || 5,
        default_layout: feedSettings.default_layout || "list",
      },
      sections: finalSections,
    },
    {
      headers: {
        // Cache for 5 minutes on CDN, allow stale for 1 hour while revalidating
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
      },
    }
  );
}
