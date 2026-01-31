/**
 * Apply Preset - Logic for merging visual presets with custom branding
 *
 * Presets provide default values, but explicit branding values override them.
 * This enables AI to configure portals by selecting a preset and then
 * customizing specific aspects.
 */

import {
  VisualPresetId,
  getVisualPreset,
  HeaderConfig,
  AmbientConfig,
  ComponentStyleConfig,
} from "./visual-presets";

// ============================================================================
// Extended Branding Type (what gets stored in portal.branding)
// ============================================================================

export interface ExtendedBranding {
  // EXISTING fields (unchanged)
  logo_url?: string;
  hero_image_url?: string;
  favicon_url?: string;
  og_image_url?: string;
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
  font_heading?: string;
  font_body?: string;
  theme_mode?: "dark" | "light";
  hide_attribution?: boolean;
  footer_text?: string;
  footer_links?: { label: string; url: string }[];
  sharing_brand_name?: string;

  // NEW: Visual preset (base theme)
  visual_preset?: VisualPresetId;

  // NEW: Header configuration
  header?: Partial<HeaderConfig>;

  // NEW: Ambient/background effects
  ambient?: Partial<AmbientConfig>;

  // NEW: Portal-specific category colors
  category_colors?: Record<string, string>;

  // NEW: Component style variants
  component_style?: Partial<ComponentStyleConfig>;

  // Allow additional fields
  [key: string]: unknown;
}

// ============================================================================
// Resolved Branding (after preset is applied)
// ============================================================================

export interface ResolvedBranding {
  // Core branding
  logo_url?: string;
  hero_image_url?: string;
  favicon_url?: string;
  og_image_url?: string;
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
  font_heading?: string;
  font_body?: string;
  theme_mode: "dark" | "light";
  hide_attribution?: boolean;
  footer_text?: string;
  footer_links?: { label: string; url: string }[];
  sharing_brand_name?: string;

  // Visual preset that was applied
  visual_preset: VisualPresetId;

  // Fully resolved header config
  header: HeaderConfig;

  // Fully resolved ambient config
  ambient: AmbientConfig;

  // Fully resolved component styles
  component_style: ComponentStyleConfig;

  // Category color overrides
  category_colors?: Record<string, string>;
}

// ============================================================================
// Apply Preset Logic
// ============================================================================

/**
 * Deep merge two objects, with source values overriding target values
 */
function deepMerge<T extends object>(
  target: T,
  source: Partial<T> | undefined
): T {
  if (!source) return target;

  const result = { ...target } as T;

  for (const key of Object.keys(source) as (keyof T)[]) {
    const sourceValue = source[key];
    const targetValue = target[key];

    if (sourceValue === undefined) continue;

    if (
      typeof sourceValue === "object" &&
      sourceValue !== null &&
      !Array.isArray(sourceValue) &&
      typeof targetValue === "object" &&
      targetValue !== null &&
      !Array.isArray(targetValue)
    ) {
      // Recursively merge nested objects
      result[key] = deepMerge(
        targetValue as object,
        sourceValue as object
      ) as T[keyof T];
    } else {
      // Override with source value
      result[key] = sourceValue as T[keyof T];
    }
  }

  return result;
}

/**
 * Apply a visual preset to branding, merging with any custom overrides
 *
 * @param branding - The portal's branding configuration (may include partial overrides)
 * @returns Fully resolved branding with all preset defaults + custom overrides
 */
