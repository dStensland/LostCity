"use client";

import { createContext, useContext, ReactNode } from "react";
import { DEFAULT_PORTAL_SLUG, DEFAULT_PORTAL_NAME } from "./constants";
import type {
  VisualPresetId,
  HeaderTemplate,
  AmbientEffect,
  BorderRadius,
  ShadowLevel,
  CardStyle,
  ButtonStyle,
  GlowIntensity,
  AnimationLevel,
  IntensityLevel,
  SpeedLevel,
  LogoPosition,
  LogoSize,
  NavStyle,
  HeroHeight,
} from "./visual-presets";

// Re-export from shared constants for backwards compatibility
export { DEFAULT_PORTAL_SLUG, DEFAULT_PORTAL_NAME };

// Re-export visual preset types for convenience
export type {
  VisualPresetId,
  HeaderTemplate,
  AmbientEffect,
  BorderRadius,
  ShadowLevel,
  CardStyle,
  ButtonStyle,
  GlowIntensity,
  AnimationLevel,
  IntensityLevel,
  SpeedLevel,
  LogoPosition,
  LogoSize,
  NavStyle,
  HeroHeight,
};

// ============================================================================
// Portal Filters Type
// ============================================================================

/**
 * Filters that can be applied to portal event queries.
 * Used by the filters module and portal admin pages.
 */
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

// ============================================================================
// Header Configuration Type
// ============================================================================

export interface PortalHeaderConfig {
  /** Header layout template */
  template: HeaderTemplate;
  /** Logo position: left or center */
  logo_position?: LogoPosition;
  /** Logo size */
  logo_size?: LogoSize;
  /** Navigation style */
  nav_style?: NavStyle;
  /** Show search button in header */
  show_search_in_header?: boolean;
  /** Make header transparent when at top of page (for immersive) */
  transparent_on_top?: boolean;
  /** Hero section configuration (for branded/immersive headers) */
  hero?: {
    image_url?: string;
    height?: HeroHeight;
    overlay_opacity?: number;
    title_visible?: boolean;
    tagline_visible?: boolean;
  } | null;
}

// ============================================================================
// Ambient Effects Configuration Type
// ============================================================================

export interface PortalAmbientConfig {
  /** Background effect type */
  effect: AmbientEffect;
  /** Effect intensity */
  intensity?: IntensityLevel;
  /** Custom colors for the effect */
  colors?: {
    primary?: string;
    secondary?: string;
  };
  /** Number of particles (for particle_field effect) */
  particle_count?: number;
  /** Animation speed */
  animation_speed?: SpeedLevel;
}

// ============================================================================
// Component Style Configuration Type
// ============================================================================

export interface PortalComponentStyle {
  /** Border radius for cards, buttons, etc. */
  border_radius?: BorderRadius;
  /** Shadow level for cards */
  shadows?: ShadowLevel;
  /** Card visual style */
  card_style?: CardStyle;
  /** Button visual style */
  button_style?: ButtonStyle;
  /** Enable neon glow effects */
  glow_enabled?: boolean;
  /** Glow effect intensity */
  glow_intensity?: GlowIntensity;
  /** Animation level */
  animations?: AnimationLevel;
  /** Enable glass/frosted effects */
  glass_enabled?: boolean;
}

// ============================================================================
// Feed Layout Configuration Type
// ============================================================================

export interface PortalFeedConfig {
  /** Feed layout type */
  layout: "vertical" | "horizontal" | "grid" | "masonry" | "timeline";
  /** Card variant to use */
  card_variant: "compact" | "standard" | "hero" | "poster" | "minimal";
  /** Feed sections to display (in order) */
  sections: Array<"featured" | "for_you" | "trending" | "by_category" | "friends_activity">;
  /** Hero section style at the top of the feed */
  hero_style: "carousel" | "single" | "none";
  /** Show filter UI */
  show_filters: boolean;
  /** Group events by this field */
  group_by: "none" | "date" | "category" | "neighborhood";
}

// ============================================================================
// Portal Branding Type (Extended)
// ============================================================================

export interface PortalBranding {
  // Core asset URLs
  logo_url?: string;
  hero_image_url?: string;
  favicon_url?: string;
  og_image_url?: string;

  // Color palette
  primary_color?: string;
  secondary_color?: string;
  accent_color?: string;
  background_color?: string;
  text_color?: string;
  muted_color?: string;
  button_color?: string;
  button_text_color?: string;
  border_color?: string;
  card_color?: string;

  // Typography
  font_heading?: string;
  font_body?: string;

  // Theme mode
  theme_mode?: "dark" | "light";

  // Enterprise-only branding
  /** Enterprise only: Hide "Powered by LostCity" attribution */
  hide_attribution?: boolean;
  /** Enterprise only: Custom footer text replacing "© LostCity" */
  footer_text?: string;
  /** Enterprise only: Custom footer links */
  footer_links?: { label: string; url: string }[];
  /** Enterprise only: Brand name for sharing (e.g., "Discovered on {brand}") */
  sharing_brand_name?: string;

