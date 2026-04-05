"use client";

import { memo, type ComponentType } from "react";
import Link from "next/link";
import { FAMILY_TOKENS } from "@/lib/family-design-tokens";
import { buildExploreUrl } from "@/lib/find-url";

// ---- Palette (Afternoon Field) -------------------------------------------
const SAGE = FAMILY_TOKENS.sage;
const AMBER = FAMILY_TOKENS.amber;
const TEXT = FAMILY_TOKENS.text;
const MUTED = FAMILY_TOKENS.textSecondary;
const BORDER = FAMILY_TOKENS.border;
const SKY = FAMILY_TOKENS.sky;
const BROWN = "#8B7355";
const LILAC = "#9B7FB8";
const FOREST = "#6B8E5E";

const FONT_HEADING = FAMILY_TOKENS.fontHeading;
const FONT_BODY = FAMILY_TOKENS.fontBody;

// ---- SVG Icons -------------------------------------------------------------

function MuseumIcon({ color }: { color: string }) {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
      {/* columns */}
      <rect x="4" y="11" width="3" height="10" rx="1" fill={color} />
      <rect x="11.5" y="11" width="3" height="10" rx="1" fill={color} />
      <rect x="19" y="11" width="3" height="10" rx="1" fill={color} />
      {/* pediment / roof */}
      <path d="M2 11L13 3L24 11H2Z" fill={color} opacity="0.85" />
      {/* base */}
      <rect x="2" y="21" width="22" height="2.5" rx="1" fill={color} />
    </svg>
  );
}

function TreeIcon({ color }: { color: string }) {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
      {/* canopy */}
      <ellipse cx="13" cy="10" rx="8" ry="7" fill={color} opacity="0.9" />
      {/* trunk */}
      <rect x="11" y="16" width="4" height="7" rx="1.5" fill={color} />
    </svg>
  );
}

function BowlingIcon({ color }: { color: string }) {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
      {/* bowling ball */}
      <circle cx="11" cy="15" r="8" fill={color} opacity="0.85" />
      <circle cx="8.5" cy="12.5" r="1.2" fill="white" opacity="0.7" />
      <circle cx="11" cy="11" r="1.2" fill="white" opacity="0.7" />
      <circle cx="13.5" cy="12.5" r="1.2" fill="white" opacity="0.7" />
      {/* pin */}
      <ellipse cx="21" cy="22" rx="2.5" ry="3" fill={color} />
      <ellipse cx="21" cy="17" rx="1.8" ry="2" fill={color} />
      <circle cx="21" cy="14.5" r="1.8" fill={color} />
    </svg>
  );
}

function PaletteIcon({ color }: { color: string }) {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
      {/* palette body */}
      <path
        d="M13 3C7.48 3 3 7.48 3 13c0 2.76 1.12 5.26 2.93 7.07C7.38 21.52 9.54 22 11 22c2 0 2-1.5 2-2 0-0.52 0.28-1 1-1h2c3.31 0 6-2.69 6-6C22 7.92 18.08 4 13 3Z"
        fill={color}
        opacity="0.85"
      />
      {/* color dots */}
      <circle cx="8" cy="13" r="1.5" fill="white" opacity="0.8" />
      <circle cx="10.5" cy="8.5" r="1.5" fill="white" opacity="0.8" />
      <circle cx="15" cy="8" r="1.5" fill="white" opacity="0.8" />
      <circle cx="18.5" cy="11.5" r="1.5" fill="white" opacity="0.8" />
    </svg>
  );
}

function PawIcon({ color }: { color: string }) {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
      {/* central pad */}
      <ellipse cx="13" cy="16" rx="5.5" ry="5" fill={color} opacity="0.85" />
      {/* toe beans */}
      <circle cx="7" cy="11" r="2.2" fill={color} />
      <circle cx="11" cy="8.5" r="2.2" fill={color} />
      <circle cx="15" cy="8.5" r="2.2" fill={color} />
      <circle cx="19" cy="11" r="2.2" fill={color} />
    </svg>
  );
}

function WaveIcon({ color }: { color: string }) {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
      {/* wave top */}
      <path
        d="M2 11C4.67 9 7.33 9 10 11C12.67 13 15.33 13 18 11C20.67 9 23.33 9 24 10"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.6"
      />
      {/* wave bottom */}
      <path
        d="M2 16C4.67 14 7.33 14 10 16C12.67 18 15.33 18 18 16C20.67 14 23.33 14 24 15"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      {/* water fill */}
      <path
        d="M2 17C4.67 15 7.33 15 10 17C12.67 19 15.33 19 18 17C20.67 15 23.33 15 24 16V24H2V17Z"
        fill={color}
        opacity="0.25"
      />
    </svg>
  );
}

