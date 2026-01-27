import { supabase } from "./supabase";

// ============================================
// Types
// ============================================

export interface PortalFilters {
  // Location filters
  city?: string;
  geo_center?: [number, number];
  geo_radius_km?: number;

  // Time filters
  date_range?: [string, string];

  // Category filters
  categories?: string[];
  exclude_categories?: string[];

  // Other filters
  price_max?: number;
  venue_ids?: number[];
  tags?: string[];
}

export interface PortalBranding {
  logo_url?: string;
  hero_image_url?: string;
  favicon_url?: string;
  primary_color?: string;
  secondary_color?: string;
  background_color?: string;
  font_heading?: string;
  font_body?: string;
  custom_css?: string;
}

export interface PortalSettings {
  show_map?: boolean;
  show_categories?: boolean;
  show_search?: boolean;
  default_view?: "list" | "grid" | "map";
  featured_limit?: number;
  contact_email?: string;
  meta_description?: string;
  og_image_url?: string;
  exclude_adult?: boolean;  // Hide adult entertainment content from this portal
}

export interface Portal {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  portal_type: "city" | "event" | "business" | "personal";
  status: "draft" | "active" | "archived";
  visibility: "public" | "unlisted" | "private";
  filters: PortalFilters;
  branding: PortalBranding;
  settings: PortalSettings;
  created_at: string;
  updated_at: string;
}

export interface CustomEventContent {
  title: string;
  description?: string;
  start_date: string;
  end_date?: string;
  start_time?: string;
  end_time?: string;
  venue_name?: string;
  venue_address?: string;
  image_url?: string;
  ticket_url?: string;
  category?: string;
}

export interface PortalContent {
  id: string;
  portal_id: string;
  content_type: "custom_event" | "featured" | "announcement";
  entity_type?: string;
  entity_id?: number;
  content?: CustomEventContent;
  display_order: number;
  is_pinned: boolean;
  visibility: "portal_only" | "public";
}

// ============================================
// Queries
// ============================================

export async function getPortalBySlug(slug: string): Promise<Portal | null> {
  const { data, error } = await supabase
    .from("portals")
    .select("*")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  if (error || !data) {
    console.error("Error fetching portal:", error);
    return null;
  }

  return data as Portal;
}

export async function getPortalCustomEvents(
  portalId: string
): Promise<PortalContent[]> {
  const { data, error } = await supabase
    .from("portal_content")
    .select("*")
    .eq("portal_id", portalId)
    .eq("content_type", "custom_event")
    .order("display_order");

  if (error) {
    console.error("Error fetching custom events:", error);
    return [];
  }

  return (data as PortalContent[]) || [];
}

export async function getPortalFeaturedEvents(
  portalId: string
): Promise<PortalContent[]> {
  const { data, error } = await supabase
    .from("portal_content")
    .select("*")
    .eq("portal_id", portalId)
    .eq("content_type", "featured")
    .order("display_order");

  if (error) {
    console.error("Error fetching featured events:", error);
    return [];
  }

  return (data as PortalContent[]) || [];
}

export async function getAllActivePortals(): Promise<Portal[]> {
  const { data, error } = await supabase
    .from("portals")
    .select("*")
    .eq("status", "active")
    .eq("visibility", "public")
    .order("name");

  if (error) {
    console.error("Error fetching portals:", error);
    return [];
  }

  return (data as Portal[]) || [];
}
