"use client";

import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClass, createCssVarClassForLength } from "@/lib/css-utils";
import { getCategoryColor } from "./CategoryIcon";

// Theme configurations for seasonal placeholders
export type PlaceholderTheme = "valentines" | "lunar-new-year" | "black-history-month" | "mardi-gras" | "st-patricks" | "pride" | null;

const THEME_CONFIG: Record<NonNullable<PlaceholderTheme>, { glowColor: string; accentColor: string; overlayIcon?: string }> = {
  valentines: {
    glowColor: "#FF69B4",
    accentColor: "#DC143C",
    overlayIcon: "❤️",
  },
  "lunar-new-year": {
    glowColor: "#DC143C",
    accentColor: "#FFD700",
    overlayIcon: "🐉",
  },
  "black-history-month": {
    glowColor: "#9B59B6",
    accentColor: "#2ECC71",
  },
  "mardi-gras": {
    glowColor: "#9B59B6",
    accentColor: "#FFD700",
    overlayIcon: "⚜️",
  },
  "st-patricks": {
    glowColor: "#00D9A0",
    accentColor: "#00D9A0",
    overlayIcon: "☘️",
  },
  pride: {
    glowColor: "#E855A0",
    accentColor: "#00D4E8",
  },
};

interface CategoryPlaceholderProps {
  category?: string | null;
  color?: string; // Override color (for non-category contexts)
  className?: string;
  size?: "sm" | "md" | "lg"; // Controls icon size and glow intensity
  variant?: "default" | "featured"; // Featured has 1.5x glow, gold border
  theme?: PlaceholderTheme; // Seasonal theme override
}

