"use client";

interface LittleLostCityLogoProps {
  className?: string;
  variant?: "full" | "compact" | "icon";
}

/**
 * Little Lost City Logo
 *
 * A playful, child-friendly take on the Lost City brand.
 * Features stylized buildings with a whimsical feel.
 *
 * This alternative name creates brand continuity while
 * signaling the family-friendly nature of the portal.
 */
export default function LittleLostCityLogo({
  className = "",
  variant = "full"
}: LittleLostCityLogoProps) {
  // Colors from family_friendly palette
  const primaryGreen = "#059669";
  const secondaryTeal = "#0891b2";
  const accentYellow = "#fde047";
  const warmOrange = "#f59e0b";
  const textColor = "#1c1917";
  const softPink = "#fda4af";

  if (variant === "icon") {
    return (
      <svg
        viewBox="0 0 48 48"
        className={className}
        aria-label="Little Lost City"
      >
        {/* Playful buildings */}
        <rect x="6" y="24" width="10" height="20" rx="2" fill={primaryGreen} />
        <rect x="19" y="16" width="10" height="28" rx="2" fill={secondaryTeal} />
        <rect x="32" y="20" width="10" height="24" rx="2" fill={warmOrange} />

        {/* Windows - like eyes */}
        <circle cx="11" cy="30" r="2" fill={accentYellow} />
        <circle cx="24" cy="24" r="2" fill={accentYellow} />
        <circle cx="37" cy="28" r="2" fill={accentYellow} />

        {/* Rooftops with playful shapes */}
        <polygon points="11,24 6,24 16,24 11,18" fill={softPink} />
        <polygon points="24,16 19,16 29,16 24,10" fill={accentYellow} />
        <polygon points="37,20 32,20 42,20 37,14" fill={primaryGreen} />

        {/* Little sun */}
        <circle cx="40" cy="6" r="4" fill={accentYellow} />
      </svg>
    );
  }

  if (variant === "compact") {
    return (
      <svg
        viewBox="0 0 160 40"
        className={className}
        aria-label="Little Lost City"
      >
        {/* Mini buildings */}
        <g transform="translate(2, 8)">
          <rect x="0" y="14" width="7" height="14" rx="1" fill={primaryGreen} />
          <rect x="9" y="8" width="8" height="20" rx="1" fill={secondaryTeal} />
          <rect x="19" y="12" width="7" height="16" rx="1" fill={warmOrange} />
          <circle cx="3.5" cy="18" r="1.5" fill={accentYellow} />
          <circle cx="13" cy="14" r="1.5" fill={accentYellow} />
          <circle cx="22.5" cy="17" r="1.5" fill={accentYellow} />
        </g>

        {/* Text */}
        <text
          x="38"
          y="26"
          fontFamily="var(--portal-font-heading, 'Nunito', sans-serif)"
          fontSize="16"
          fontWeight="700"
          fill={textColor}
        >
          Little Lost City
        </text>
      </svg>
    );
  }

  // Full variant
  return (
    <svg
      viewBox="0 0 280 64"
      className={className}
      aria-label="Little Lost City"
    >
      {/* Buildings cluster */}
      <g transform="translate(4, 6)">
        {/* Sun with rays */}
        <circle cx="44" cy="8" r="6" fill={accentYellow} />
        <g opacity="0.6">
          <line x1="44" y1="0" x2="44" y2="4" stroke={accentYellow} strokeWidth="2" strokeLinecap="round" />
          <line x1="52" y1="8" x2="48" y2="8" stroke={accentYellow} strokeWidth="2" strokeLinecap="round" />
          <line x1="50" y1="2" x2="47" y2="5" stroke={accentYellow} strokeWidth="2" strokeLinecap="round" />
        </g>

        {/* Building 1 - Green */}
        <rect x="4" y="28" width="14" height="26" rx="2" fill={primaryGreen} />
        <polygon points="11,28 4,28 18,28 11,20" fill={softPink} />
        <circle cx="11" cy="36" r="3" fill={accentYellow} />
        <rect x="8" y="46" width="6" height="8" rx="1" fill={accentYellow} opacity="0.8" />

        {/* Building 2 - Teal (tallest) */}
        <rect x="20" y="18" width="16" height="36" rx="2" fill={secondaryTeal} />
        <polygon points="28,18 20,18 36,18 28,8" fill={accentYellow} />
        <circle cx="28" cy="28" r="3" fill={accentYellow} />
        <circle cx="28" cy="40" r="3" fill={accentYellow} />

        {/* Building 3 - Orange */}
        <rect x="38" y="24" width="14" height="30" rx="2" fill={warmOrange} />
        <polygon points="45,24 38,24 52,24 45,16" fill={primaryGreen} />
        <circle cx="45" cy="34" r="3" fill={accentYellow} />
        <rect x="42" y="46" width="6" height="8" rx="1" fill={accentYellow} opacity="0.8" />
      </g>

      {/* Text: Little */}
      <text
        x="72"
        y="28"
        fontFamily="var(--portal-font-heading, 'Nunito', sans-serif)"
        fontSize="18"
        fontWeight="600"
        fill={textColor}
        opacity="0.7"
        letterSpacing="-0.3"
      >
        Little
      </text>

      {/* Text: Lost City */}
      <text
        x="72"
        y="52"
        fontFamily="var(--portal-font-heading, 'Nunito', sans-serif)"
        fontSize="26"
        fontWeight="800"
        fill={textColor}
        letterSpacing="-0.5"
      >
        Lost City
      </text>

      {/* Decorative star */}
      <g transform="translate(200, 20)">
        <polygon
          points="8,0 10,6 16,6 11,10 13,16 8,12 3,16 5,10 0,6 6,6"
          fill={warmOrange}
          opacity="0.8"
        />
      </g>
    </svg>
  );
}
