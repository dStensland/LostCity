import { supabase } from "@/lib/supabase";
import type { Portal } from "@/lib/portal-context";

/**
 * Get a portal by its slug. Returns null if not found or not active.
 * All portals must exist in the database - there is no hardcoded fallback.
 */
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
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as Portal;
}

/**
 * Get a portal by its ID. Returns null if not found or not active.
 */
export async function getPortalById(id: string): Promise<Portal | null> {
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
    .eq("id", id)
    .eq("status", "active")
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as Portal;
}

/**
 * Get all active portals.
 */
export async function getAllPortals(): Promise<Portal[]> {
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
    .eq("status", "active")
    .order("name");

  if (error || !data) {
    return [];
  }

  return data as Portal[];
}