export function applyPreset(branding: ExtendedBranding): ResolvedBranding {
  const presetId = branding.visual_preset || "default";
  const preset = getVisualPreset(presetId);

  // Start with preset defaults
  const resolved: ResolvedBranding = {
    // Core branding from preset
    primary_color: preset.colors.primary_color,
    secondary_color: preset.colors.secondary_color,
    accent_color: preset.colors.accent_color,
    background_color: preset.colors.background_color,
    text_color: preset.colors.text_color,
    muted_color: preset.colors.muted_color,
    button_color: preset.colors.button_color,
    button_text_color: preset.colors.button_text_color,
    border_color: preset.colors.border_color,
    card_color: preset.colors.card_color,
    theme_mode: preset.theme_mode,

    // Visual preset ID
    visual_preset: presetId,

    // Header config from preset
    header: { ...preset.header },

    // Ambient config from preset
    ambient: { ...preset.ambient },

    // Component styles from preset
    component_style: { ...preset.component_style },

    // Category colors from preset (if any)
    category_colors: preset.category_colors ? { ...preset.category_colors } : undefined,
  };

  // Override with explicit branding values
  if (branding.logo_url) resolved.logo_url = branding.logo_url;
  if (branding.hero_image_url) resolved.hero_image_url = branding.hero_image_url;
  if (branding.favicon_url) resolved.favicon_url = branding.favicon_url;
  if (branding.og_image_url) resolved.og_image_url = branding.og_image_url;
  if (branding.primary_color) resolved.primary_color = branding.primary_color;
  if (branding.secondary_color) resolved.secondary_color = branding.secondary_color;
  if (branding.accent_color) resolved.accent_color = branding.accent_color;
  if (branding.background_color) resolved.background_color = branding.background_color;
  if (branding.text_color) resolved.text_color = branding.text_color;
  if (branding.muted_color) resolved.muted_color = branding.muted_color;
  if (branding.button_color) resolved.button_color = branding.button_color;
  if (branding.button_text_color) resolved.button_text_color = branding.button_text_color;
  if (branding.border_color) resolved.border_color = branding.border_color;
  if (branding.card_color) resolved.card_color = branding.card_color;
  if (branding.font_heading) resolved.font_heading = branding.font_heading;
  if (branding.font_body) resolved.font_body = branding.font_body;
  if (branding.theme_mode) resolved.theme_mode = branding.theme_mode;
  if (branding.hide_attribution !== undefined)
    resolved.hide_attribution = branding.hide_attribution;
  if (branding.footer_text) resolved.footer_text = branding.footer_text;
  if (branding.footer_links) resolved.footer_links = branding.footer_links;
  if (branding.sharing_brand_name) resolved.sharing_brand_name = branding.sharing_brand_name;

  // Deep merge header config
  if (branding.header) {
    resolved.header = deepMerge(resolved.header, branding.header);
  }

  // Deep merge ambient config
  if (branding.ambient) {
    resolved.ambient = deepMerge(resolved.ambient, branding.ambient);
  }

  // Deep merge component styles
  if (branding.component_style) {
    resolved.component_style = deepMerge(
      resolved.component_style,
      branding.component_style
    );
  }

  // Merge category colors (custom overrides preset)
  if (branding.category_colors) {
    resolved.category_colors = {
      ...(resolved.category_colors || {}),
      ...branding.category_colors,
    };
  }

  return resolved;
}

/**
 * Get only the custom overrides (fields that differ from preset defaults)
 * Useful for storing minimal branding config in the database
 *
 * @param branding - The full branding configuration
 * @returns Only the fields that differ from the preset defaults
 */
export function getCustomOverrides(branding: ExtendedBranding): Partial<ExtendedBranding> {
  const presetId = branding.visual_preset || "default";
  const preset = getVisualPreset(presetId);
  const overrides: Partial<ExtendedBranding> = {};

  // Always include the preset ID
  overrides.visual_preset = presetId;

  // Check each color field
  if (branding.primary_color && branding.primary_color !== preset.colors.primary_color) {
    overrides.primary_color = branding.primary_color;
  }
  if (branding.secondary_color && branding.secondary_color !== preset.colors.secondary_color) {
    overrides.secondary_color = branding.secondary_color;
  }
  if (branding.accent_color && branding.accent_color !== preset.colors.accent_color) {
    overrides.accent_color = branding.accent_color;
  }
  if (branding.background_color && branding.background_color !== preset.colors.background_color) {
    overrides.background_color = branding.background_color;
  }
  if (branding.text_color && branding.text_color !== preset.colors.text_color) {
    overrides.text_color = branding.text_color;
  }
  if (branding.muted_color && branding.muted_color !== preset.colors.muted_color) {
    overrides.muted_color = branding.muted_color;
  }
  if (branding.button_color && branding.button_color !== preset.colors.button_color) {
    overrides.button_color = branding.button_color;
  }
  if (branding.button_text_color && branding.button_text_color !== preset.colors.button_text_color) {
    overrides.button_text_color = branding.button_text_color;
  }
  if (branding.border_color && branding.border_color !== preset.colors.border_color) {
    overrides.border_color = branding.border_color;
  }
  if (branding.card_color && branding.card_color !== preset.colors.card_color) {
    overrides.card_color = branding.card_color;
  }
  if (branding.theme_mode && branding.theme_mode !== preset.theme_mode) {
    overrides.theme_mode = branding.theme_mode;
  }

  // Include asset URLs (not in preset)
  if (branding.logo_url) overrides.logo_url = branding.logo_url;
  if (branding.hero_image_url) overrides.hero_image_url = branding.hero_image_url;
  if (branding.favicon_url) overrides.favicon_url = branding.favicon_url;
  if (branding.og_image_url) overrides.og_image_url = branding.og_image_url;
  if (branding.font_heading) overrides.font_heading = branding.font_heading;
  if (branding.font_body) overrides.font_body = branding.font_body;

  // Include enterprise fields
  if (branding.hide_attribution) overrides.hide_attribution = branding.hide_attribution;
  if (branding.footer_text) overrides.footer_text = branding.footer_text;
  if (branding.footer_links) overrides.footer_links = branding.footer_links;
  if (branding.sharing_brand_name) overrides.sharing_brand_name = branding.sharing_brand_name;

  // Include header overrides if different from preset
  if (branding.header) {
    const headerOverrides: Partial<HeaderConfig> = {};
    let hasHeaderOverrides = false;

    for (const key of Object.keys(branding.header) as (keyof HeaderConfig)[]) {
      const value = branding.header[key];
      const presetValue = preset.header[key];

      if (value !== undefined && JSON.stringify(value) !== JSON.stringify(presetValue)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        headerOverrides[key] = value as any;
        hasHeaderOverrides = true;
      }
    }

    if (hasHeaderOverrides) {
      overrides.header = headerOverrides;
    }
  }

  // Include ambient overrides if different from preset
  if (branding.ambient) {
    const ambientOverrides: Partial<AmbientConfig> = {};
    let hasAmbientOverrides = false;

    for (const key of Object.keys(branding.ambient) as (keyof AmbientConfig)[]) {
      const value = branding.ambient[key];
      const presetValue = preset.ambient[key];

      if (value !== undefined && JSON.stringify(value) !== JSON.stringify(presetValue)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ambientOverrides[key] = value as any;
        hasAmbientOverrides = true;
      }
    }

    if (hasAmbientOverrides) {
      overrides.ambient = ambientOverrides;
    }
  }

  // Include component style overrides if different from preset
  if (branding.component_style) {
    const styleOverrides: Partial<ComponentStyleConfig> = {};
    let hasStyleOverrides = false;

    for (const key of Object.keys(branding.component_style) as (keyof ComponentStyleConfig)[]) {
      const value = branding.component_style[key];
      const presetValue = preset.component_style[key];

      if (value !== undefined && value !== presetValue) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        styleOverrides[key] = value as any;
        hasStyleOverrides = true;
      }
    }

    if (hasStyleOverrides) {
      overrides.component_style = styleOverrides;
    }
  }

  // Include category color overrides
  if (branding.category_colors) {
    overrides.category_colors = branding.category_colors;
  }

  return overrides;
}

