"use client";

interface AtlantaFamiliesLogoProps {
  className?: string;
  variant?: "full" | "compact" | "icon";
}

/**
 * Atlanta Families Logo
 *
 * A warm, welcoming logo for the family-friendly portal.
 * Features a stylized sun/tree motif with friendly typography.
 *
 * Variants:
 * - full: Complete logo with icon and text
 * - compact: Smaller version for headers when scrolled
 * - icon: Just the icon mark
 */
export default function AtlantaFamiliesLogo({
  className = "",
  variant = "full"
}: AtlantaFamiliesLogoProps) {
  // Colors from family_friendly palette
  const primaryGreen = "#059669";  // Emerald green
  const accentYellow = "#fde047";  // Warm yellow
  const warmOrange = "#f59e0b";    // Amber
  const textColor = "#1c1917";     // Stone dark

  if (variant === "icon") {
    return (
      <svg
        viewBox="0 0 48 48"
        className={className}
        aria-label="Atlanta Families"
      >
        {/* Sun rays */}
        <g opacity="0.9">
          <circle cx="24" cy="14" r="2" fill={accentYellow} />
          <circle cx="32" cy="18" r="1.5" fill={accentYellow} />
          <circle cx="16" cy="18" r="1.5" fill={accentYellow} />
          <circle cx="34" cy="24" r="1.5" fill={accentYellow} />
          <circle cx="14" cy="24" r="1.5" fill={accentYellow} />
        </g>

        {/* Tree/nature element */}
        <path
          d="M24 8 L32 22 L28 22 L34 32 L29 32 L33 40 L15 40 L19 32 L14 32 L20 22 L16 22 Z"
          fill={primaryGreen}
        />

        {/* Trunk */}
        <rect x="21" y="38" width="6" height="6" rx="1" fill={warmOrange} />

        {/* Small heart in tree */}
        <path
          d="M24 26 C22 24, 20 25, 20 27 C20 29, 24 32, 24 32 C24 32, 28 29, 28 27 C28 25, 26 24, 24 26"
          fill={accentYellow}
          opacity="0.9"
        />
      </svg>
    );
  }

  if (variant === "compact") {
    return (
      <svg
        viewBox="0 0 180 40"
        className={className}
        aria-label="Atlanta Families"
      >
        {/* Small tree icon */}
        <g transform="translate(0, 2)">
          <path
            d="M18 4 L24 14 L21 14 L26 22 L22 22 L25 28 L11 28 L14 22 L10 22 L15 14 L12 14 Z"
            fill={primaryGreen}
          />
          <rect x="15" y="27" width="6" height="5" rx="1" fill={warmOrange} />
          <circle cx="18" cy="2" r="2" fill={accentYellow} opacity="0.8" />
        </g>

        {/* Text */}
        <text
          x="38"
          y="26"
          fontFamily="var(--portal-font-heading, 'Nunito', sans-serif)"
          fontSize="18"
          fontWeight="700"
          fill={textColor}
        >
          Atlanta Families
        </text>
      </svg>
    );
  }

  // Full variant
  return (
    <svg
      viewBox="0 0 260 64"
      className={className}
      aria-label="Atlanta Families"
    >
      {/* Tree icon */}
      <g transform="translate(4, 4)">
        {/* Sun rays */}
        <g opacity="0.85">
          <circle cx="28" cy="6" r="3" fill={accentYellow} />
          <circle cx="40" cy="12" r="2" fill={accentYellow} />
          <circle cx="16" cy="12" r="2" fill={accentYellow} />
          <circle cx="44" cy="22" r="2" fill={accentYellow} />
          <circle cx="12" cy="22" r="2" fill={accentYellow} />
        </g>

        {/* Tree layers */}
        <path
          d="M28 6 L38 22 L33 22 L42 34 L35 34 L42 48 L14 48 L21 34 L14 34 L23 22 L18 22 Z"
          fill={primaryGreen}
        />

        {/* Trunk */}
        <rect x="23" y="46" width="10" height="10" rx="2" fill={warmOrange} />

        {/* Heart */}
        <path
          d="M28 30 C25 27, 21 28.5, 21 32 C21 35, 28 40, 28 40 C28 40, 35 35, 35 32 C35 28.5, 31 27, 28 30"
          fill={accentYellow}
          opacity="0.9"
        />
      </g>

      {/* Text: Atlanta */}
      <text
        x="68"
        y="32"
        fontFamily="var(--portal-font-heading, 'Nunito', sans-serif)"
        fontSize="22"
        fontWeight="800"
        fill={textColor}
        letterSpacing="-0.5"
      >
        Atlanta
      </text>

      {/* Text: Families */}
      <text
        x="68"
        y="54"
        fontFamily="var(--portal-font-heading, 'Nunito', sans-serif)"
        fontSize="22"
        fontWeight="700"
        fill={primaryGreen}
        letterSpacing="-0.5"
      >
        Families
      </text>
    </svg>
  );
}

/**
 * Alternative name options (exported for reference):
 *
 * 1. "Atlanta Families" - Current, straightforward
 * 2. "Little Lost City" - Playful connection to parent brand
 * 3. "ATL Explorers" - Adventure-focused
 * 4. "Family ATL" - Concise
 * 5. "Together ATL" - Community-focused
 * 6. "ATL Family Adventures" - Emphasizes discovery
 */
