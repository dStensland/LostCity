import type { Portal, PortalFeedConfig } from "./portal-context";

/**
 * Default feed configuration for portals without custom config.
 */
export const DEFAULT_FEED_CONFIG: PortalFeedConfig = {
  layout: "vertical",
  card_variant: "standard",
  sections: ["featured", "for_you"],
  hero_style: "none",
  show_filters: true,
  group_by: "none",
};

/**
 * Get the resolved feed configuration for a portal.
 * Merges portal-specific config with defaults.
 */
export function getPortalFeedConfig(portal: Portal): PortalFeedConfig {
  return {
    ...DEFAULT_FEED_CONFIG,
    ...(portal.settings.feed_config || {}),
  };
}

/**
 * Check if a portal uses a custom page template.
 */
export function hasCustomTemplate(portal: Portal): boolean {
  return !!(portal.page_template && portal.page_template !== "default");
}

/**
 * Get the template name for a portal.
 */
export function getPortalTemplate(portal: Portal): string {
  return portal.page_template || "default";
}
