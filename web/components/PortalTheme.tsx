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
    // Layer 1: Primitives
    cssVars.push(`--primitive-primary-500: ${primaryColor};`);
    cssVars.push(`--primitive-primary-rgb: ${hexToRgb(primaryColor)};`);

    // Backwards compatibility
    cssVars.push(`--portal-primary: ${primaryColor};`);
    cssVars.push(`--neon-magenta: ${primaryColor};`);
    cssVars.push(`--neon-magenta-hsl: ${hexToHsl(primaryColor)};`);
    cssVars.push(`--portal-primary-rgb: ${hexToRgb(primaryColor)};`);
    cssVars.push(`--coral: ${primaryColor};`);
    cssVars.push(`--coral-hsl: ${hexToHsl(primaryColor)};`);
    cssVars.push(`--rose: ${primaryColor};`);
  }

  if (primaryLight) {
    cssVars.push(`--coral-light: ${primaryLight};`);
    cssVars.push(`--portal-primary-light: ${primaryLight};`);
  }

  if (secondaryColor) {
    // Layer 1: Primitives
    cssVars.push(`--primitive-secondary-500: ${secondaryColor};`);
    cssVars.push(`--primitive-secondary-rgb: ${hexToRgb(secondaryColor)};`);

    // Backwards compatibility
    cssVars.push(`--portal-secondary: ${secondaryColor};`);
    // Secondary color maps to --neon-cyan (the highlight/focus color)
    cssVars.push(`--neon-cyan: ${secondaryColor};`);
    cssVars.push(`--neon-cyan-hsl: ${hexToHsl(secondaryColor)};`);
    cssVars.push(`--focus-ring: ${secondaryColor};`);
    // Calendar/deep purple palette - derive from secondary color
    const secondaryDark = adjustBrightness(secondaryColor, -70);
    const secondaryMid = adjustBrightness(secondaryColor, -50);
    cssVars.push(`--cosmic-blue: ${secondaryDark};`);
    cssVars.push(`--deep-violet: ${adjustBrightness(secondaryDark, -10)};`);
    cssVars.push(`--midnight-blue: ${adjustBrightness(secondaryDark, 5)};`);
    cssVars.push(`--twilight-purple: ${secondaryMid};`);
    cssVars.push(`--nebula: ${adjustBrightness(secondaryMid, 15)};`);
    if (isLight) {
      // For light themes, twilight should be a light border color
      cssVars.push(`--twilight: ${secondaryColor};`);
      cssVars.push(`--dusk: ${adjustBrightness(secondaryColor, -3)};`);
    } else {
      cssVars.push(`--twilight: ${secondaryColor};`);
      cssVars.push(`--dusk: ${adjustBrightness(secondaryColor, 15)};`);
    }
  }

  if (accentColor) {
    // Layer 1: Primitives
    cssVars.push(`--primitive-accent-500: ${accentColor};`);
    cssVars.push(`--primitive-accent-rgb: ${hexToRgb(accentColor)};`);

    // Backwards compatibility
    cssVars.push(`--portal-accent: ${accentColor};`);
    cssVars.push(`--neon-amber: ${accentColor};`);
    cssVars.push(`--neon-amber-hsl: ${hexToHsl(accentColor)};`);
    cssVars.push(`--gold: ${accentColor};`);
  }

  if (backgroundColor) {
    cssVars.push(`--portal-bg: ${backgroundColor};`);
    cssVars.push(`--void: ${backgroundColor};`);
    cssVars.push(`--background: ${backgroundColor};`);
    if (isLight) {
      // For light themes, night should be slightly darker than background
      cssVars.push(`--night: ${adjustBrightness(backgroundColor, -3)};`);
    } else {
      cssVars.push(`--night: ${adjustBrightness(backgroundColor, 8)};`);
    }
  }

  if (textColor) {
    cssVars.push(`--portal-text: ${textColor};`);
    cssVars.push(`--cream: ${textColor};`);
    cssVars.push(`--foreground: ${textColor};`);
  }

  if (mutedColor) {
    cssVars.push(`--portal-muted: ${mutedColor};`);
    cssVars.push(`--muted: ${mutedColor};`);
    cssVars.push(`--soft: ${mutedColor};`);
  }

  if (buttonColor) {
    cssVars.push(`--coral: ${buttonColor};`);
    cssVars.push(`--portal-button: ${buttonColor};`);
  }

  if (buttonTextColor) {
    cssVars.push(`--portal-button-text: ${buttonTextColor};`);
  }

  if (borderColor) {
    cssVars.push(`--portal-border: ${borderColor};`);
    // Also set twilight if not already set from secondaryColor
    if (!secondaryColor) {
      cssVars.push(`--twilight: ${borderColor};`);
    }
  }

  if (cardColor) {
    cssVars.push(`--portal-card: ${cardColor};`);
    // Also set dusk for card backgrounds if not already set
    if (!secondaryColor) {
      cssVars.push(`--dusk: ${cardColor};`);
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
    const lightPrimary = primaryColor || "#1f2937"; // Dark gray fallback
    if (!primaryColor) {
      cssVars.push(`--neon-magenta: ${lightPrimary};`);
    }
    cssVars.push(`--neon-green: #059669;`); // Darker green for light bg
    cssVars.push(`--neon-red: #DC2626;`); // Darker red for light bg
    cssVars.push(`--neon-cyan: #0891B2;`); // Darker cyan for light bg
    cssVars.push(`--neon-amber: #D97706;`); // Darker amber for light bg
    // Rose/coral uses portal primary for light themes
    cssVars.push(`--rose: ${primaryColor || lightPrimary};`);
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
    cssVars.push(`--card-bg: ${cardColor || "#F9FAFB"};`);
    cssVars.push(`--card-bg-hover: ${cardColor ? adjustBrightness(cardColor, -5) : "#F3F4F6"};`);
  }

  if (fontHeading) {
    cssVars.push(`--portal-font-heading: '${fontHeading}', serif;`);
  }

  if (fontBody) {
    cssVars.push(`--portal-font-body: '${fontBody}', sans-serif;`);
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
      cssVars.push(`--cat-${category}: ${color};`);
    }
  }

  // Build Google Fonts URL if custom fonts are specified
  const fontsToLoad: string[] = [];
  if (fontHeading) fontsToLoad.push(fontHeading.replace(/ /g, "+"));
  if (fontBody && fontBody !== fontHeading) fontsToLoad.push(fontBody.replace(/ /g, "+"));

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
  const fontCss = [
    fontHeading ? `.font-serif, .font-display, h1, h2, h3, h4, h5, h6 { font-family: var(--portal-font-heading); }` : "",
    fontBody ? `body, .font-sans { font-family: var(--portal-font-body); }` : "",
  ].filter(Boolean).join("\n");

  const styleContent = [rootCss, fontCss, iconGlowOverride, reducedMotionCss]
    .filter(Boolean)
    .join("\n");

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
