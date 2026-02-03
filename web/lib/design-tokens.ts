/**
 * Design token utilities for the hybrid portal design system.
 * Provides type-safe access to CSS custom properties.
 */

/**
 * Brand tokens - core brand colors
 */
export const BRAND_TOKENS = {
  primary: "var(--brand-primary)",
  secondary: "var(--brand-secondary)",
  accent: "var(--brand-accent)",
} as const;

/**
 * Action tokens - interactive elements
 */
export const ACTION_TOKENS = {
  primary: "var(--action-primary)",
  primaryHover: "var(--action-primary-hover)",
  secondary: "var(--action-secondary)",
  secondaryHover: "var(--action-secondary-hover)",
} as const;

/**
 * State tokens - UI states
 */
export const STATE_TOKENS = {
  selected: "var(--state-selected)",
  selectedBg: "var(--state-selected-bg)",
  focusRing: "var(--focus-ring-color)",
} as const;

/**
 * Surface tokens - background layers
 */
export const SURFACE_TOKENS = {
  base: "var(--surface-base)",
  raised: "var(--surface-raised)",
  elevated: "var(--surface-elevated)",
} as const;

/**
 * Text tokens - typography colors
 */
export const TEXT_TOKENS = {
  primary: "var(--text-primary)",
  secondary: "var(--text-secondary)",
  muted: "var(--text-muted)",
  inverse: "var(--text-inverse)",
  link: "var(--text-link)",
  linkHover: "var(--text-link-hover)",
} as const;

/**
 * Button tokens - button components
 */
export const BUTTON_TOKENS = {
  primaryBg: "var(--btn-primary-bg)",
  primaryText: "var(--btn-primary-text)",
  primaryHover: "var(--btn-primary-hover)",
  secondaryBg: "var(--btn-secondary-bg)",
  secondaryBorder: "var(--btn-secondary-border)",
  secondaryText: "var(--btn-secondary-text)",
} as const;

/**
 * Navigation tokens - nav components
 */
export const NAV_TOKENS = {
  tabText: "var(--nav-tab-text)",
  tabActive: "var(--nav-tab-active)",
  indicator: "var(--nav-indicator)",
} as const;

/**
 * Card tokens - card components
 */
export const CARD_TOKENS = {
  bg: "var(--card-bg)",
  border: "var(--card-border)",
  borderHover: "var(--card-border-hover)",
} as const;

/**
 * Badge tokens - badge components
 */
export const BADGE_TOKENS = {
  bg: "var(--badge-bg)",
  text: "var(--badge-text)",
  accentBg: "var(--badge-accent-bg)",
  accentText: "var(--badge-accent-text)",
} as const;

/**
 * All design tokens grouped by category
 */
export const DESIGN_TOKENS = {
  brand: BRAND_TOKENS,
  action: ACTION_TOKENS,
  state: STATE_TOKENS,
  surface: SURFACE_TOKENS,
  text: TEXT_TOKENS,
  button: BUTTON_TOKENS,
  nav: NAV_TOKENS,
  card: CARD_TOKENS,
  badge: BADGE_TOKENS,
} as const;

/**
 * Type for design token values
 */
export type DesignToken = string;

/**
 * Helper to build Tailwind classes with design tokens.
 * Example: token("bg", "action-primary") => "bg-[var(--action-primary)]"
 */
export function token(property: string, tokenPath: string): string {
  return `${property}-[var(--${tokenPath})]`;
}

/**
 * Helper to get CSS variable name for a token.
 * Example: cssVar("action-primary") => "var(--action-primary)"
 */
export function cssVar(tokenName: string): string {
  return `var(--${tokenName})`;
}

/**
 * Helper to check if a token exists in the design system.
 */
export function hasToken(tokenName: string): boolean {
  if (typeof window === "undefined") return false;
  const value = getComputedStyle(document.documentElement).getPropertyValue(
    `--${tokenName}`
  );
  return value.trim().length > 0;
}

/**
 * Helper to get the computed value of a design token.
 * Returns the actual color/value after CSS variable resolution.
 */
export function getTokenValue(tokenName: string): string {
  if (typeof window === "undefined") return "";
  return getComputedStyle(document.documentElement)
    .getPropertyValue(`--${tokenName}`)
    .trim();
}
