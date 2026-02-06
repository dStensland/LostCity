"use client";

/**
 * LogoBrand - The official Lost City brand logo
 *
 * Variants:
 * - full: Complete logo with skyline, text, and neon reflection
 * - symbol: Just the skyline with reflection (no text)
 * - text: Just "LOST CITY" text
 */

interface LogoBrandProps {
  variant?: "full" | "symbol" | "text";
  size?: number;
  className?: string;
}

export default function LogoBrand({
  variant = "full",
  size = 120,
  className = ""
}: LogoBrandProps) {
  const aspectRatios = {
    full: 1.4,
    symbol: 1.1,
    text: 4,
  };

  const width = size * aspectRatios[variant];
  const height = size;

  if (variant === "text") {
    return (
      <svg
        viewBox="0 0 280 50"
        width={width}
        height={height}
        className={className}
        aria-label="Lost City"
      >
        <text
          x="140"
          y="38"
          textAnchor="middle"
          fontFamily="var(--font-outfit), Arial Black, sans-serif"
          fontSize="42"
          fontWeight="800"
          letterSpacing="4"
          fill="#e8e8e8"
        >
          LOST CITY
        </text>
      </svg>
    );
  }

  if (variant === "symbol") {
    return (
      <svg
        viewBox="0 0 100 90"
        width={width}
        height={height}
        className={className}
        aria-label="Lost City"
      >
        <defs>
          <linearGradient id="neonGradientSymbol" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#00e5ff"/>
            <stop offset="50%" stopColor="#ff6b9d"/>
            <stop offset="100%" stopColor="#b06bff"/>
          </linearGradient>
          <filter id="glowSymbol" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Top skyline - dark with subtle blue tint */}
        <path
          d="M10 45 L10 38 L18 38 L18 28 L26 28 L26 18 L34 18 L34 8 L42 8 L42 18 L50 18 L50 28 L58 28 L58 18 L66 18 L66 8 L74 8 L74 18 L82 18 L82 28 L90 28 L90 38 L90 45 Z"
          fill="#1a2a3c"
        />

        {/* Bottom reflection - neon gradient */}
        <path
          d="M10 48 L10 55 L18 55 L18 65 L26 65 L26 75 L34 75 L34 85 L42 85 L42 75 L50 75 L50 65 L58 65 L58 75 L66 75 L66 85 L74 85 L74 75 L82 75 L82 65 L90 65 L90 55 L90 48 Z"
          fill="url(#neonGradientSymbol)"
          filter="url(#glowSymbol)"
          opacity="0.95"
        />
      </svg>
    );
  }

  // Full variant
  return (
    <svg
      viewBox="0 0 200 145"
      width={width}
      height={height}
      className={className}
      aria-label="Lost City"
    >
      <defs>
        <linearGradient id="neonGradientFull" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#00e5ff"/>
          <stop offset="50%" stopColor="#ff6b9d"/>
          <stop offset="100%" stopColor="#b06bff"/>
        </linearGradient>
        <filter id="glowFull" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="blur"/>
          <feMerge>
            <feMergeNode in="blur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        <filter id="textShadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="1" stdDeviation="1" floodOpacity="0.5"/>
        </filter>
      </defs>

      {/* Top skyline */}
      <path
        d="M30 55 L30 45 L42 45 L42 32 L54 32 L54 18 L66 18 L66 5 L78 5 L78 18 L90 18 L90 32 L102 32 L102 18 L114 18 L114 5 L126 5 L126 18 L138 18 L138 32 L150 32 L150 45 L162 45 L162 55 L170 55 L170 62 L30 62 Z"
        fill="#1a2a3c"
      />

      {/* LOST CITY text */}
      <text
        x="100"
        y="82"
        textAnchor="middle"
        fontFamily="var(--font-outfit), Arial Black, sans-serif"
        fontSize="24"
        fontWeight="800"
        letterSpacing="3"
        fill="#e8e8e8"
        filter="url(#textShadow)"
      >
        LOST CITY
      </text>

      {/* Bottom reflection */}
      <path
        d="M30 92 L30 102 L42 102 L42 115 L54 115 L54 128 L66 128 L66 142 L78 142 L78 128 L90 128 L90 115 L102 115 L102 128 L114 128 L114 142 L126 142 L126 128 L138 128 L138 115 L150 115 L150 102 L162 102 L162 92 L170 92 L170 88 L30 88 Z"
        fill="url(#neonGradientFull)"
        filter="url(#glowFull)"
        opacity="0.95"
      />
    </svg>
  );
}
