"use client";

import { useEffect } from "react";
import type { Portal, PortalBranding } from "@/lib/portal-context";
import { applyPreset } from "@/lib/apply-preset";

interface PortalThemeClientProps {
  portal: Portal;
}

export default function PortalThemeClient({ portal }: PortalThemeClientProps) {
  const branding = portal.branding || {};
  const resolvedBranding = applyPreset(branding as PortalBranding);
  const componentStyle = resolvedBranding.component_style;
  const themeMode = (branding.theme_mode as string) || "dark";
  const isLight = themeMode === "light";

  // Validate color contrast in development
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      const checks = [
        { fg: branding.button_text_color, bg: branding.button_color, name: "Button text on button" },
        { fg: branding.text_color, bg: branding.background_color, name: "Text on background" },
        { fg: branding.text_color, bg: branding.card_color, name: "Text on card" },
      ];

      for (const check of checks) {
        if (check.fg && check.bg) {
          const ratio = getContrastRatio(check.fg as string, check.bg as string);
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
  }, [
    branding.button_text_color,
    branding.button_color,
    branding.text_color,
    branding.background_color,
    branding.card_color,
    portal.slug,
  ]);

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

  return null;
}

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

function getContrastRatio(color1: string, color2: string): number {
  const l1 = getRelativeLuminance(color1);
  const l2 = getRelativeLuminance(color2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}