// Unique visual patterns and icons for each category
const CATEGORY_PATTERNS: Record<string, {
  pattern: "waves" | "circuits" | "hexagons" | "soundwave" | "dots" | "rays" | "rings" | "filmstrip" | "confetti" | "pulse";
  icon: string;
}> = {
  music: {
    pattern: "soundwave",
    icon: "M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z",
  },
  comedy: {
    pattern: "confetti",
    icon: "M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  art: {
    pattern: "hexagons",
    icon: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z",
  },
  theater: {
    pattern: "rays",
    icon: "M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z",
  },
  film: {
    pattern: "filmstrip",
    icon: "M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z",
  },
  community: {
    pattern: "dots",
    icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
  },
  food_drink: {
    pattern: "circuits",
    icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  sports: {
    pattern: "pulse",
    icon: "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  fitness: {
    pattern: "pulse",
    icon: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z",
  },
  nightlife: {
    pattern: "rays",
    icon: "M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z",
  },
  family: {
    pattern: "confetti",
    icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
  },
  learning: {
    pattern: "circuits",
    icon: "M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z",
  },
  dance: {
    pattern: "soundwave",
    icon: "M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z",
  },
  outdoors: {
    pattern: "waves",
    icon: "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  markets: {
    pattern: "hexagons",
    icon: "M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z",
  },
  gaming: {
    pattern: "circuits",
    icon: "M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z",
  },
  wellness: {
    pattern: "rings",
    icon: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z",
  },
};

// Generate stylized neon SVG pattern
function getPatternSvg(pattern: string, color: string): string {
  switch (pattern) {
    case "soundwave":
      return `
        <defs>
          <linearGradient id="soundwave-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="${color}" stop-opacity="0"/>
            <stop offset="50%" stop-color="${color}" stop-opacity="0.15"/>
            <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <g fill="none" stroke="url(#soundwave-grad)" stroke-width="2">
          <path d="M0,50 Q25,30 50,50 T100,50 T150,50 T200,50 T250,50 T300,50" class="animate-wave-1"/>
          <path d="M0,65 Q25,45 50,65 T100,65 T150,65 T200,65 T250,65 T300,65" class="animate-wave-2" stroke-opacity="0.7"/>
          <path d="M0,80 Q25,60 50,80 T100,80 T150,80 T200,80 T250,80 T300,80" class="animate-wave-3" stroke-opacity="0.4"/>
        </g>
      `;
    case "circuits":
      return `
        <defs>
          <filter id="neon-glow">
            <feGaussianBlur stdDeviation="2" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        <g fill="none" stroke="${color}" stroke-width="1" opacity="0.12" filter="url(#neon-glow)">
          <path d="M0,25 L20,25 L20,10 L40,10"/>
          <path d="M0,50 L30,50 L30,70 L50,70"/>
          <path d="M60,0 L60,30 L80,30 L80,50"/>
          <path d="M100,25 L80,25"/>
          <circle cx="20" cy="25" r="3" fill="${color}"/>
          <circle cx="40" cy="10" r="3" fill="${color}"/>
          <circle cx="50" cy="70" r="3" fill="${color}"/>
          <circle cx="80" cy="50" r="3" fill="${color}"/>
        </g>
      `;
    case "hexagons":
      return `
        <defs>
          <filter id="hex-glow">
            <feGaussianBlur stdDeviation="1.5" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        <g fill="none" stroke="${color}" stroke-width="1.5" opacity="0.1" filter="url(#hex-glow)">
          <polygon points="50,5 90,27.5 90,72.5 50,95 10,72.5 10,27.5"/>
          <polygon points="50,20 75,35 75,65 50,80 25,65 25,35"/>
        </g>
      `;
    case "dots":
      return `
        <defs>
          <radialGradient id="dot-grad">
            <stop offset="0%" stop-color="${color}" stop-opacity="0.3"/>
            <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <g>
          <circle cx="25" cy="25" r="8" fill="url(#dot-grad)"/>
          <circle cx="75" cy="25" r="5" fill="url(#dot-grad)"/>
          <circle cx="50" cy="60" r="6" fill="url(#dot-grad)"/>
          <circle cx="25" cy="25" r="2" fill="${color}" opacity="0.25"/>
          <circle cx="75" cy="25" r="1.5" fill="${color}" opacity="0.2"/>
          <circle cx="50" cy="60" r="1.8" fill="${color}" opacity="0.22"/>
        </g>
      `;
    case "rays":
      return `
        <defs>
          <linearGradient id="ray-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="${color}" stop-opacity="0.2"/>
            <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <g fill="none" stroke="url(#ray-grad)" stroke-width="2">
          <line x1="50" y1="0" x2="50" y2="100"/>
          <line x1="0" y1="50" x2="100" y2="50"/>
          <line x1="15" y1="15" x2="85" y2="85"/>
          <line x1="85" y1="15" x2="15" y2="85"/>
        </g>
        <circle cx="50" cy="50" r="4" fill="${color}" opacity="0.15"/>
      `;
    case "rings":
      return `
        <defs>
          <filter id="ring-glow">
            <feGaussianBlur stdDeviation="3" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        <g fill="none" stroke="${color}" filter="url(#ring-glow)">
          <circle cx="50" cy="50" r="40" stroke-width="1" opacity="0.08"/>
          <circle cx="50" cy="50" r="28" stroke-width="1.5" opacity="0.12"/>
          <circle cx="50" cy="50" r="16" stroke-width="2" opacity="0.15"/>
          <circle cx="50" cy="50" r="4" fill="${color}" opacity="0.2"/>
        </g>
      `;
    case "filmstrip":
      return `
        <defs>
          <filter id="film-glow">
            <feGaussianBlur stdDeviation="1" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        <g fill="none" stroke="${color}" stroke-width="1.5" opacity="0.12" filter="url(#film-glow)">
          <rect x="5" y="5" width="90" height="90" rx="4"/>
          <rect x="10" y="10" width="12" height="8"/>
          <rect x="10" y="82" width="12" height="8"/>
          <rect x="78" y="10" width="12" height="8"/>
          <rect x="78" y="82" width="12" height="8"/>
          <line x1="5" y1="50" x2="95" y2="50"/>
        </g>
      `;
    case "confetti":
      return `
        <g>
          <rect x="15" y="20" width="8" height="8" fill="${color}" opacity="0.15" transform="rotate(15 19 24)"/>
          <rect x="70" y="15" width="6" height="6" fill="${color}" opacity="0.12" transform="rotate(-20 73 18)"/>
          <rect x="45" y="70" width="10" height="10" fill="${color}" opacity="0.1" transform="rotate(45 50 75)"/>
          <circle cx="30" cy="60" r="4" fill="${color}" opacity="0.12"/>
          <circle cx="80" cy="55" r="3" fill="${color}" opacity="0.1"/>
          <polygon points="60,30 65,40 55,40" fill="${color}" opacity="0.12"/>
        </g>
      `;
    case "pulse":
      return `
        <defs>
          <linearGradient id="pulse-grad" x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stop-color="${color}" stop-opacity="0"/>
            <stop offset="50%" stop-color="${color}" stop-opacity="0.2"/>
            <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <path d="M0,50 L20,50 L25,30 L35,70 L45,40 L55,60 L65,45 L75,55 L80,50 L100,50"
              fill="none" stroke="url(#pulse-grad)" stroke-width="2"/>
        <circle cx="50" cy="50" r="2" fill="${color}" opacity="0.25"/>
      `;
    case "waves":
    default:
      return `
        <defs>
          <linearGradient id="wave-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="${color}" stop-opacity="0"/>
            <stop offset="50%" stop-color="${color}" stop-opacity="0.12"/>
            <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <g fill="none" stroke="url(#wave-grad)" stroke-width="1.5">
          <path d="M0,20 Q50,0 100,20 T200,20"/>
          <path d="M0,50 Q50,30 100,50 T200,50"/>
          <path d="M0,80 Q50,60 100,80 T200,80"/>
        </g>
      `;
  }
}

export default function CategoryPlaceholder({
  category,
  color: colorOverride,
  className = "",
  size = "md",
  variant = "default",
  theme = null,
}: CategoryPlaceholderProps) {
  // Get base color from category or override
  const baseColor = colorOverride || getCategoryColor(category || "other");

  // Apply theme overrides if provided
  const themeConfig = theme ? THEME_CONFIG[theme] : null;
  const color = themeConfig?.glowColor || baseColor;
  // Note: accentColor from themeConfig is used for potential future gradient effects

  const config = CATEGORY_PATTERNS[category || ""] || {
    pattern: "dots" as const,
    icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
  };
  const patternSvg = getPatternSvg(config.pattern, color);

  // Size variants
  const iconSize = { sm: "w-8 h-8", md: "w-14 h-14", lg: "w-20 h-20" }[size];
  const containerSize = { sm: "w-14 h-14", md: "w-24 h-24", lg: "w-32 h-32" }[size];

  // Glow intensity - 1.5x for featured variant
  const baseGlow = { sm: 20, md: 40, lg: 60 }[size];
  const glowIntensity = variant === "featured" ? `${baseGlow * 1.5}px` : `${baseGlow}px`;

  // Featured variant styling
  const isFeatured = variant === "featured";

  // Apply icon pulse animation for large size
  const iconPulseClass = size === "lg" ? "animate-placeholder-icon-pulse" : "";
  const colorClass = createCssVarClass("--placeholder-color", color, "placeholder-color");
  const glowClass = createCssVarClassForLength("--placeholder-glow-size", glowIntensity, "placeholder-glow");
  const placeholderCss = [colorClass?.css, glowClass?.css].filter(Boolean).join("\n");

  return (
    <div
      className={`relative w-full h-full overflow-hidden category-placeholder ${
        isFeatured ? "placeholder-featured" : ""
      } ${colorClass?.className ?? ""} ${glowClass?.className ?? ""} ${className}`}
    >
      <ScopedStyles css={placeholderCss} />
      {/* Deep void background */}
      <div className="absolute inset-0 bg-[var(--void)]" />

      {/* Primary gradient glow from top */}
      <div className="absolute inset-0 placeholder-glow" />

      {/* Animated neon line at top */}
      <div className="absolute top-0 left-0 right-0 h-[2px] placeholder-line" />

      {/* Pattern layer */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
      >
        <g dangerouslySetInnerHTML={{ __html: patternSvg }} />
      </svg>

      {/* Floating orb - top right */}
      <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full placeholder-orb placeholder-orb-top" />

      {/* Floating orb - bottom left */}
      <div className="absolute -bottom-12 -left-12 w-40 h-40 rounded-full placeholder-orb placeholder-orb-bottom" />

      {/* Theme overlay icon (for seasonal themes) */}
      {themeConfig?.overlayIcon && (
        <div className="absolute top-3 right-3 text-2xl opacity-30">
          {themeConfig.overlayIcon}
        </div>
      )}

      {/* Center icon with neon glow */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className={`relative flex items-center justify-center ${containerSize} rounded-2xl placeholder-center`}>
          {/* Icon with neon effect */}
          <svg
            className={`${iconSize} ${iconPulseClass} placeholder-icon`}
            fill="none"
            stroke={color}
            viewBox="0 0 24 24"
            strokeWidth={1.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d={config.icon} />
          </svg>
        </div>
      </div>

      {/* Subtle scanline effect */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] placeholder-scanlines" />

      {/* Bottom accent line */}
      <div className="absolute bottom-0 left-0 right-0 placeholder-accent" />
    </div>
  );
}
