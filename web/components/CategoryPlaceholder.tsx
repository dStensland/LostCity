"use client";

import { getCategoryColor } from "./CategoryIcon";

interface CategoryPlaceholderProps {
  category: string | null;
  className?: string;
}

// Unique visual patterns for each category
const CATEGORY_PATTERNS: Record<string, {
  pattern: "waves" | "circles" | "grid" | "diagonal" | "dots" | "rays" | "rings" | "bars";
  icon: string; // SVG path
  secondary?: string; // Secondary color overlay
}> = {
  music: {
    pattern: "waves",
    icon: "M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3",
  },
  comedy: {
    pattern: "circles",
    icon: "M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  art: {
    pattern: "diagonal",
    icon: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z",
  },
  theater: {
    pattern: "rays",
    icon: "M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z",
  },
  film: {
    pattern: "bars",
    icon: "M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z",
  },
  community: {
    pattern: "dots",
    icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z",
  },
  food_drink: {
    pattern: "grid",
    icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  sports: {
    pattern: "diagonal",
    icon: "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  fitness: {
    pattern: "waves",
    icon: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z",
  },
  nightlife: {
    pattern: "rays",
    icon: "M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z",
  },
  family: {
    pattern: "circles",
    icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
  },
  learning: {
    pattern: "grid",
    icon: "M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222",
  },
  dance: {
    pattern: "waves",
    icon: "M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3",
  },
  outdoors: {
    pattern: "diagonal",
    icon: "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  markets: {
    pattern: "dots",
    icon: "M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z",
  },
  gaming: {
    pattern: "grid",
    icon: "M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z",
  },
  wellness: {
    pattern: "rings",
    icon: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z",
  },
};

// Generate SVG pattern based on type
function getPatternSvg(pattern: string, color: string): string {
  const opacity = "0.07";

  switch (pattern) {
    case "waves":
      return `
        <pattern id="waves" width="60" height="30" patternUnits="userSpaceOnUse">
          <path d="M0 15 Q15 0, 30 15 T60 15" stroke="${color}" stroke-width="2" fill="none" opacity="${opacity}"/>
          <path d="M0 25 Q15 10, 30 25 T60 25" stroke="${color}" stroke-width="1.5" fill="none" opacity="${opacity}"/>
        </pattern>
      `;
    case "circles":
      return `
        <pattern id="circles" width="40" height="40" patternUnits="userSpaceOnUse">
          <circle cx="20" cy="20" r="8" stroke="${color}" stroke-width="1.5" fill="none" opacity="${opacity}"/>
          <circle cx="20" cy="20" r="16" stroke="${color}" stroke-width="1" fill="none" opacity="0.04"/>
        </pattern>
      `;
    case "grid":
      return `
        <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M24 0L0 0 0 24" stroke="${color}" stroke-width="1" fill="none" opacity="${opacity}"/>
        </pattern>
      `;
    case "diagonal":
      return `
        <pattern id="diagonal" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M0 20L20 0M-5 5L5 -5M15 25L25 15" stroke="${color}" stroke-width="1.5" fill="none" opacity="${opacity}"/>
        </pattern>
      `;
    case "dots":
      return `
        <pattern id="dots" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="10" cy="10" r="2" fill="${color}" opacity="${opacity}"/>
        </pattern>
      `;
    case "rays":
      return `
        <pattern id="rays" width="60" height="60" patternUnits="userSpaceOnUse">
          <path d="M30 0L30 60M0 30L60 30M8 8L52 52M52 8L8 52" stroke="${color}" stroke-width="1" fill="none" opacity="0.05"/>
        </pattern>
      `;
    case "rings":
      return `
        <pattern id="rings" width="50" height="50" patternUnits="userSpaceOnUse">
          <circle cx="25" cy="25" r="20" stroke="${color}" stroke-width="1" fill="none" opacity="0.05"/>
          <circle cx="25" cy="25" r="12" stroke="${color}" stroke-width="1.5" fill="none" opacity="${opacity}"/>
          <circle cx="25" cy="25" r="4" fill="${color}" opacity="0.05"/>
        </pattern>
      `;
    case "bars":
      return `
        <pattern id="bars" width="12" height="12" patternUnits="userSpaceOnUse">
          <rect x="0" y="0" width="6" height="12" fill="${color}" opacity="0.04"/>
        </pattern>
      `;
    default:
      return `
        <pattern id="default" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="10" cy="10" r="1" fill="${color}" opacity="${opacity}"/>
        </pattern>
      `;
  }
}

export default function CategoryPlaceholder({ category, className = "" }: CategoryPlaceholderProps) {
  const color = getCategoryColor(category || "other");
  const config = CATEGORY_PATTERNS[category || ""] || { pattern: "dots" as const, icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" };
  const patternSvg = getPatternSvg(config.pattern, color);
  const patternId = config.pattern;

  return (
    <div className={`relative w-full h-full overflow-hidden ${className}`}>
      {/* Base gradient */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 100% 100% at 50% -30%, ${color}25 0%, transparent 60%),
            radial-gradient(ellipse 80% 80% at 100% 100%, ${color}15 0%, transparent 50%),
            linear-gradient(145deg, var(--night) 0%, var(--void) 100%)
          `,
        }}
      />

      {/* Pattern overlay */}
      <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid slice">
        <defs dangerouslySetInnerHTML={{ __html: patternSvg }} />
        <rect width="100%" height="100%" fill={`url(#${patternId})`} />
      </svg>

      {/* Decorative glow orbs */}
      <div
        className="absolute -top-12 -right-12 w-40 h-40 rounded-full opacity-[0.12]"
        style={{
          background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
        }}
      />
      <div
        className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full opacity-[0.08]"
        style={{
          background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
        }}
      />

      {/* Center icon with glow container */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="relative flex items-center justify-center w-20 h-20 rounded-2xl"
          style={{
            background: `linear-gradient(135deg, ${color}18 0%, ${color}08 100%)`,
            border: `1px solid ${color}25`,
            boxShadow: `0 0 40px ${color}15, inset 0 1px 0 ${color}10`,
          }}
        >
          <svg
            className="w-10 h-10"
            fill="none"
            stroke={color}
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            style={{
              filter: `drop-shadow(0 0 8px ${color}40)`,
              opacity: 0.7,
            }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d={config.icon} />
          </svg>
        </div>
      </div>
    </div>
  );
}