/**
 * Validate that branding respects plan tier restrictions
 *
 * @param branding - The branding configuration to validate
 * @param plan - The portal's plan tier
 * @returns Array of validation errors (empty if valid)
 */
export function validateBrandingForPlan(
  branding: ExtendedBranding,
  plan: "starter" | "professional" | "enterprise" | undefined
): string[] {
  const errors: string[] = [];
  const tier = plan || "starter";

  // Check preset availability
  if (branding.visual_preset) {
    const preset = getVisualPreset(branding.visual_preset);
    const isCustom = branding.visual_preset === "custom";
    const isNightlife = branding.visual_preset === "nightlife";

    if (tier === "starter" && branding.visual_preset !== "default") {
      errors.push(`Preset "${preset.name}" requires Professional or Enterprise plan`);
    }

    if (tier === "professional" && (isCustom || isNightlife)) {
      errors.push(`Preset "${preset.name}" requires Enterprise plan`);
    }
  }

  // Check header template
  if (branding.header?.template) {
    if (tier === "starter" && branding.header.template !== "standard") {
      errors.push(`Header template "${branding.header.template}" requires Professional or Enterprise plan`);
    }

    if (tier === "professional" && branding.header.template === "immersive") {
      errors.push(`Immersive header template requires Enterprise plan`);
    }
  }

  // Check ambient effects
  if (branding.ambient?.effect) {
    const effect = branding.ambient.effect;
    const starterEffects = ["none", "subtle_glow"];
    const professionalEffects = [...starterEffects, "gradient_wave"];

    if (tier === "starter" && !starterEffects.includes(effect)) {
      errors.push(`Ambient effect "${effect}" requires Professional or Enterprise plan`);
    }

    if (tier === "professional" && !professionalEffects.includes(effect)) {
      errors.push(`Ambient effect "${effect}" requires Enterprise plan`);
    }
  }

  // Check category colors
  if (branding.category_colors && Object.keys(branding.category_colors).length > 0) {
    if (tier === "starter") {
      errors.push("Custom category colors require Professional or Enterprise plan");
    }
  }

  // Check component styles
  if (branding.component_style && Object.keys(branding.component_style).length > 0) {
    if (tier === "starter") {
      errors.push("Custom component styles require Professional or Enterprise plan");
    }
  }

  // Check hero section
  if (branding.header?.hero) {
    if (tier === "starter") {
      errors.push("Hero section requires Professional or Enterprise plan");
    }
  }

  return errors;
}
