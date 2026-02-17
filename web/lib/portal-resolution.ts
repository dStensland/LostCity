import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { isValidUUID } from "@/lib/api-utils";
import { resolvePortalSlugAlias } from "@/lib/portal-aliases";
import {
  extractPortalFromRedirect,
  PORTAL_CONTEXT_COOKIE,
  isValidPortalSlug,
} from "@/lib/auth-utils";

/**
 * Extract portal slug from Referer header
 * Example: https://lostcity.app/atl-dogs/events/123 → "atl-dogs"
 */
export function extractPortalSlugFromReferer(request: NextRequest): string | null {
  const referer = request.headers.get("referer");
  if (!referer) return null;

  try {
    const url = new URL(referer);
    return extractPortalFromRedirect(url.pathname);
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
  let portalId: string | null = null;

  // 1. Try to get portal context from request body
  try {
    const body = await request.clone().json();
    if (typeof body?.portal_slug === "string" && body.portal_slug.trim()) {
      portalSlug = body.portal_slug.trim();
    }
    if (typeof body?.portal_id === "string" && isValidUUID(body.portal_id)) {
      portalId = body.portal_id;
    }
  } catch {
    // No body or invalid JSON - continue
  }

  // 2. Try explicit headers
  if (!portalId) {
    const headerPortalId = request.headers.get("x-portal-id");
    if (headerPortalId && isValidUUID(headerPortalId)) {
      portalId = headerPortalId;
    }
  }
  if (!portalSlug) {
    const headerPortalSlug = request.headers.get("x-portal-slug");
    if (headerPortalSlug) {
      portalSlug = headerPortalSlug.trim();
    }
  }

  // 3. Try query parameters
  try {
    const url = new URL(request.url);
    if (!portalId) {
      const queryPortalId = url.searchParams.get("portal_id");
      if (queryPortalId && isValidUUID(queryPortalId)) {
        portalId = queryPortalId;
      }
    }
    if (!portalSlug) {
      const queryPortalSlug = url.searchParams.get("portal");
      if (queryPortalSlug) {
        portalSlug = queryPortalSlug.trim();
      }
    }
  } catch {
    // Invalid URL should not block fallback resolution
  }

  // 4. Fall back to Referer header
  if (!portalSlug) {
    portalSlug = extractPortalSlugFromReferer(request);
  }

  // 5. Fall back to remembered portal cookie
  if (!portalSlug) {
    const cookieSlug = request.cookies.get(PORTAL_CONTEXT_COOKIE)?.value || null;
    if (cookieSlug && isValidPortalSlug(cookieSlug)) {
      portalSlug = cookieSlug;
    }
  }

  // 6. Resolve by slug first (canonical contract), then by UUID
  if (portalSlug) {
    const canonicalSlug = resolvePortalSlugAlias(portalSlug);
    const { data, error } = await supabase
      .from("portals")
      .select("id")
      .eq("slug", canonicalSlug)
      .eq("status", "active")
      .maybeSingle();

    if (!error && data) {
      return (data as { id: string }).id;
    }
  }

  if (!portalId) return null;

  const { data, error } = await supabase
    .from("portals")
    .select("id")
    .eq("id", portalId)
    .eq("status", "active")
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return (data as { id: string }).id;
}
