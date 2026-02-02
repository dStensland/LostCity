/**
 * Plan Features - Feature matrix and helpers for B2B portal tiers
 *
 * Plan tiers:
 * - Starter (free): Subdomain only, LostCity branding, limited features
 * - Professional ($299/mo): Custom domain, full branding, "Powered by" footer
 * - Enterprise ($999/mo): Full white-label, custom footer, API access
 */

import type {
  VisualPresetId,
  HeaderTemplate,
  AmbientEffect,
} from "./visual-presets";

export type PlanTier = "starter" | "professional" | "enterprise";

export interface PlanFeatures {
  // Domain & Branding
  custom_domain: boolean;
  full_branding: boolean;
  hide_attribution: boolean;
  custom_footer: boolean;

  // Content & API
  api_access: boolean;
  max_sections: number;
  max_team_members: number;

  // Federation
  can_subscribe_sources: boolean;
  can_share_sources: boolean;

  // Deep White-Labeling Features
  /** Which visual presets are available */
  visual_presets: VisualPresetId[];
  /** Which header templates are available */
  header_templates: HeaderTemplate[];
  /** Which ambient effects are available */
  ambient_effects: AmbientEffect[];
  /** Can customize category colors */
  category_colors: boolean;
  /** Can customize component styles */
  component_styles: boolean;
  /** Can use hero section */
  hero_section: boolean;
}

/**
 * Feature matrix by plan tier
 */
export const PLAN_FEATURES: Record<PlanTier, PlanFeatures> = {
  starter: {
    // Starter: Free tier, basic functionality
    custom_domain: false,
    full_branding: false, // Limited to 3 colors
    hide_attribution: false,
    custom_footer: false,
    api_access: false,
    max_sections: 5,
    max_team_members: 1,
    can_subscribe_sources: false,
    can_share_sources: false,
    // Deep White-Labeling: Minimal options
    visual_presets: ["default"],
    header_templates: ["standard"],
    ambient_effects: ["none", "subtle_glow"],
    category_colors: false,
    component_styles: false,
    hero_section: false,
  },
  professional: {
    // Professional: $299/mo, most B2B features
    custom_domain: true,
    full_branding: true, // Full color palette
    hide_attribution: false, // Still shows "Powered by LostCity"
    custom_footer: false,
    api_access: false,
    max_sections: 20,
    max_team_members: 5,
    can_subscribe_sources: true,
    can_share_sources: false,
    // Deep White-Labeling: 5 presets, most templates
    visual_presets: ["default", "corporate_clean", "vibrant_community", "family_friendly", "minimal_modern"],
    header_templates: ["standard", "minimal", "branded"],
    ambient_effects: ["none", "subtle_glow", "gradient_wave"],
    category_colors: true,
    component_styles: true,
    hero_section: true,
  },
  enterprise: {
    // Enterprise: $999/mo, full white-label
    custom_domain: true,
    full_branding: true,
    hide_attribution: true, // No LostCity branding
    custom_footer: true,
    api_access: true,
    max_sections: 100,
    max_team_members: 25,
    can_subscribe_sources: true,
    can_share_sources: true,
    // Deep White-Labeling: All options
    visual_presets: ["default", "corporate_clean", "vibrant_community", "nightlife", "family_friendly", "minimal_modern", "custom"],
    header_templates: ["standard", "minimal", "branded", "immersive"],
    ambient_effects: ["none", "subtle_glow", "gradient_wave", "particle_field", "aurora", "mesh_gradient", "noise_texture"],
    category_colors: true,
    component_styles: true,
    hero_section: true,
  },
};

/**
 * Plan display information
 */
export const PLAN_INFO: Record<PlanTier, {
  name: string;
  price: string;
  description: string;
}> = {
  starter: {
    name: "Starter",
    price: "Free",
    description: "Basic portal with LostCity branding",
  },
  professional: {
    name: "Professional",
    price: "$299/mo",
    description: "Custom domain and full branding",
  },
  enterprise: {
    name: "Enterprise",
    price: "$999/mo",
    description: "Full white-label with API access",
  },
};

