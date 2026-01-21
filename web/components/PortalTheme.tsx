"use client";

import type { Portal } from "@/lib/portal-context";

interface PortalThemeProps {
  portal: Portal;
}

/**
 * Injects portal-specific CSS variables and loads custom fonts.
 * Renders a <style> tag with CSS custom properties that override defaults.
 */
export function PortalTheme({ portal }: PortalThemeProps) {
  const branding = portal.branding || {};
  const settings = portal.settings || {};

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
    cssVars.push(`--portal-primary: ${primaryColor};`);
    cssVars.push(`--neon-magenta: ${primaryColor};`);
    cssVars.push(`--portal-primary-rgb: ${hexToRgb(primaryColor)};`);
    cssVars.push(`--coral: ${primaryColor};`);
  }

  if (primaryLight) {
    cssVars.push(`--coral-light: ${primaryLight};`);
    cssVars.push(`--portal-primary-light: ${primaryLight};`);
  }

  if (secondaryColor) {
    cssVars.push(`--portal-secondary: ${secondaryColor};`);
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
    cssVars.push(`--portal-accent: ${accentColor};`);
    cssVars.push(`--neon-cyan: ${accentColor};`);
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

  // Generate the full style block
  const styleContent = cssVars.length > 0 || iconGlowOverride
    ? `:root {\n  ${cssVars.join("\n  ")}\n}\n${fontHeading ? `.font-serif, .font-display, h1, h2, h3, h4, h5, h6 { font-family: var(--portal-font-heading); }` : ""}\n${fontBody ? `body, .font-sans { font-family: var(--portal-font-body); }` : ""}${iconGlowOverride}`
    : "";

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
