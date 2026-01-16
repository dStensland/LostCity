import { supabase } from "@/lib/supabase";
import type { Portal } from "@/lib/portal-context";

export async function getPortalBySlug(slug: string): Promise<Portal | null> {
  const { data, error } = await supabase
    .from("portals")
    .select(`
      id,
      slug,
      name,
      tagline,
      portal_type,
      status,
      visibility,
      filters,
      branding,
      settings
    `)
    .eq("slug", slug)
    .eq("status", "active")
    .single();

  if (error || !data) {
    return null;
  }

  return data as Portal;
}

// Default Atlanta portal for fallback
export const DEFAULT_PORTAL: Portal = {
  id: "default",
  slug: "atlanta",
  name: "Atlanta",
  tagline: "The real Atlanta, found",
  portal_type: "city",
  status: "active",
  visibility: "public",
  filters: { city: "Atlanta" },
  branding: {},
  settings: {},
};
