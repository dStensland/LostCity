import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";

/**
 * Extract portal slug from Referer header
 * Example: https://lostcity.app/atl-dogs/events/123 → "atl-dogs"
 */
export function extractPortalSlugFromReferer(request: NextRequest): string | null {
  const referer = request.headers.get("referer");
  if (!referer) return null;

  try {
    const url = new URL(referer);
    const pathSegments = url.pathname.split("/").filter(Boolean);

    // First segment is the portal slug
    return pathSegments[0] || null;
  } catch {
    return null;
  }
}

/**
 * Resolve portal ID from request
 *
 * Checks request body for portal_slug, falls back to Referer header parsing.
 * Looks up the portal in the database and returns its ID.
 *
 * @param request - Next.js request object
 * @returns Portal ID string or null if not found
 */
export async function resolvePortalId(request: NextRequest): Promise<string | null> {
  let portalSlug: string | null = null;

  // 1. Try to get portal_slug from request body
  try {
    const body = await request.clone().json();
    portalSlug = body.portal_slug || null;
  } catch {
    // No body or invalid JSON - continue
  }

  // 2. Fall back to Referer header
  if (!portalSlug) {
    portalSlug = extractPortalSlugFromReferer(request);
  }

  // 3. If no slug found, return null
  if (!portalSlug) return null;

  // 4. Look up portal ID in database
  const { data, error } = await supabase
    .from("portals")
    .select("id")
    .eq("slug", portalSlug)
    .eq("status", "active")
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return (data as { id: string }).id;
}
