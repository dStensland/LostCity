"use client";

import { useEffect } from "react";
import type { Portal, PortalBranding } from "@/lib/portal-context";
import { applyPreset } from "@/lib/apply-preset";
import {
  BORDER_RADIUS_VALUES,
  SHADOW_VALUES,
  GLOW_OPACITY_VALUES,
} from "@/lib/visual-presets";

interface PortalThemeProps {
  portal: Portal;
}

/**
 * Sanitize a CSS color value to prevent injection attacks.
 * Only allows valid hex colors, named colors, and rgb/hsl functions.
 */
function sanitizeCssColor(value: string): string | null {
  if (!value || typeof value !== "string") return null;

  // Allow hex colors: #RGB, #RRGGBB, #RRGGBBAA
  if (/^#[0-9a-fA-F]{3,8}$/.test(value)) return value;

  // Allow named CSS colors (common ones, alphanumeric only)
  if (/^[a-zA-Z]{3,20}$/.test(value)) return value;

  // Allow rgb/rgba/hsl/hsla functions with numbers, commas, spaces, dots, percentages
  if (/^(rgb|hsl)a?\(\s*[0-9.,\s%]+\s*\)$/.test(value)) return value;

  return null;
}

/**
 * Sanitize a CSS font family value to prevent injection attacks.
 * Only allows alphanumeric characters, spaces, commas, quotes, underscores, and hyphens.
 */
function sanitizeFontFamily(value: string): string | null {
  if (!value || typeof value !== "string") return null;

  // Allow alphanumeric, spaces, commas, quotes (single/double), underscores, hyphens
  if (/^[a-zA-Z0-9\s,'"_-]+$/.test(value)) return value;

  return null;
}

/**
 * Injects portal-specific CSS variables and loads custom fonts.
 * Renders a <style> tag with CSS custom properties that override defaults.
 * Now supports deep white-labeling with visual presets and component styles.
 */
export function PortalTheme({ portal }: PortalThemeProps) {
  const branding = portal.branding || {};
  const settings = portal.settings || {};

  // Apply visual preset to get resolved branding with all defaults
  const resolvedBranding = applyPreset(branding as PortalBranding);

  // Extract branding values with defaults
  const primaryColor = (branding.primary_color as string) || null;

  // Icon glow setting (default: true)
  const iconGlowEnabled = settings.icon_glow !== false;
  const primaryLight = (branding.primary_light as string) || null;
  const secondaryColor = (branding.secondary_color as string) || null;
  const accentColor = (branding.accent_color as string) || null;
  const backgroundColor = (branding.background_color as string) || null;
  const textColor = (branding.text_color as string) || null;
  const mutedColor = (branding.muted_color as string) || null;
  const buttonColor = (branding.button_color as string) || null;
  const buttonTextColor = (branding.button_text_color as string) || null;
  const borderColor = (branding.border_color as string) || null;
  const cardColor = (branding.card_color as string) || null;
  const fontHeading = (branding.font_heading as string) || null;
  const fontBody = (branding.font_body as string) || null;
  const themeMode = (branding.theme_mode as string) || "dark";

  // Determine if this is a light theme
  const isLight = themeMode === "light";

  // Build CSS variables only for values that are set
  const cssVars: string[] = [];

  // For light themes, set a data attribute for CSS targeting
  if (isLight) {
    cssVars.push(`color-scheme: light;`);
  }

  if (primaryColor) {
    const safePrimary = sanitizeCssColor(primaryColor);
    if (safePrimary) {
      // Layer 1: Primitives
      cssVars.push(`--primitive-primary-500: ${safePrimary};`);
      cssVars.push(`--primitive-primary-rgb: ${hexToRgb(safePrimary)};`);

      // Backwards compatibility
      cssVars.push(`--portal-primary: ${safePrimary};`);
      cssVars.push(`--neon-magenta: ${safePrimary};`);
      cssVars.push(`--neon-magenta-hsl: ${hexToHsl(safePrimary)};`);
      cssVars.push(`--portal-primary-rgb: ${hexToRgb(safePrimary)};`);
      cssVars.push(`--coral: ${safePrimary};`);
      cssVars.push(`--coral-hsl: ${hexToHsl(safePrimary)};`);
      cssVars.push(`--rose: ${safePrimary};`);
    }
  }

  if (primaryLight) {
    const safePrimaryLight = sanitizeCssColor(primaryLight);
    if (safePrimaryLight) {
      cssVars.push(`--coral-light: ${safePrimaryLight};`);
      cssVars.push(`--portal-primary-light: ${safePrimaryLight};`);
    }
  }

  if (secondaryColor) {
    const safeSecondary = sanitizeCssColor(secondaryColor);
    if (safeSecondary) {
      // Layer 1: Primitives
      cssVars.push(`--primitive-secondary-500: ${safeSecondary};`);
      cssVars.push(`--primitive-secondary-rgb: ${hexToRgb(safeSecondary)};`);

      // Backwards compatibility
      cssVars.push(`--portal-secondary: ${safeSecondary};`);
      // Secondary color maps to --neon-cyan (the highlight/focus color)
      cssVars.push(`--neon-cyan: ${safeSecondary};`);
      cssVars.push(`--neon-cyan-hsl: ${hexToHsl(safeSecondary)};`);
      cssVars.push(`--focus-ring: ${safeSecondary};`);
      // Calendar/deep purple palette - derive from secondary color
      const secondaryDark = adjustBrightness(safeSecondary, -70);
      const secondaryMid = adjustBrightness(safeSecondary, -50);
      cssVars.push(`--cosmic-blue: ${secondaryDark};`);
      cssVars.push(`--deep-violet: ${adjustBrightness(secondaryDark, -10)};`);
      cssVars.push(`--midnight-blue: ${adjustBrightness(secondaryDark, 5)};`);
      cssVars.push(`--twilight-purple: ${secondaryMid};`);
      cssVars.push(`--nebula: ${adjustBrightness(secondaryMid, 15)};`);
      if (isLight) {
        // For light themes, twilight should be a light border color
        cssVars.push(`--twilight: ${safeSecondary};`);
        cssVars.push(`--dusk: ${adjustBrightness(safeSecondary, -3)};`);
      } else {
        cssVars.push(`--twilight: ${safeSecondary};`);
        cssVars.push(`--dusk: ${adjustBrightness(safeSecondary, 15)};`);
      }
    }
  }

  if (accentColor) {
    const safeAccent = sanitizeCssColor(accentColor);
    if (safeAccent) {
      // Layer 1: Primitives
      cssVars.push(`--primitive-accent-500: ${safeAccent};`);
      cssVars.push(`--primitive-accent-rgb: ${hexToRgb(safeAccent)};`);

      // Backwards compatibility
      cssVars.push(`--portal-accent: ${safeAccent};`);
      cssVars.push(`--neon-amber: ${safeAccent};`);
      cssVars.push(`--neon-amber-hsl: ${hexToHsl(safeAccent)};`);
      cssVars.push(`--gold: ${safeAccent};`);
    }
  }

  if (backgroundColor) {
    const safeBg = sanitizeCssColor(backgroundColor);
    if (safeBg) {
      cssVars.push(`--portal-bg: ${safeBg};`);
      cssVars.push(`--void: ${safeBg};`);
      cssVars.push(`--background: ${safeBg};`);
      if (isLight) {
        // For light themes, night should be slightly darker than background
        cssVars.push(`--night: ${adjustBrightness(safeBg, -3)};`);
      } else {
        cssVars.push(`--night: ${adjustBrightness(safeBg, 8)};`);
      }
    }
  }

  if (textColor) {
    const safeText = sanitizeCssColor(textColor);
    if (safeText) {
      cssVars.push(`--portal-text: ${safeText};`);
      cssVars.push(`--cream: ${safeText};`);
      cssVars.push(`--foreground: ${safeText};`);
    }
  }

  if (mutedColor) {
    const safeMuted = sanitizeCssColor(mutedColor);
    if (safeMuted) {
      cssVars.push(`--portal-muted: ${safeMuted};`);
      cssVars.push(`--muted: ${safeMuted};`);
      cssVars.push(`--soft: ${safeMuted};`);
    }
  }

  if (buttonColor) {
    const safeButton = sanitizeCssColor(buttonColor);
    if (safeButton) {
      cssVars.push(`--coral: ${safeButton};`);
      cssVars.push(`--portal-button: ${safeButton};`);
    }
  }

  if (buttonTextColor) {
    const safeButtonText = sanitizeCssColor(buttonTextColor);
    if (safeButtonText) {
      cssVars.push(`--portal-button-text: ${safeButtonText};`);
    }
  }

  if (borderColor) {
    const safeBorder = sanitizeCssColor(borderColor);
    if (safeBorder) {
      cssVars.push(`--portal-border: ${safeBorder};`);
      // Also set twilight if not already set from secondaryColor
      if (!secondaryColor) {
        cssVars.push(`--twilight: ${safeBorder};`);
      }
    }
  }

  if (cardColor) {
    const safeCard = sanitizeCssColor(cardColor);
    if (safeCard) {
      cssVars.push(`--portal-card: ${safeCard};`);
      // Also set dusk for card backgrounds if not already set
      if (!secondaryColor) {
        cssVars.push(`--dusk: ${safeCard};`);
      }
    }
  }

  // For light themes, disable the grain overlay and set light-specific overrides
  if (isLight) {
    cssVars.push(`--grain-opacity: 0;`);
    // Ensure text is dark on light backgrounds
    if (!textColor) {
      cssVars.push(`--cream: #1a1a1a;`);
      cssVars.push(`--foreground: #1a1a1a;`);
    }
    if (!mutedColor) {
      cssVars.push(`--muted: #6b7280;`);
      cssVars.push(`--soft: #4b5563;`);
    }
    // Adjust neon colors for better light theme visibility
    // Use portal's primary color if set, otherwise use neutral defaults
    const safeLightPrimary = primaryColor ? sanitizeCssColor(primaryColor) : null;
    const lightPrimary = safeLightPrimary || "#1f2937"; // Dark gray fallback
    if (!primaryColor) {
      cssVars.push(`--neon-magenta: ${lightPrimary};`);
    }
    cssVars.push(`--neon-green: #059669;`); // Darker green for light bg
    cssVars.push(`--neon-red: #DC2626;`); // Darker red for light bg
    cssVars.push(`--neon-cyan: #0891B2;`); // Darker cyan for light bg
    cssVars.push(`--neon-amber: #D97706;`); // Darker amber for light bg
    // Rose/coral uses portal primary for light themes
    cssVars.push(`--rose: ${lightPrimary};`);
    if (!buttonColor && !primaryColor) {
      cssVars.push(`--coral: ${lightPrimary};`);
    }
    cssVars.push(`--gold: #B45309;`);
    // Glass panel styles for light themes
    cssVars.push(`--glass-bg: linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(249, 250, 251, 0.9));`);
    cssVars.push(`--glass-bg-compact: rgba(255, 255, 255, 0.9);`);
    cssVars.push(`--glass-border: rgba(0, 0, 0, 0.08);`);
    cssVars.push(`--glass-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);`);
    cssVars.push(`--glass-shadow-compact: 0 6px 16px rgba(0, 0, 0, 0.06);`);
    // Card background for light themes - solid light color
    const safeLightCard = cardColor ? sanitizeCssColor(cardColor) : null;
    const lightCardBg = safeLightCard || "#F9FAFB";
    cssVars.push(`--card-bg: ${lightCardBg};`);
    cssVars.push(`--card-bg-hover: ${safeLightCard ? adjustBrightness(safeLightCard, -5) : "#F3F4F6"};`);
  }

  if (fontHeading) {
    const safeFontHeading = sanitizeFontFamily(fontHeading);
    if (safeFontHeading) {
      cssVars.push(`--portal-font-heading: '${safeFontHeading}', serif;`);
    }
  }

  if (fontBody) {
    const safeFontBody = sanitizeFontFamily(fontBody);
    if (safeFontBody) {
      cssVars.push(`--portal-font-body: '${safeFontBody}', sans-serif;`);
    }
  }

  // =========================================================================
  // Component Style Variables (from visual preset + overrides)
  // =========================================================================
  const componentStyle = resolvedBranding.component_style;

  // Border radius
  if (componentStyle.border_radius) {
    const radiusValue = BORDER_RADIUS_VALUES[componentStyle.border_radius];
    cssVars.push(`--radius-base: ${radiusValue};`);
    cssVars.push(`--radius-card: ${radiusValue};`);
    cssVars.push(`--radius-button: ${radiusValue};`);
  }

  // Shadows
  if (componentStyle.shadows) {
    const shadowValue = SHADOW_VALUES[componentStyle.shadows];
    cssVars.push(`--shadow-card: ${shadowValue};`);
  }

  // Glow settings
  if (componentStyle.glow_enabled !== undefined) {
    const glowOpacity = componentStyle.glow_enabled
      ? GLOW_OPACITY_VALUES[componentStyle.glow_intensity || "medium"]
      : 0;
    cssVars.push(`--glow-opacity: ${glowOpacity};`);
  }

  // Glass blur (for glass card style)
  if (componentStyle.glass_enabled !== undefined) {
    cssVars.push(`--glass-blur: ${componentStyle.glass_enabled ? "12px" : "0"};`);
    if (!componentStyle.glass_enabled) {
      // Disable glass backdrop-filter if glass is disabled
      cssVars.push(`--glass-backdrop: none;`);
    }
  }

  // Animation settings
  if (componentStyle.animations) {
    const animMultiplier = componentStyle.animations === "none" ? 0
      : componentStyle.animations === "subtle" ? 0.5 : 1;
    cssVars.push(`--animation-duration-multiplier: ${animMultiplier};`);
    if (componentStyle.animations === "none") {
      cssVars.push(`--animation-play-state: paused;`);
    }
  }

  // =========================================================================
  // Category Color Overrides
  // =========================================================================
  if (resolvedBranding.category_colors) {
    for (const [category, color] of Object.entries(resolvedBranding.category_colors)) {
      const safeCategoryColor = sanitizeCssColor(color as string);
      if (safeCategoryColor) {
        cssVars.push(`--cat-${category}: ${safeCategoryColor};`);
      }
    }
  }

  // Build Google Fonts URL if custom fonts are specified
  const fontsToLoad: string[] = [];
  const safeFontHeadingForUrl = fontHeading ? sanitizeFontFamily(fontHeading) : null;
  const safeFontBodyForUrl = fontBody ? sanitizeFontFamily(fontBody) : null;
  if (safeFontHeadingForUrl) fontsToLoad.push(safeFontHeadingForUrl.replace(/ /g, "+"));
  if (safeFontBodyForUrl && safeFontBodyForUrl !== safeFontHeadingForUrl) fontsToLoad.push(safeFontBodyForUrl.replace(/ /g, "+"));

  const googleFontsUrl = fontsToLoad.length > 0
    ? `https://fonts.googleapis.com/css2?${fontsToLoad.map(f => `family=${f}:wght@400;500;600;700`).join("&")}&display=swap`
    : null;

  // CSS to disable icon glow when configured
  const iconGlowOverride = !iconGlowEnabled
    ? `
.icon-neon,
.icon-neon-subtle,
.icon-neon-intense,
.icon-neon-pulse,
.icon-neon-flicker {
  filter: none !important;
  animation: none !important;
}`
    : "";

  // Build reduced motion override for accessibility
  const reducedMotionCss = `
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}`;

  // Generate the full style block
  const rootCss = cssVars.length > 0 ? `:root {\n  ${cssVars.join("\n  ")}\n}` : "";
  const safeFontHeadingForCss = fontHeading ? sanitizeFontFamily(fontHeading) : null;
  const safeFontBodyForCss = fontBody ? sanitizeFontFamily(fontBody) : null;
  const fontCss = [
    safeFontHeadingForCss ? `.font-serif, .font-display, h1, h2, h3, h4, h5, h6 { font-family: var(--portal-font-heading); }` : "",
    safeFontBodyForCss ? `body, .font-sans { font-family: var(--portal-font-body); }` : "",
  ].filter(Boolean).join("\n");

  const styleContent = [rootCss, fontCss, iconGlowOverride, reducedMotionCss]
    .filter(Boolean)
    .join("\n");

  // Validate color contrast in development
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      const checks = [
        { fg: buttonTextColor, bg: buttonColor, name: "Button text on button" },
        { fg: textColor, bg: backgroundColor, name: "Text on background" },
        { fg: textColor, bg: cardColor, name: "Text on card" },
      ];

      for (const check of checks) {
        if (check.fg && check.bg) {
          const ratio = getContrastRatio(check.fg, check.bg);
          if (ratio < 4.5) {
            console.warn(
              `⚠️ WCAG Contrast Warning: ${check.name} has ratio ${ratio.toFixed(2)}:1 (needs 4.5:1 for AA).`,
              `\n  Foreground: ${check.fg}`,
              `\n  Background: ${check.bg}`,
              `\n  Portal: ${portal.slug}`
            );
          }
        }
      }
    }
  }, [buttonTextColor, buttonColor, textColor, backgroundColor, cardColor, portal.slug]);

  // Set data attributes on body element for component style targeting
  useEffect(() => {
    const body = document.body;

    // Set card style
    if (componentStyle.card_style && componentStyle.card_style !== "default") {
      body.dataset.cardStyle = componentStyle.card_style;
    } else {
      delete body.dataset.cardStyle;
    }

    // Set button style
    if (componentStyle.button_style && componentStyle.button_style !== "default") {
      body.dataset.buttonStyle = componentStyle.button_style;
    } else {
      delete body.dataset.buttonStyle;
    }

    // Set glow state
    if (!componentStyle.glow_enabled) {
      body.dataset.glow = "disabled";
    } else {
      delete body.dataset.glow;
    }

    // Set glass state
    if (!componentStyle.glass_enabled) {
      body.dataset.glass = "disabled";
    } else {
      delete body.dataset.glass;
    }

    // Set animation level
    if (componentStyle.animations && componentStyle.animations !== "full") {
      body.dataset.animations = componentStyle.animations;
    } else {
      delete body.dataset.animations;
    }

    // Set theme mode
    if (isLight) {
      body.dataset.theme = "light";
    } else {
      delete body.dataset.theme;
    }

    // Cleanup on unmount
    return () => {
      delete body.dataset.cardStyle;
      delete body.dataset.buttonStyle;
      delete body.dataset.glow;
      delete body.dataset.glass;
      delete body.dataset.animations;
      delete body.dataset.theme;
    };
  }, [componentStyle, isLight]);

  // Don't render anything if no customizations
  if (!styleContent && !googleFontsUrl) {
    return null;
  }

  return (
    <>
      {/* Load custom Google fonts */}
      {googleFontsUrl && (
        <>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link href={googleFontsUrl} rel="stylesheet" />
        </>
      )}

      {/* Inject portal theme CSS variables */}
      {styleContent && (
        <style dangerouslySetInnerHTML={{ __html: styleContent }} />
      )}
    </>
  );
}

