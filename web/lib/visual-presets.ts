/**
 * Visual Presets - Pre-designed theme packages for portal white-labeling
 *
 * These presets provide complete visual identity packages that can be applied
 * as a starting point and then customized. AI will configure portals, so
 * complexity is acceptable.
 */

// ============================================================================
// Type Definitions
// ============================================================================

export type VisualPresetId =
  | "default"
  | "corporate_clean"
  | "vibrant_community"
  | "nightlife"
  | "family_friendly"
  | "minimal_modern"
  | "cosmic_dark"
  | "neon_honkytonk"
  | "custom";

export type HeaderTemplate = "standard" | "minimal" | "branded" | "immersive";

export type AmbientEffect =
  | "none"
  | "rain"
  | "subtle_glow"
  | "gradient_wave"
  | "particle_field"
  | "aurora"
  | "mesh_gradient"
  | "noise_texture"
  | "shifting_neighborhood"
  | "constellation"
  | "flowing_streets"
  | "growing_garden"
  | "floating_leaves"
  | "neon_broadway";

export type BorderRadius = "none" | "sm" | "md" | "lg" | "full";
export type ShadowLevel = "none" | "subtle" | "medium" | "elevated";
export type CardStyle = "default" | "flat" | "elevated" | "outlined" | "glass" | "neumorphic";
export type ButtonStyle = "default" | "outline" | "ghost" | "pill" | "sharp";
export type GlowIntensity = "subtle" | "medium" | "intense";
export type AnimationLevel = "none" | "subtle" | "full";
export type IntensityLevel = "subtle" | "medium" | "bold";
export type SpeedLevel = "slow" | "medium" | "fast";
export type LogoPosition = "left" | "center";
export type LogoSize = "sm" | "md" | "lg";
export type NavStyle = "tabs" | "pills" | "underline" | "minimal";
export type HeroHeight = "sm" | "md" | "lg" | "full";

// ============================================================================
// Header Configuration
// ============================================================================

export interface HeaderConfig {
  template: HeaderTemplate;
  logo_position?: LogoPosition;
  logo_size?: LogoSize;
  nav_style?: NavStyle;
  show_search_in_header?: boolean;
  transparent_on_top?: boolean;
  hero?: {
    image_url?: string;
    height?: HeroHeight;
    overlay_opacity?: number;
    title_visible?: boolean;
    tagline_visible?: boolean;
  } | null;
}

// ============================================================================
// Ambient Configuration
// ============================================================================

export interface AmbientConfig {
  effect: AmbientEffect;
  intensity?: IntensityLevel;
  colors?: {
    primary?: string;
    secondary?: string;
  };
  particle_count?: number;
  animation_speed?: SpeedLevel;
}

// ============================================================================
// Component Style Configuration
// ============================================================================

export interface ComponentStyleConfig {
  border_radius?: BorderRadius;
  shadows?: ShadowLevel;
  card_style?: CardStyle;
  button_style?: ButtonStyle;
  glow_enabled?: boolean;
  glow_intensity?: GlowIntensity;
  animations?: AnimationLevel;
  glass_enabled?: boolean;
}

// ============================================================================
// Visual Preset Definition
// ============================================================================

export interface VisualPreset {
  id: VisualPresetId;
  name: string;
  description: string;
  bestFor: string;

  // Color scheme
  colors: {
    primary_color: string;
    secondary_color: string;
    accent_color: string;
    background_color: string;
    text_color: string;
    muted_color: string;
    button_color: string;
    button_text_color: string;
    border_color: string;
    card_color: string;
  };

  // Theme mode
  theme_mode: "dark" | "light";

  // Header configuration
  header: HeaderConfig;

  // Ambient effects
  ambient: AmbientConfig;

  // Component styles
  component_style: ComponentStyleConfig;

  // Category color overrides (optional)
  category_colors?: Record<string, string>;
}

// ============================================================================
// Preset Definitions
// ============================================================================

