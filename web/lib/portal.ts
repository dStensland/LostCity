import { cache } from "react";
import { supabase } from "@/lib/supabase";
import type { Portal } from "@/lib/portal-context";
import { getCachedDomain, setCachedDomain } from "@/lib/domain-cache";
import { normalizePortalSlug, resolvePortalSlugAlias } from "@/lib/portal-aliases";
import crypto from "crypto";

export type PortalVertical = "city" | "hotel" | "film" | "hospital" | "community" | "marketplace" | "dog";

/**
 * Get the portal vertical type (defaults to "city" if not set).
 * Server-safe version — can be used in server components and layouts.
 */
export function getPortalVertical(portal: Portal): PortalVertical {
  return (portal.settings?.vertical as PortalVertical) || "city";
}

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

type PortalAliasOverride = {
  sourceSlug: string;
  overrides: Partial<Portal> & {
    branding?: Partial<Portal["branding"]>;
    settings?: Partial<Portal["settings"]>;
    filters?: Partial<Portal["filters"]>;
  };
};

const PORTAL_ALIAS_OVERRIDES: Record<string, PortalAliasOverride> = {
  "atlanta-test": {
    sourceSlug: "atlanta",
    overrides: {
      slug: "atlanta-test",
      name: "Atlanta Test",
      tagline: "ATL Nocturne Signal trial run",
      branding: {
        visual_preset: "default",
        theme_mode: "dark",
        primary_color: "#e4a64f",
        secondary_color: "#6f82d8",
        accent_color: "#d77d37",
        background_color: "#050713",
        text_color: "#e8edff",
        muted_color: "#8b98c9",
        button_color: "#e4a64f",
        button_text_color: "#081225",
        border_color: "#232f62",
        card_color: "#11193b",
        font_heading: "Space Grotesk",
        font_body: "Inter",
        ambient: {
          effect: "rain",
          intensity: "medium",
          colors: {
            primary: "#6f82d8",
            secondary: "#d99e48",
          },
          animation_speed: "medium",
        },
        component_style: {
          border_radius: "md",
          shadows: "medium",
          card_style: "glass",
          button_style: "default",
          glow_enabled: true,
          glow_intensity: "medium",
          animations: "full",
          glass_enabled: true,
        },
        category_colors: {
          music: "#7085de",
          nightlife: "#dca150",
          comedy: "#efba73",
          film: "#8b9ee8",
          art: "#7d99ea",
          community: "#d8ac68",
        },
      },
      settings: {
        icon_glow: true,
        experience_variant: "nocturne_signal",
        meta_description: "Atlanta Nocturne Signal trial portal. Deep blue-violet city rain with restrained incandescent amber accents.",
      },
    },
  },
  "atlanta-test-mood-1": {
    sourceSlug: "atlanta",
    overrides: {
      slug: "atlanta-test-mood-1",
      name: "Atlanta Test Mood 01",
      tagline: "ATL Moodboard 01 · Neon Hush",
      branding: {
        visual_preset: "default",
        theme_mode: "dark",
        primary_color: "#e9ae54",
        secondary_color: "#7a90ef",
        accent_color: "#d97536",
        background_color: "#040611",
        text_color: "#e7ecff",
        muted_color: "#8a9ad1",
        button_color: "#e9ae54",
        button_text_color: "#081225",
        border_color: "#273567",
        card_color: "#11183b",
        font_heading: "Space Grotesk",
        font_body: "Inter",
        ambient: {
          effect: "rain",
          intensity: "medium",
          colors: {
            primary: "#7a90ef",
            secondary: "#cf9244",
          },
          animation_speed: "medium",
        },
        component_style: {
          border_radius: "md",
          shadows: "medium",
          card_style: "glass",
          button_style: "default",
          glow_enabled: true,
          glow_intensity: "medium",
          animations: "full",
          glass_enabled: true,
        },
        category_colors: {
          music: "#768eef",
          nightlife: "#d9a356",
          comedy: "#eab46b",
          film: "#8b9ef1",
          art: "#7d9aec",
          community: "#cfab6d",
        },
      },
      settings: {
        icon_glow: true,
        experience_variant: "nocturne_signal_m1",
        meta_description: "Atlanta moodboard 01. Dark blue-violet rain with controlled amber accents.",
      },
    },
  },
  "atlanta-test-mood-2": {
    sourceSlug: "atlanta",
    overrides: {
      slug: "atlanta-test-mood-2",
      name: "Atlanta Test Mood 02",
      tagline: "ATL Moodboard 02 · Backroom Voltage",
      branding: {
        visual_preset: "default",
        theme_mode: "dark",
        primary_color: "#f1b45a",
        secondary_color: "#8ea4ff",
        accent_color: "#f07e3b",
        background_color: "#03040f",
        text_color: "#eaf0ff",
        muted_color: "#95a4dc",
        button_color: "#f1b45a",
        button_text_color: "#081225",
        border_color: "#2b3c7f",
        card_color: "#11183d",
        font_heading: "Space Grotesk",
        font_body: "Inter",
        ambient: {
          effect: "rain",
          intensity: "bold",
          colors: {
            primary: "#8ea4ff",
            secondary: "#e0a14d",
          },
          animation_speed: "medium",
        },
        component_style: {
          border_radius: "md",
          shadows: "medium",
          card_style: "glass",
          button_style: "default",
          glow_enabled: true,
          glow_intensity: "intense",
          animations: "full",
          glass_enabled: true,
        },
        category_colors: {
          music: "#90a6ff",
          nightlife: "#efb15e",
          comedy: "#ffc977",
          film: "#9caeff",
          art: "#89a5ff",
          community: "#e6b46b",
        },
      },
      settings: {
        icon_glow: true,
        experience_variant: "nocturne_signal_m2",
        meta_description: "Atlanta moodboard 02. High-contrast rain noir with hotter amber and stronger neon edge.",
      },
    },
  },
  "atlanta-test-mood-3": {
    sourceSlug: "atlanta",
    overrides: {
      slug: "atlanta-test-mood-3",
      name: "Atlanta Test Mood 03",
      tagline: "ATL Moodboard 03 · Midnight Siren",
      branding: {
        visual_preset: "default",
        theme_mode: "dark",
        primary_color: "#ffc166",
        secondary_color: "#9aafff",
        accent_color: "#ff8f45",
        background_color: "#02030b",
        text_color: "#edf2ff",
        muted_color: "#a2b2ea",
        button_color: "#ffc166",
        button_text_color: "#071023",
        border_color: "#4a3e9f",
        card_color: "#1a1747",
        font_heading: "Space Grotesk",
        font_body: "Inter",
        ambient: {
          effect: "rain",
          intensity: "bold",
          colors: {
            primary: "#9aafff",
            secondary: "#f0ac53",
          },
          animation_speed: "fast",
        },
        component_style: {
          border_radius: "md",
          shadows: "medium",
          card_style: "glass",
          button_style: "default",
          glow_enabled: true,
          glow_intensity: "intense",
          animations: "full",
          glass_enabled: true,
        },
        category_colors: {
          music: "#9cb1ff",
          nightlife: "#ffbc63",
          comedy: "#ffd48a",
          film: "#a8b8ff",
          art: "#93afff",
          community: "#f0bd72",
        },
      },
      settings: {
        icon_glow: true,
        experience_variant: "nocturne_signal_m3",
        meta_description: "Atlanta moodboard 03. Maximum nocturne intensity with electric blue-violet rain and sodium-lamp flare.",
      },
    },
  },
};