/**
 * Get features for a plan tier
 */
export function getPlanFeatures(plan: string | null | undefined): PlanFeatures {
  const tier = (plan || "starter") as PlanTier;
  return PLAN_FEATURES[tier] || PLAN_FEATURES.starter;
}

/**
 * Check if a specific feature is available for a plan
 */
export function hasFeature(
  plan: string | null | undefined,
  feature: keyof PlanFeatures
): boolean {
  const features = getPlanFeatures(plan);
  const value = features[feature];

  // Handle numeric features (check if > 0)
  if (typeof value === "number") {
    return value > 0;
  }

  return Boolean(value);
}

/**
 * Check if plan allows custom domains
 */
export function canUseCustomDomain(plan: string | null | undefined): boolean {
  return hasFeature(plan, "custom_domain");
}

/**
 * Check if plan allows hiding LostCity attribution
 */
export function canHideAttribution(plan: string | null | undefined): boolean {
  return hasFeature(plan, "hide_attribution");
}

/**
 * Check if plan allows custom footer
 */
export function canUseCustomFooter(plan: string | null | undefined): boolean {
  return hasFeature(plan, "custom_footer");
}

/**
 * Check if plan allows full branding (all colors)
 */
export function canUseFullBranding(plan: string | null | undefined): boolean {
  return hasFeature(plan, "full_branding");
}

/**
 * Get allowed branding fields for a plan
 * Starter only gets primary, secondary, accent colors
 * Professional+ gets all colors + deep white-labeling options
 */
export function getAllowedBrandingFields(plan: string | null | undefined): string[] {
  const features = getPlanFeatures(plan);

  // Basic branding fields available to all
  const basicFields = [
    "logo_url",
    "hero_image_url",
    "favicon_url",
    "og_image_url",
    "primary_color",
    "secondary_color",
    "accent_color",
    "visual_preset", // Always allowed, but options are restricted
  ];

  if (features.full_branding) {
    // Full branding adds all color/font options
    const fullFields = [
      ...basicFields,
      "background_color",
      "text_color",
      "muted_color",
      "button_color",
      "button_text_color",
      "border_color",
      "card_color",
      "font_heading",
      "font_body",
      "theme_mode",
      "header", // Header config (templates restricted by plan)
      "ambient", // Ambient config (effects restricted by plan)
    ];

    // Add component styles and category colors for plans that support them
    if (features.component_styles) {
      fullFields.push("component_style");
    }
    if (features.category_colors) {
      fullFields.push("category_colors");
    }

    return fullFields;
  }

  return basicFields;
}

/**
 * Filter branding object to only allowed fields for the plan
 */
export function filterBrandingForPlan(
  branding: Record<string, unknown>,
  plan: string | null | undefined
): Record<string, unknown> {
  const allowedFields = getAllowedBrandingFields(plan);
  const filtered: Record<string, unknown> = {};
  const features = getPlanFeatures(plan);

  for (const field of allowedFields) {
    if (branding[field] !== undefined) {
      filtered[field] = branding[field];
    }
  }

  // Filter visual_preset to only allowed presets
  if (filtered.visual_preset && typeof filtered.visual_preset === "string") {
    if (!features.visual_presets.includes(filtered.visual_preset as VisualPresetId)) {
      filtered.visual_preset = "default";
    }
  }

  // Filter header config to only allowed templates
  if (filtered.header && typeof filtered.header === "object") {
    const header = filtered.header as Record<string, unknown>;
    if (header.template && typeof header.template === "string") {
      if (!features.header_templates.includes(header.template as HeaderTemplate)) {
        header.template = "standard";
      }
    }
    // Remove hero if not allowed
    if (!features.hero_section && header.hero) {
      delete header.hero;
    }
    filtered.header = header;
  }

  // Filter ambient config to only allowed effects
  if (filtered.ambient && typeof filtered.ambient === "object") {
    const ambient = filtered.ambient as Record<string, unknown>;
    if (ambient.effect && typeof ambient.effect === "string") {
      if (!features.ambient_effects.includes(ambient.effect as AmbientEffect)) {
        ambient.effect = "subtle_glow";
      }
    }
    filtered.ambient = ambient;
  }

  // Enterprise-only branding fields
  if (features.hide_attribution && branding.hide_attribution !== undefined) {
    filtered.hide_attribution = branding.hide_attribution;
  }
  if (features.custom_footer) {
    if (branding.footer_text !== undefined) {
      filtered.footer_text = branding.footer_text;
    }
    if (branding.footer_links !== undefined) {
      filtered.footer_links = branding.footer_links;
    }
    if (branding.sharing_brand_name !== undefined) {
      filtered.sharing_brand_name = branding.sharing_brand_name;
    }
  }

  return filtered;
}