// ---- Category config -------------------------------------------------------

interface DestinationCategory {
  key: string;
  label: string;
  icon: ComponentType<{ color: string }>;
  color: string;
  /** Background tint — very subtle, 5% of accent */
  bgTint: string;
  // Venue types this category encompasses — used to build the filter link
  venueTypes: string[];
}

const DESTINATION_CATEGORIES: DestinationCategory[] = [
  {
    key: "museums_science",
    label: "Museums & Science",
    icon: MuseumIcon,
    color: BROWN,
    bgTint: `${BROWN}0D`,
    venueTypes: ["museum"],
  },
  {
    key: "parks_nature",
    label: "Parks & Nature",
    icon: TreeIcon,
    color: SAGE,
    bgTint: `${SAGE}0D`,
    venueTypes: ["park", "garden", "nature_preserve", "botanical_garden", "farm"],
  },
  {
    key: "active_fun",
    label: "Active Fun",
    icon: BowlingIcon,
    color: AMBER,
    bgTint: `${AMBER}0D`,
    venueTypes: ["bowling", "arcade", "trampoline_park", "indoor_play", "playground", "recreation_center", "swimming_pool"],
  },
  {
    key: "arts_culture",
    label: "Arts & Culture",
    icon: PaletteIcon,
    color: LILAC,
    bgTint: `${LILAC}0D`,
    venueTypes: ["theater", "gallery", "museum", "studio", "performing_arts_center", "concert_hall", "cultural_center"],
  },
  {
    key: "animals_farms",
    label: "Animals & Farms",
    icon: PawIcon,
    color: FOREST,
    bgTint: `${FOREST}0D`,
    venueTypes: ["zoo", "aquarium", "farm"],
  },
  {
    key: "water_swimming",
    label: "Water & Swimming",
    icon: WaveIcon,
    color: SKY,
    bgTint: `${SKY}0D`,
    venueTypes: ["swimming_pool", "aquarium"],
  },
];

// ---- Component ------------------------------------------------------------

interface ExploreByTypeGridProps {
  portalSlug: string;
}

export const ExploreByTypeGrid = memo(function ExploreByTypeGrid({
  portalSlug,
}: ExploreByTypeGridProps) {
  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 8,
        }}
      >
        {DESTINATION_CATEGORIES.map((cat) => {
          // Build query link — filter by venue_type if we have types
          const href = buildExploreUrl({
            portalSlug,
            lane: "places",
            extraParams:
              cat.venueTypes.length > 0
                ? { venue_type: cat.venueTypes.join(",") }
                : undefined,
          });

          const IconComponent = cat.icon;
          return (
            <Link
              key={cat.key}
              href={href}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                backgroundColor: cat.bgTint,
                border: `1.5px solid ${cat.color}22`,
                borderRadius: 12,
                padding: "13px 8px 11px",
                textDecoration: "none",
                transition: "border-color 0.15s, box-shadow 0.15s",
                boxShadow: "0 1px 3px rgba(30,40,32,0.04)",
              }}
            >
              {/* SVG icon in a tinted circle */}
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: "50%",
                  backgroundColor: `${cat.color}18`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <IconComponent color={cat.color} />
              </div>

              {/* Label */}
              <p
                style={{
                  fontFamily: FONT_BODY,
                  fontSize: 11,
                  fontWeight: 600,
                  color: TEXT,
                  textAlign: "center",
                  lineHeight: 1.3,
                  margin: 0,
                }}
              >
                {cat.label}
              </p>
            </Link>
          );
        })}
      </div>

      {/* See all destinations link */}
      <div style={{ marginTop: 10, textAlign: "center" }}>
        <Link
          href={buildExploreUrl({ portalSlug, lane: "places" })}
          style={{
            fontFamily: FONT_BODY,
            fontSize: 12,
            color: SAGE,
            textDecoration: "none",
            fontWeight: 500,
          }}
        >
          See all destinations →
        </Link>
      </div>
    </div>
  );
});

export type { ExploreByTypeGridProps };

// ---- Also export the categories for use in other components ---------------
export { DESTINATION_CATEGORIES };
export type { DestinationCategory };

// Export palette constants for use elsewhere
export { MUTED, FONT_HEADING };
