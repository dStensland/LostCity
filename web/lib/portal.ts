import { supabase } from "@/lib/supabase";
import type { Portal } from "@/lib/portal-context";
import { getCachedDomain, setCachedDomain } from "@/lib/domain-cache";

// Base columns that always exist in the portals table
const BASE_PORTAL_COLUMNS = `
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
`;

// B2B columns that may not exist yet (added in 091_custom_domains migration)
// We'll try to select these but gracefully handle if they don't exist
const B2B_PORTAL_COLUMNS = `
  plan,
  custom_domain,
  parent_portal_id
`;

/**
 * Get a portal by its slug. Returns null if not found or not active.
 * All portals must exist in the database - there is no hardcoded fallback.
 */
export async function getPortalBySlug(slug: string): Promise<Portal | null> {
  // Try with all columns first (including B2B columns)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let result = await (supabase as any)
    .from("portals")
    .select(`${BASE_PORTAL_COLUMNS},${B2B_PORTAL_COLUMNS}`)
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  // If error mentions missing columns, retry with just base columns
  if (result.error && result.error.message?.includes("column")) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    result = await (supabase as any)
      .from("portals")
      .select(BASE_PORTAL_COLUMNS)
      .eq("slug", slug)
      .eq("status", "active")
      .maybeSingle();
  }

  if (result.error || !result.data) {
    return null;
  }

  return result.data as Portal;
}

/**
 * Get a portal by its ID. Returns null if not found or not active.
 */
export async function getPortalById(id: string): Promise<Portal | null> {
  // Try with all columns first (including B2B columns)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let result = await (supabase as any)
    .from("portals")
    .select(`${BASE_PORTAL_COLUMNS},${B2B_PORTAL_COLUMNS}`)
    .eq("id", id)
    .eq("status", "active")
    .maybeSingle();

  // If error mentions missing columns, retry with just base columns
  if (result.error && result.error.message?.includes("column")) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    result = await (supabase as any)
      .from("portals")
      .select(BASE_PORTAL_COLUMNS)
      .eq("id", id)
      .eq("status", "active")
      .maybeSingle();
  }

  if (result.error || !result.data) {
    return null;
  }

  return result.data as Portal;
}

/**
 * Get all active portals.
 */
export async function getAllPortals(): Promise<Portal[]> {
  // Try with all columns first (including B2B columns)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let result = await (supabase as any)
    .from("portals")
    .select(`${BASE_PORTAL_COLUMNS},${B2B_PORTAL_COLUMNS}`)
    .eq("status", "active")
    .order("name");

  // If error mentions missing columns, retry with just base columns
  if (result.error && result.error.message?.includes("column")) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    result = await (supabase as any)
      .from("portals")
      .select(BASE_PORTAL_COLUMNS)
      .eq("status", "active")
      .order("name");
  }

  if (result.error || !result.data) {
    return [];
  }

  return result.data as Portal[];
}

/**
 * Resolve a custom domain to a portal slug.
 * Uses in-memory caching with 5-minute TTL for performance.
 *
 * @param domain The custom domain (e.g., "events.marriott.com")
 * @returns The portal slug if found and verified, null otherwise
 */
export async function resolveCustomDomain(domain: string): Promise<string | null> {
  // Normalize domain
  const normalizedDomain = domain.toLowerCase().replace(/^www\./, "");

  // Check cache first
  const cached = getCachedDomain(normalizedDomain);
  if (cached !== undefined) {
    return cached; // null means verified not found, string is the slug
  }

  // Query database for custom domain
  // Uses type assertion since custom_domain is a new column
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("portals")
    .select("slug")
    .eq("custom_domain", normalizedDomain)
    .eq("custom_domain_verified", true)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    // If the error is about missing columns, custom domains aren't supported yet
    if (error.message?.includes("column")) {
      setCachedDomain(normalizedDomain, null);
      return null;
    }
    console.error("Error resolving custom domain:", error);
    // Don't cache other errors - let it retry next time
    return null;
  }

  const slug = data?.slug || null;

  // Cache the result (including null for "not found")
  setCachedDomain(normalizedDomain, slug);

  return slug;
}

/**
 * Check if a custom domain is available for use.
 * Returns true if the domain is not in use by any other portal.
 *
 * @param domain The custom domain to check
 * @param excludePortalId Optional portal ID to exclude (for updating existing portal)
 */
export async function isCustomDomainAvailable(
  domain: string,
  excludePortalId?: string
): Promise<boolean> {
  const normalizedDomain = domain.toLowerCase().replace(/^www\./, "");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("portals")
    .select("id")
    .eq("custom_domain", normalizedDomain);

  if (excludePortalId) {
    query = query.neq("id", excludePortalId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    // If the column doesn't exist, treat all domains as available (migration not run yet)
    if (error.message?.includes("column")) {
      return true;
    }
    console.error("Error checking custom domain availability:", error);
    return false; // Assume not available on other errors
  }

  return !data; // Available if no portal found
}

/**
 * Generate a verification token for custom domain DNS verification.
 * The token should be added as a TXT record at _lostcity-verify.{domain}
 */
export function generateDomainVerificationToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}