  // NEW: Visual preset (base theme package)
  visual_preset?: VisualPresetId;

  // NEW: Header configuration
  header?: Partial<PortalHeaderConfig>;

  // NEW: Ambient/background effects
  ambient?: Partial<PortalAmbientConfig>;

  // NEW: Portal-specific category colors (overrides global category colors)
  category_colors?: Record<string, string>;

  // NEW: Component style variants
  component_style?: Partial<PortalComponentStyle>;

  // Allow additional fields for extensibility
  [key: string]: unknown;
}

export type Portal = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  portal_type: "city" | "event" | "business" | "personal";
  status: string;
  visibility: string;
  /** Plan tier: starter (free), professional, or enterprise */
  plan?: "starter" | "professional" | "enterprise";
  /** Custom domain for white-label portals (e.g., events.marriott.com) */
  custom_domain?: string | null;
  /** Parent city portal ID for B2B portals */
  parent_portal_id?: string | null;
  /** Page template override */
  page_template?: "default" | "gallery" | "timeline" | "custom";
  /** Custom component overrides (paths to components) */
  custom_components?: {
    feed?: string;
    header?: string;
  };
  filters: {
    city?: string;
    geo_center?: [number, number];
    geo_radius_km?: number;
    categories?: string[];
    exclude_categories?: string[];
    neighborhoods?: string[];
    date_range_start?: string;
    date_range_end?: string;
    price_max?: number;
    venue_ids?: number[];
    tags?: string[];
  };
  branding: PortalBranding;
  settings: {
    /** Portal vertical/industry type - determines UI/UX treatment */
    vertical?: "city" | "hotel" | "film" | "hospital" | "community";
    nav_labels?: {
      feed?: string;
      events?: string;
      spots?: string;
    };
    feed?: {
      hide_images?: boolean;
      feed_type?: string;
      featured_section_ids?: string[];
      items_per_section?: number;
      default_layout?: string;
    };
    /** Feed layout configuration */
    feed_config?: Partial<PortalFeedConfig>;
    meta_description?: string;
    show_map?: boolean;
    default_view?: string;
    show_categories?: boolean;
    /** Enable neon glow on category icons (default: true) */
    icon_glow?: boolean;
    /** Hide adult entertainment content from this portal */
    exclude_adult?: boolean;
    [key: string]: unknown;
  };
};

type PortalContextValue = {
  portal: Portal;
  isLoading: boolean;
};

const PortalContext = createContext<PortalContextValue | null>(null);

export function PortalProvider({
  portal,
  children,
}: {
  portal: Portal;
  children: ReactNode;
}) {
  return (
    <PortalContext.Provider value={{ portal, isLoading: false }}>
      {children}
    </PortalContext.Provider>
  );
}

export function usePortal(): PortalContextValue {
  const context = useContext(PortalContext);
  if (!context) {
    throw new Error(
      "usePortal must be used within a PortalProvider. " +
      "Ensure the component is wrapped in a PortalProvider with a valid portal from the database."
    );
  }
  return context;
}

/**
 * Optional version of usePortal that returns null when outside a PortalProvider.
 * Use this in components that may be rendered outside portal context (e.g., settings pages).
 */
export function usePortalOptional(): PortalContextValue | null {
  return useContext(PortalContext);
}

/**
 * Default portal object for use when outside portal context.
 * Provides fallback values for components that need portal data.
 */
export const DEFAULT_PORTAL: Portal = {
  id: "",
  slug: DEFAULT_PORTAL_SLUG,
  name: DEFAULT_PORTAL_NAME,
  tagline: null,
  portal_type: "city",
  status: "active",
  visibility: "public",
  filters: {},
  branding: {},
  settings: {},
};

/**
 * Get the current portal slug. Use this for building portal-relative URLs.
 */
export function usePortalSlug() {
  const { portal } = usePortal();
  return portal.slug;
}

/**
 * Build a portal-relative URL.
 * @param path - The path within the portal (e.g., "events", "?view=spots")
 * @param portalSlug - Optional portal slug override
 */
export function buildPortalUrl(path: string, portalSlug?: string) {
  const slug = portalSlug || DEFAULT_PORTAL_SLUG;
  if (path.startsWith("?") || path.startsWith("/")) {
    return `/${slug}${path}`;
  }
  return `/${slug}/${path}`;
}

export function usePortalName() {
  const { portal } = usePortal();
  return portal.name;
}

export function usePortalCity() {
  const { portal } = usePortal();
  return portal.filters.city || portal.name;
}

/**
 * Get the portal vertical type (defaults to "city" if not set)
 */
export function getPortalVertical(portal: Portal): "city" | "hotel" | "film" | "hospital" | "community" {
  return portal.settings?.vertical || "city";
}