/**
 * Convert hex color to RGB values for use in rgba() functions
 */
function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return "232, 85, 160"; // Default magenta

  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);

  return `${r}, ${g}, ${b}`;
}

/**
 * Convert hex color to HSL values for use in hsl() functions
 * Returns format: "H S% L%" (e.g., "320 80% 62%")
 */
function hexToHsl(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return "320 80% 62%"; // Default magenta

  const r = parseInt(result[1], 16) / 255;
  const g = parseInt(result[2], 16) / 255;
  const b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/**
 * Adjust brightness of a hex color by a percentage
 * Positive values lighten, negative values darken
 */
function adjustBrightness(hex: string, percent: number): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return hex;

  let r = parseInt(result[1], 16);
  let g = parseInt(result[2], 16);
  let b = parseInt(result[3], 16);

  r = Math.min(255, Math.max(0, Math.round(r + (255 * percent) / 100)));
  g = Math.min(255, Math.max(0, Math.round(g + (255 * percent) / 100)));
  b = Math.min(255, Math.max(0, Math.round(b + (255 * percent) / 100)));

  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/**
 * Calculate relative luminance of a hex color per WCAG 2.1
 * https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
function getRelativeLuminance(hex: string): number {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return 0;

  const [r, g, b] = [
    parseInt(result[1], 16) / 255,
    parseInt(result[2], 16) / 255,
    parseInt(result[3], 16) / 255,
  ].map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Calculate WCAG contrast ratio between two colors
 * Returns a value between 1 (no contrast) and 21 (maximum contrast)
 * WCAG AA requires 4.5:1 for normal text, 3:1 for large text
 * WCAG AAA requires 7:1 for normal text, 4.5:1 for large text
 */
export function getContrastRatio(color1: string, color2: string): number {
  const l1 = getRelativeLuminance(color1);
  const l2 = getRelativeLuminance(color2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if a color combination meets WCAG AA standards
 * @param foreground - Text color
 * @param background - Background color
 * @param largeText - Whether the text is large (18pt+ or 14pt bold)
 */
export function meetsWcagAA(foreground: string, background: string, largeText = false): boolean {
  const ratio = getContrastRatio(foreground, background);
  return largeText ? ratio >= 3 : ratio >= 4.5;
}

/**
 * Get a readable text color (black or white) for a given background
 * Returns the color with better contrast
 */
export function getReadableTextColor(background: string): "#000000" | "#FFFFFF" {
  const blackContrast = getContrastRatio("#000000", background);
  const whiteContrast = getContrastRatio("#FFFFFF", background);
  return blackContrast > whiteContrast ? "#000000" : "#FFFFFF";
}
