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

  // Extract branding values with defaults
  const primaryColor = (branding.primary_color as string) || null;
  const secondaryColor = (branding.secondary_color as string) || null;
  const backgroundColor = (branding.background_color as string) || null;
  const fontHeading = (branding.font_heading as string) || null;
  const fontBody = (branding.font_body as string) || null;

  // Build CSS variables only for values that are set
  const cssVars: string[] = [];

  if (primaryColor) {
    cssVars.push(`--portal-primary: ${primaryColor};`);
    // Also set as neon-magenta override for existing components
    cssVars.push(`--neon-magenta: ${primaryColor};`);
    // Generate HSL version for glow effects (approximate)
    cssVars.push(`--portal-primary-rgb: ${hexToRgb(primaryColor)};`);
  }

  if (secondaryColor) {
    cssVars.push(`--portal-secondary: ${secondaryColor};`);
    cssVars.push(`--twilight: ${secondaryColor};`);
  }

  if (backgroundColor) {
    cssVars.push(`--portal-bg: ${backgroundColor};`);
    cssVars.push(`--void: ${backgroundColor};`);
    cssVars.push(`--background: ${backgroundColor};`);
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

  // Generate the full style block
  const styleContent = cssVars.length > 0
    ? `:root {\n  ${cssVars.join("\n  ")}\n}\n${fontHeading ? `.font-serif, .font-display, h1, h2, h3, h4, h5, h6 { font-family: var(--portal-font-heading); }` : ""}\n${fontBody ? `body, .font-sans { font-family: var(--portal-font-body); }` : ""}`
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
