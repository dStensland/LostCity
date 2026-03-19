/**
 * Afternoon Field design tokens — shared palette for the Lost Youth (Family) portal.
 *
 * Import from here instead of redefining per-component.
 * All values are intentional — do not override per-component without a design reason.
 */

export const FAMILY_TOKENS = {
  /** Page canvas background — the warm off-white field. */
  canvas: "#F0EDE4",
  /** Card surface — slightly lighter than canvas. */
  card: "#FAFAF6",
  /** Primary brand color — field sage green. */
  sage: "#5E7A5E",
  /** Accent / urgency / registration color — warm amber. */
  amber: "#C48B1D",
  /** Sky blue — used for water, indoor/outdoor, weather. */
  sky: "#78B7D0",
  /** Moss — softer green used for OPEN badges and secondary accents. */
  moss: "#7A9E7A",
  /** Primary text — near-black warm dark green. */
  text: "#1E2820",
  /** Secondary / muted text — warm brown-grey. */
  textSecondary: "#756E63",
  /** Border / divider color. */
  border: "#E0DDD4",
  /** Plus Jakarta Sans — display / heading font. */
  fontHeading: "var(--font-plus-jakarta-sans, 'Plus Jakarta Sans', system-ui, sans-serif)",
  /** DM Sans — body / label font. */
  fontBody: "var(--font-dm-sans, 'DM Sans', system-ui, sans-serif)",
} as const;

export type FamilyTokenKey = keyof typeof FAMILY_TOKENS;
