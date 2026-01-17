import { supabase } from "@/lib/supabase";

export type PortalSectionItem = {
  id: string;
  entity_type: string;
  entity_id: number;
  display_order: number;
  note: string | null;
  // Hydrated event data
  event?: {
    id: number;
    title: string;
    start_date: string;
    start_time: string | null;
    category_id: string;
    is_free: boolean;
    venue: {
      id: number;
      name: string;
      slug: string;
    } | null;
  };
};

export type PortalSection = {
  id: string;
  portal_id: string;
  slug: string;
  title: string;
  description: string | null;
  section_type: "auto" | "curated" | "mixed";
  auto_filter: Record<string, unknown> | null;
  display_order: number;
  is_visible: boolean;
  items: PortalSectionItem[];
};

/**
 * Get visible sections for a portal with hydrated event data
 */
export async function getPortalSections(portalId: string): Promise<PortalSection[]> {
  // Fetch sections with items
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: sections, error } = await (supabase as any)
    .from("portal_sections")
    .select(`
      id,
      portal_id,
      slug,
      title,
      description,
      section_type,
      auto_filter,
      display_order,
      is_visible,
      items:portal_section_items(
        id,
        entity_type,
        entity_id,
        display_order,
        note
      )
    `)
    .eq("portal_id", portalId)
    .eq("is_visible", true)
    .order("display_order", { ascending: true });

  if (error || !sections) {
    console.error("Error fetching portal sections:", error);
    return [];
  }

  // Hydrate event data for curated sections
  const hydratedSections: PortalSection[] = [];

  for (const section of sections as PortalSection[]) {
    if (section.section_type === "curated" && section.items?.length > 0) {
      // Get event IDs
      const eventIds = section.items
        .filter((item) => item.entity_type === "event")
        .map((item) => item.entity_id);

      if (eventIds.length > 0) {
        // Fetch event data
        const { data: events } = await supabase
          .from("events")
          .select(`
            id,
            title,
            start_date,
            start_time,
            category_id,
            is_free,
            venue:venues(id, name, slug)
          `)
          .in("id", eventIds);

        type EventData = {
          id: number;
          title: string;
          start_date: string;
          start_time: string | null;
          category_id: string;
          is_free: boolean;
          venue: { id: number; name: string; slug: string } | null;
        };

        // Map events to items
        const eventMap = new Map(
          ((events || []) as EventData[]).map((e) => [e.id, e])
        );

        section.items = section.items
          .sort((a, b) => a.display_order - b.display_order)
          .map((item) => ({
            ...item,
            event: item.entity_type === "event"
              ? (eventMap.get(item.entity_id) as PortalSectionItem["event"])
              : undefined,
          }));
      }
    }

    hydratedSections.push(section);
  }

  return hydratedSections;
}
