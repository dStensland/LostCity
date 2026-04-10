/**
 * portal-animation-config.ts
 *
 * Config-driven CSS for portal verticals. Each vertical that opts out of the
 * default dark-city aesthetic (grain, rain, ambient glow, cinematic animations)
 * declares its overrides here.
 *
 * Usage in layout:
 *   const css = getVerticalStyles(vertical, portalSlug);
 *   // ...
 *   {css && <style>{css}</style>}
 *
 * Rules:
 * - Do NOT change actual CSS rules here — move them, don't edit them.
 * - Keep behavior identical to the previous inline blocks.
 * - Slug-based overrides (emory-demo, ponce-city-market-demo) are handled by
 *   the "hospital" and "marketplace" entries respectively; the layout resolves
 *   these before calling this function.
 * - Adding a new vertical: add an entry to VERTICAL_STYLE_CONFIG below.
 */

import { coercePortalVertical } from "@/lib/portal-taxonomy";
import type { PortalVertical } from "@/lib/portal-taxonomy";

/** Suppress grain/rain/glow effects for the body. */
const DISABLE_ATMOSPHERE = `
  body::before { opacity: 0 !important; }
  body::after { opacity: 0 !important; }
  .ambient-glow { opacity: 0 !important; }
  .rain-overlay { display: none !important; }
`;

/** Suppress cinematic animations for a given vertical data-attribute selector. */
function disableAnimations(vertical: string): string {
  return `
  [data-vertical="${vertical}"] .animate-page-enter,
  [data-vertical="${vertical}"] .animate-glitch-flicker,
  [data-vertical="${vertical}"] .animate-flicker,
  [data-vertical="${vertical}"] .animate-flicker-fast,
  [data-vertical="${vertical}"] .animate-coral-shimmer,
  [data-vertical="${vertical}"] .animate-coral-scan,
  [data-vertical="${vertical}"] .animate-coral-pulse,
  [data-vertical="${vertical}"] .animate-happening-now-pulse,
  [data-vertical="${vertical}"] .animate-pulse-glow {
    animation: none !important;
  }

  [data-vertical="${vertical}"] [class*="animate-"] {
    animation: none !important;
  }`;
}

type VerticalStyleConfig = {
  /** Return the full CSS string for this vertical, or null for no override. */
  css: string | null;
};

/**
 * Vertical style configs. Key matches the PortalVertical string returned by
 * getPortalVertical(), or the special slug-resolved keys "hospital" and
 * "marketplace" (which are already the correct vertical names).
 *
 * "hospital" covers the Emory demo slug (resolved in layout before this call).
 * "marketplace" covers both vertical === "marketplace" and PCM demo slug.
 */
const VERTICAL_STYLE_CONFIG: Record<PortalVertical, VerticalStyleConfig> = {
  /**
   * Hospital vertical (including Emory demo).
   * Full atmosphere + animation disable; body background override.
   */
  hospital: {
    css: `
  html, body { background-color: #f2f5fa !important; }
  ${DISABLE_ATMOSPHERE}
  ${disableAnimations("hospital")}`,
  },

  /**
   * Marketplace vertical (including PCM demo).
   * Atmosphere + animation disable; no background override.
   */
  marketplace: {
    css: `
  ${DISABLE_ATMOSPHERE}
  ${disableAnimations("marketplace")}`,
  },

  /**
   * Dog vertical (The Pack ATL).
   * Warm/friendly aesthetic — dark city effects don't fit.
   */
  dog: {
    css: `
  ${DISABLE_ATMOSPHERE}
  ${disableAnimations("dog")}`,
  },

  /**
   * Community vertical (HelpATL civic portal).
   * Light editorial aesthetic with civic typography and color overrides.
   */
  community: {
    css: `
  ${DISABLE_ATMOSPHERE}
  ${disableAnimations("community")}

  /* Civic editorial typography */
  [data-vertical="community"] .civic-hero-heading {
    font-family: var(--portal-font-heading, 'Source Serif 4', Georgia, serif);
    font-weight: 600;
    letter-spacing: -0.01em;
  }

  /* Civic card refinements — slightly warmer and softer */
  [data-vertical="community"] .civic-quick-link {
    border-color: color-mix(in srgb, var(--twilight) 70%, transparent);
  }
  [data-vertical="community"] .civic-quick-link:hover {
    box-shadow: 0 2px 12px color-mix(in srgb, var(--action-primary) 8%, transparent);
  }

  /* Override nav-tab active for civic green instead of coral */
  [data-vertical="community"] .nav-tab-active {
    background-color: var(--action-primary) !important;
  }

  /* Override the skeleton shimmer for light theme */
  [data-vertical="community"] .skeleton-shimmer {
    background: linear-gradient(
      90deg,
      color-mix(in srgb, var(--twilight) 15%, transparent) 0%,
      color-mix(in srgb, var(--twilight) 25%, transparent) 50%,
      color-mix(in srgb, var(--twilight) 15%, transparent) 100%
    ) !important;
    background-size: 200% 100% !important;
  }

  /* Feed section header — use portal accent for "See all" link */
  [data-vertical="community"] .text-accent {
    color: var(--action-primary);
  }`,
  },

  /**
   * Film vertical (AJFF and similar festival portals).
   * Overwrites accent tokens to cooler blue palette; disables city atmosphere.
   */
  film: {
    css: `
  [data-vertical="film"] {
    --coral: #b8c8f8;
    --coral-hsl: 225 80% 85%;
    --neon-amber: #b8c8f8;
    --neon-amber-hsl: 225 80% 85%;
    --gold: #dbe5ff;
  }

  ${DISABLE_ATMOSPHERE}
  ${disableAnimations("film")}`,
  },

  /**
   * Arts vertical (Lost City: Arts — exhibitions, studios, galleries).
   * Cinematic minimalism — suppress grain/rain but keep typography animations.
   * Arts portals define their own aesthetic; we strip the nightclub-coded effects.
   */
  arts: {
    css: `
  ${DISABLE_ATMOSPHERE}
  ${disableAnimations("arts")}`,
  },

  /**
   * City, hotel, and adventure verticals use the default dark-city aesthetic.
   * No overrides needed — return null to skip the <style> tag entirely.
   */
  city: { css: null },
  hotel: { css: null },
  family: { css: null },
  adventure: {
    css: `
  html, body { background-color: #F5F2ED !important; }
  ${DISABLE_ATMOSPHERE}
  ${disableAnimations("adventure")}`,
  },
  sports: { css: null },
};

/**
 * Returns the CSS string for the given vertical and portal slug, or null if
 * no override is needed.
 *
 * The layout is responsible for resolving slug-based overrides (Emory demo →
 * "hospital", PCM demo → "marketplace") before calling this function, so the
 * vertical string passed here is always the canonical vertical key.
 */
export function getVerticalStyles(vertical: string | null | undefined): string | null {
  const resolvedVertical = coercePortalVertical(vertical);
  if (!resolvedVertical) return null;
  const config = VERTICAL_STYLE_CONFIG[resolvedVertical];
  return config.css;
}