function applyPortalAliasOverride(
  basePortal: Portal,
  requestedSlug: string,
  aliasOverride: PortalAliasOverride
): Portal {
  const merged: Portal = {
    ...basePortal,
    ...aliasOverride.overrides,
    slug: requestedSlug,
    branding: {
      ...basePortal.branding,
      ...(aliasOverride.overrides.branding || {}),
    },
    settings: {
      ...basePortal.settings,
      ...(aliasOverride.overrides.settings || {}),
    },
    filters: {
      ...basePortal.filters,
      ...(aliasOverride.overrides.filters || {}),
    },
  };

  return merged;
}

/**
 * Get a portal by its slug. Returns null if not found or not active.
 * All portals must exist in the database - there is no hardcoded fallback.
 */
export async function getPortalBySlug(slug: string): Promise<Portal | null> {
  const normalizedSlug = normalizePortalSlug(slug);
  const lookupSlug = resolvePortalSlugAlias(normalizedSlug);

  // Try with all columns first (including B2B columns)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let result = await (supabase as any)
    .from("portals")
    .select(`${BASE_PORTAL_COLUMNS},${B2B_PORTAL_COLUMNS}`)
    .eq("slug", lookupSlug)
    .eq("status", "active")
    .maybeSingle();

  // If error mentions missing columns, retry with just base columns
  if (result.error && result.error.message?.includes("column")) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    result = await (supabase as any)
      .from("portals")
      .select(BASE_PORTAL_COLUMNS)
      .eq("slug", lookupSlug)
      .eq("status", "active")
      .maybeSingle();
  }

  if (result.error || !result.data) {
    return null;
  }

  const portal = result.data as Portal;
  if (normalizedSlug === lookupSlug) {
    return portal;
  }

  const aliasOverride = PORTAL_ALIAS_OVERRIDES[normalizedSlug];
  if (aliasOverride && aliasOverride.sourceSlug === lookupSlug) {
    return applyPortalAliasOverride(portal, normalizedSlug, aliasOverride);
  }

  return {
    ...portal,
    slug: normalizedSlug,
  };
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
  return crypto.randomBytes(16).toString("hex");
}

/**
 * Cached version of getPortalBySlug for use in pages/layouts.
 * Deduplicates calls within the same request using React cache().
 */
export const getCachedPortalBySlug = cache(getPortalBySlug);