/**
 * Validate that a plan upgrade is valid
 */
export function isValidUpgrade(currentPlan: PlanTier, newPlan: PlanTier): boolean {
  const tiers: PlanTier[] = ["starter", "professional", "enterprise"];
  const currentIndex = tiers.indexOf(currentPlan);
  const newIndex = tiers.indexOf(newPlan);
  return newIndex > currentIndex;
}

/**
 * Validate that a plan downgrade is valid
 * Note: Downgrades may require removing features like custom domains
 */
export function isValidDowngrade(currentPlan: PlanTier, newPlan: PlanTier): boolean {
  const tiers: PlanTier[] = ["starter", "professional", "enterprise"];
  const currentIndex = tiers.indexOf(currentPlan);
  const newIndex = tiers.indexOf(newPlan);
  return newIndex < currentIndex;
}

// ============================================================================
// Deep White-Labeling Helper Functions
// ============================================================================

/**
 * Check if a visual preset is available for a plan
 */
export function canUseVisualPreset(
  plan: string | null | undefined,
  preset: VisualPresetId
): boolean {
  const features = getPlanFeatures(plan);
  return features.visual_presets.includes(preset);
}

/**
 * Check if a header template is available for a plan
 */
export function canUseHeaderTemplate(
  plan: string | null | undefined,
  template: HeaderTemplate
): boolean {
  const features = getPlanFeatures(plan);
  return features.header_templates.includes(template);
}

/**
 * Check if an ambient effect is available for a plan
 */
export function canUseAmbientEffect(
  plan: string | null | undefined,
  effect: AmbientEffect
): boolean {
  const features = getPlanFeatures(plan);
  return features.ambient_effects.includes(effect);
}

/**
 * Check if category colors are available for a plan
 */
export function canUseCategoryColors(plan: string | null | undefined): boolean {
  return hasFeature(plan, "category_colors");
}

/**
 * Check if component styles are available for a plan
 */
export function canUseComponentStyles(plan: string | null | undefined): boolean {
  return hasFeature(plan, "component_styles");
}

/**
 * Check if hero section is available for a plan
 */
export function canUseHeroSection(plan: string | null | undefined): boolean {
  return hasFeature(plan, "hero_section");
}

/**
 * Get available visual presets for a plan
 */
export function getAvailableVisualPresets(
  plan: string | null | undefined
): VisualPresetId[] {
  const features = getPlanFeatures(plan);
  return features.visual_presets;
}

/**
 * Get available header templates for a plan
 */
export function getAvailableHeaderTemplates(
  plan: string | null | undefined
): HeaderTemplate[] {
  const features = getPlanFeatures(plan);
  return features.header_templates;
}

/**
 * Get available ambient effects for a plan
 */
export function getAvailableAmbientEffects(
  plan: string | null | undefined
): AmbientEffect[] {
  const features = getPlanFeatures(plan);
  return features.ambient_effects;
}