export const VISUAL_PRESETS: Record<VisualPresetId, VisualPreset> = {
  default: {
    id: "default",
    name: "Default",
    description: "Current LostCity dark neon aesthetic",
    bestFor: "Music/nightlife",
    colors: {
      primary_color: "#E855A0",
      secondary_color: "#00D4E8",
      accent_color: "#F5A623",
      background_color: "#09090B",
      text_color: "#FAFAF9",
      muted_color: "#8B8B94",
      button_color: "#E855A0",
      button_text_color: "#FAFAF9",
      border_color: "#252530",
      card_color: "#0F0F14",
    },
    theme_mode: "dark",
    header: {
      template: "standard",
      logo_position: "left",
      logo_size: "md",
      nav_style: "tabs",
      show_search_in_header: true,
      transparent_on_top: false,
    },
    ambient: {
      effect: "rain",
      intensity: "medium",
    },
    component_style: {
      border_radius: "md",
      shadows: "subtle",
      card_style: "default",
      button_style: "default",
      glow_enabled: true,
      glow_intensity: "medium",
      animations: "full",
      glass_enabled: true,
    },
  },

  corporate_clean: {
    id: "corporate_clean",
    name: "Corporate Clean",
    description: "Minimal, no glow, sharp corners, professional",
    bestFor: "B2B/corporate",
    colors: {
      primary_color: "#1a1a2e",
      secondary_color: "#4a4e69",
      accent_color: "#2563eb",
      background_color: "#ffffff",
      text_color: "#1a1a2e",
      muted_color: "#6b7280",
      button_color: "#2563eb",
      button_text_color: "#ffffff",
      border_color: "#e5e7eb",
      card_color: "#ffffff",
    },
    theme_mode: "light",
    header: {
      template: "minimal",
      logo_position: "left",
      logo_size: "md",
      nav_style: "underline",
      show_search_in_header: false,
      transparent_on_top: false,
    },
    ambient: {
      effect: "none",
    },
    component_style: {
      border_radius: "sm",
      shadows: "subtle",
      card_style: "outlined",
      button_style: "sharp",
      glow_enabled: false,
      glow_intensity: "subtle",
      animations: "subtle",
      glass_enabled: false,
    },
  },

  vibrant_community: {
    id: "vibrant_community",
    name: "Vibrant Community",
    description: "Colorful, rounded, playful",
    bestFor: "Community groups",
    colors: {
      primary_color: "#7c3aed",
      secondary_color: "#ec4899",
      accent_color: "#f59e0b",
      background_color: "#faf5ff",
      text_color: "#1f2937",
      muted_color: "#6b7280",
      button_color: "#7c3aed",
      button_text_color: "#ffffff",
      border_color: "#e9d5ff",
      card_color: "#ffffff",
    },
    theme_mode: "light",
    header: {
      template: "branded",
      logo_position: "center",
      logo_size: "lg",
      nav_style: "pills",
      show_search_in_header: true,
      transparent_on_top: false,
    },
    ambient: {
      effect: "gradient_wave",
      intensity: "subtle",
      colors: {
        primary: "#7c3aed",
        secondary: "#ec4899",
      },
    },
    component_style: {
      border_radius: "lg",
      shadows: "medium",
      card_style: "elevated",
      button_style: "pill",
      glow_enabled: false,
      glow_intensity: "subtle",
      animations: "full",
      glass_enabled: false,
    },
  },

  nightlife: {
    id: "nightlife",
    name: "Nightlife",
    description: "Dark, neon, animated particles",
    bestFor: "Clubs/bars",
    colors: {
      primary_color: "#ff00ff",
      secondary_color: "#00ffff",
      accent_color: "#ff6b00",
      background_color: "#0a0a0f",
      text_color: "#ffffff",
      muted_color: "#a1a1aa",
      button_color: "#ff00ff",
      button_text_color: "#ffffff",
      border_color: "#1f1f2e",
      card_color: "#12121a",
    },
    theme_mode: "dark",
    header: {
      template: "immersive",
      logo_position: "center",
      logo_size: "lg",
      nav_style: "minimal",
      show_search_in_header: false,
      transparent_on_top: true,
      hero: {
        height: "lg",
        overlay_opacity: 0.6,
        title_visible: true,
        tagline_visible: true,
      },
    },
    ambient: {
      effect: "particle_field",
      intensity: "bold",
      colors: {
        primary: "#ff00ff",
        secondary: "#00ffff",
      },
      particle_count: 50,
      animation_speed: "medium",
    },
    component_style: {
      border_radius: "md",
      shadows: "elevated",
      card_style: "glass",
      button_style: "default",
      glow_enabled: true,
      glow_intensity: "intense",
      animations: "full",
      glass_enabled: true,
    },
    category_colors: {
      nightlife: "#ff00ff",
      music: "#00ffff",
      food_drink: "#ff6b00",
    },
  },

  family_friendly: {
    id: "family_friendly",
    name: "Family Friendly",
    description: "Light, soft, warm, no glow",
    bestFor: "Family portals",
    colors: {
      primary_color: "#059669",
      secondary_color: "#0891b2",
      accent_color: "#f59e0b",
      background_color: "#fefce8",
      text_color: "#1c1917",
      muted_color: "#78716c",
      button_color: "#059669",
      button_text_color: "#ffffff",
      border_color: "#fde68a",
      card_color: "#fffbeb",
    },
    theme_mode: "light",
    header: {
      template: "branded",
      logo_position: "center",
      logo_size: "lg",
      nav_style: "pills",
      show_search_in_header: true,
      transparent_on_top: false,
    },
    ambient: {
      effect: "floating_leaves",
      intensity: "subtle",
      colors: {
        primary: "#7CB77C", // Soft green leaves
        secondary: "#E8956A", // Peachy orange leaves
      },
      animation_speed: "slow",
    },
    component_style: {
      border_radius: "lg",
      shadows: "medium",
      card_style: "elevated",
      button_style: "pill",
      glow_enabled: false,
      glow_intensity: "subtle",
      animations: "subtle",
      glass_enabled: false,
    },
    category_colors: {
      family: "#059669",
      community: "#0891b2",
      art: "#d97706",
      theater: "#a855f7",
      food_drink: "#ea580c",
      learning: "#2563eb",
      outdoors: "#16a34a",
    },
  },

  minimal_modern: {
    id: "minimal_modern",
    name: "Minimal Modern",
    description: "Clean lines, no shadows, minimal",
    bestFor: "Tech/modern",
    colors: {
      primary_color: "#18181b",
      secondary_color: "#3f3f46",
      accent_color: "#18181b",
      background_color: "#fafafa",
      text_color: "#18181b",
      muted_color: "#71717a",
      button_color: "#18181b",
      button_text_color: "#fafafa",
      border_color: "#e4e4e7",
      card_color: "#ffffff",
    },
    theme_mode: "light",
    header: {
      template: "minimal",
      logo_position: "left",
      logo_size: "sm",
      nav_style: "minimal",
      show_search_in_header: false,
      transparent_on_top: false,
    },
    ambient: {
      effect: "none",
    },
    component_style: {
      border_radius: "none",
      shadows: "none",
      card_style: "flat",
      button_style: "sharp",
      glow_enabled: false,
      glow_intensity: "subtle",
      animations: "none",
      glass_enabled: false,
    },
  },

  cosmic_dark: {
    id: "cosmic_dark",
    name: "Cosmic Dark",
    description: "Warm cosmic aesthetic with peach and gold tones",
    bestFor: "City portals with warm, modern vibe",
    colors: {
      primary_color: "#FF6B7A",
      secondary_color: "#F5A623",
      accent_color: "#FFD93D",
      background_color: "#0A0A12",
      text_color: "#FFF5F0",
      muted_color: "#8B8B9A",
      button_color: "#FF6B7A",
      button_text_color: "#0A0A12",
      border_color: "#2A2A3A",
      card_color: "#14141E",
    },
    theme_mode: "dark",
    header: {
      template: "standard",
      logo_position: "left",
      logo_size: "md",
      nav_style: "underline",
      show_search_in_header: true,
      transparent_on_top: true,
    },
    ambient: {
      effect: "aurora",
      intensity: "medium",
      colors: {
        primary: "#FF6B7A",
        secondary: "#A855F7",
      },
      animation_speed: "slow",
    },
    component_style: {
      border_radius: "md",
      shadows: "subtle",
      card_style: "glass",
      button_style: "default",
      glow_enabled: true,
      glow_intensity: "medium",
      animations: "full",
      glass_enabled: true,
    },
    category_colors: {
      music: "#FF6B7A",
      film: "#A855F7",
      comedy: "#FFD93D",
      theater: "#EC4899",
      art: "#F472B6",
      community: "#10B981",
      food_drink: "#F97316",
      sports: "#EF4444",
      fitness: "#22C55E",
      nightlife: "#8B5CF6",
      family: "#38BDF8",
    },
  },

  neon_honkytonk: {
    id: "neon_honkytonk",
    name: "Neon Honky-Tonk",
    description: "Music City neon aesthetic - Broadway at night",
    bestFor: "Nashville and music-focused city portals",
    colors: {
      primary_color: "#FF1B8D",
      secondary_color: "#00E5FF",
      accent_color: "#FF9500",
      background_color: "#0A0E1A",
      text_color: "#FFF8E7",
      muted_color: "#9CA3AF",
      button_color: "#FF1B8D",
      button_text_color: "#0A0E1A",
      border_color: "#1E293B",
      card_color: "#0F172A",
    },
    theme_mode: "dark",
    header: {
      template: "standard",
      logo_position: "center",
      logo_size: "lg",
      nav_style: "pills",
      show_search_in_header: true,
      transparent_on_top: true,
    },
    ambient: {
      effect: "neon_broadway",
      intensity: "bold",
      colors: {
        primary: "#FF1B8D",
        secondary: "#00E5FF",
      },
      animation_speed: "medium",
    },
    component_style: {
      border_radius: "lg",
      shadows: "subtle",
      card_style: "glass",
      button_style: "pill",
      glow_enabled: true,
      glow_intensity: "intense",
      animations: "full",
      glass_enabled: true,
    },
    category_colors: {
      music: "#FF1B8D",
      film: "#A855F7",
      comedy: "#FF9500",
      theater: "#EC4899",
      art: "#00E5FF",
      community: "#10B981",
      food_drink: "#FF9500",
      sports: "#EF4444",
      fitness: "#22C55E",
      nightlife: "#8B5CF6",
      family: "#06B6D4",
    },
  },

  custom: {
    id: "custom",
    name: "Custom",
    description: "Full custom configuration (enterprise only)",
    bestFor: "Full control",
    // Custom preset starts with default values, allows full override
    colors: {
      primary_color: "#E855A0",
      secondary_color: "#00D4E8",
      accent_color: "#F5A623",
      background_color: "#09090B",
      text_color: "#FAFAF9",
      muted_color: "#8B8B94",
      button_color: "#E855A0",
      button_text_color: "#FAFAF9",
      border_color: "#252530",
      card_color: "#0F0F14",
    },
    theme_mode: "dark",
    header: {
      template: "standard",
      logo_position: "left",
      logo_size: "md",
      nav_style: "tabs",
      show_search_in_header: true,
      transparent_on_top: false,
    },
    ambient: {
      effect: "subtle_glow",
      intensity: "medium",
    },
    component_style: {
      border_radius: "md",
      shadows: "subtle",
      card_style: "default",
      button_style: "default",
      glow_enabled: true,
      glow_intensity: "medium",
      animations: "full",
      glass_enabled: true,
    },
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get a visual preset by ID
 */
export function getVisualPreset(id: VisualPresetId | undefined): VisualPreset {
  return VISUAL_PRESETS[id || "default"] || VISUAL_PRESETS.default;
}

/**
 * Get all visual presets as an array
 */
export function getAllVisualPresets(): VisualPreset[] {
  return Object.values(VISUAL_PRESETS);
}

/**
 * Get presets available for a specific plan tier
 */
export function getPresetsForPlan(
  plan: "starter" | "professional" | "enterprise" | undefined
): VisualPreset[] {
  const tier = plan || "starter";

  switch (tier) {
    case "starter":
      // Starter only gets default
      return [VISUAL_PRESETS.default];

    case "professional":
      // Professional gets 5 presets (not custom or immersive-header nightlife)
      return [
        VISUAL_PRESETS.default,
        VISUAL_PRESETS.corporate_clean,
        VISUAL_PRESETS.vibrant_community,
        VISUAL_PRESETS.family_friendly,
        VISUAL_PRESETS.minimal_modern,
      ];

    case "enterprise":
      // Enterprise gets all presets
      return Object.values(VISUAL_PRESETS);

    default:
      return [VISUAL_PRESETS.default];
  }
}

/**
 * Check if a preset is available for a plan
 */
export function isPresetAvailableForPlan(
  presetId: VisualPresetId,
  plan: "starter" | "professional" | "enterprise" | undefined
): boolean {
  const availablePresets = getPresetsForPlan(plan);
  return availablePresets.some((p) => p.id === presetId);
}

// ============================================================================
// CSS Variable Mappings
// ============================================================================

/**
 * Border radius CSS values
 */
export const BORDER_RADIUS_VALUES: Record<BorderRadius, string> = {
  none: "0",
  sm: "0.25rem",
  md: "0.5rem",
  lg: "1rem",
  full: "9999px",
};

/**
 * Shadow CSS values
 */
export const SHADOW_VALUES: Record<ShadowLevel, string> = {
  none: "none",
  subtle: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
  medium: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
  elevated: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
};

/**
 * Glow intensity opacity values
 */
export const GLOW_OPACITY_VALUES: Record<GlowIntensity, number> = {
  subtle: 0.3,
  medium: 0.5,
  intense: 0.8,
};

/**
 * Animation duration multipliers
 */
export const ANIMATION_SPEED_VALUES: Record<SpeedLevel, number> = {
  slow: 2,
  medium: 1,
  fast: 0.5,
};

/**
 * Hero height values
 */
export const HERO_HEIGHT_VALUES: Record<HeroHeight, string> = {
  sm: "30vh",
  md: "50vh",
  lg: "70vh",
  full: "100vh",
};
