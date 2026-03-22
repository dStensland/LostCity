"use client";

import { memo } from "react";
import Link from "next/link";
import SmartImage from "@/components/SmartImage";

// ---- Palette (Afternoon Field) -------------------------------------------
const CARD = "#FAFAF6";
const SAGE = "#5E7A5E";
const AMBER = "#C48B1D";
const TEXT = "#1E2820";
const MUTED = "#756E63";
const BORDER = "#E0DDD4";

const FONT_HEADING = "var(--font-plus-jakarta-sans, system-ui, sans-serif)";
const FONT_BODY = "var(--font-dm-sans, system-ui, sans-serif)";

// ---- Types ----------------------------------------------------------------

export interface FamilyDestination {
  id: number;
  name: string;
  slug: string | null;
  address: string | null;
  neighborhood: string | null;
  image_url: string | null;
  venue_type: string | null;
  indoor_outdoor: string | null;
  description: string | null;
  editorial_mention_count: number;
  upcoming_event_count: number;
  occasions: string[];
  library_pass_eligible: boolean;
}

export interface FamilyDestinationCardProps {
  destination: FamilyDestination;
  portalSlug: string;
  /** Width mode: "carousel" (flex-shrink-0 ~260px) or "full" (100%) */
  layout?: "carousel" | "full";
}

// ---- Helpers --------------------------------------------------------------

const VENUE_TYPE_LABELS: Record<string, string> = {
  museum: "Museum",
  zoo: "Zoo",
  aquarium: "Aquarium",
  theme_park: "Theme Park",
  park: "Park",
  garden: "Garden",
  nature_preserve: "Nature Preserve",
  playground: "Playground",
  farm: "Farm",
  recreation_center: "Rec Center",
  bowling: "Bowling",
  arcade: "Arcade",
  trampoline_park: "Trampoline Park",
  indoor_play: "Indoor Play",
  library: "Library",
  swimming_pool: "Pool",
  botanical_garden: "Botanical Garden",
};

const VENUE_TYPE_FALLBACK_COLORS: Record<string, string> = {
  museum: "#8B7355",
  zoo: "#5E7A5E",
  aquarium: "#78B7D0",
  theme_park: "#C48B1D",
  park: "#6B8E5E",
  garden: "#7A9E7A",
  nature_preserve: "#4A7A4A",
  playground: "#C48B1D",
  farm: "#8B6914",
  recreation_center: "#5E7A5E",
  bowling: "#756E63",
  arcade: "#C48B1D",
  trampoline_park: "#C48B1D",
  indoor_play: "#78B7D0",
  library: "#8B7355",
  swimming_pool: "#78B7D0",
  botanical_garden: "#5E7A5E",
};

function VenueImageFallback({
  venueType,
  fallbackColor,
}: {
  venueType: string | null;
  fallbackColor: string;
}) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: `linear-gradient(135deg, ${fallbackColor}55 0%, ${fallbackColor}22 100%)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <span style={{ fontSize: 36, opacity: 0.4 }}>
        {typeEmojiFor(venueType)}
      </span>
    </div>
  );
}

function IndoorOutdoorBadge({ indoor_outdoor, venue_type }: { indoor_outdoor: string | null; venue_type: string | null }) {
  // Derive if not explicit
  let label: string | null = null;
  let bgColor = SAGE;

  if (indoor_outdoor === "indoor") {
    label = "Indoor";
    bgColor = "#78B7D0";
  } else if (indoor_outdoor === "outdoor") {
    label = "Outdoor";
    bgColor = SAGE;
  } else if (indoor_outdoor === "both") {
    label = "In & Out";
    bgColor = AMBER;
  } else if (venue_type) {
    // Infer
    const INDOOR = new Set(["museum", "bowling", "arcade", "trampoline_park", "indoor_play", "library", "aquarium"]);
    const OUTDOOR = new Set(["park", "garden", "nature_preserve", "playground", "farm", "swimming_pool", "botanical_garden"]);
    if (INDOOR.has(venue_type)) { label = "Indoor"; bgColor = "#78B7D0"; }
    else if (OUTDOOR.has(venue_type)) { label = "Outdoor"; bgColor = SAGE; }
    else { label = "In & Out"; bgColor = AMBER; }
  }

  if (!label) return null;

  return (
    <span
      style={{
        display: "inline-block",
        backgroundColor: bgColor,
        color: "#fff",
        fontFamily: FONT_BODY,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.6px",
        textTransform: "uppercase",
        padding: "3px 7px",
        borderRadius: 4,
        flexShrink: 0,
      }}
    >
      {label}
    </span>
  );
}

// ---- Component ------------------------------------------------------------

export const FamilyDestinationCard = memo(function FamilyDestinationCard({
  destination,
  portalSlug,
  layout = "carousel",
}: FamilyDestinationCardProps) {
  const {
    name,
    slug,
    neighborhood,
    image_url,
    venue_type,
    indoor_outdoor,
    description,
    editorial_mention_count,
    upcoming_event_count,
    library_pass_eligible,
  } = destination;

  const href = slug ? `/${portalSlug}/spots/${slug}` : `/${portalSlug}?view=places`;
  const typeLabel = venue_type ? (VENUE_TYPE_LABELS[venue_type] ?? null) : null;

  // Fallback gradient color based on venue type
  const fallbackColor = venue_type ? (VENUE_TYPE_FALLBACK_COLORS[venue_type] ?? SAGE) : SAGE;

  const containerStyle: React.CSSProperties =
    layout === "carousel"
      ? {
          width: 260,
          flexShrink: 0,
          borderRadius: 14,
          backgroundColor: CARD,
          border: `1px solid ${BORDER}`,
          overflow: "hidden",
          boxShadow: "0 1px 6px rgba(30,40,32,0.07)",
          display: "flex",
          flexDirection: "column",
        }
      : {
          width: "100%",
          borderRadius: 14,
          backgroundColor: CARD,
          border: `1px solid ${BORDER}`,
          overflow: "hidden",
          boxShadow: "0 1px 6px rgba(30,40,32,0.07)",
          display: "flex",
          flexDirection: "column",
        };

  return (
    <div style={containerStyle}>
      {/* Image / fallback gradient */}
      <Link href={href} style={{ display: "block", position: "relative", height: 130, flexShrink: 0 }}>
        {image_url ? (
          <SmartImage
            src={image_url}
            alt={name}
            fill
            sizes="(max-width: 640px) 280px, 260px"
            style={{ objectFit: "cover" }}
            fallback={<VenueImageFallback venueType={venue_type} fallbackColor={fallbackColor} />}
          />
        ) : (
          <VenueImageFallback venueType={venue_type} fallbackColor={fallbackColor} />
        )}

        {/* Indoor/outdoor badge — top left */}
        <div style={{ position: "absolute", top: 8, left: 8 }}>
          <IndoorOutdoorBadge indoor_outdoor={indoor_outdoor} venue_type={venue_type} />
        </div>

        {/* Library pass badge — top right */}
        {library_pass_eligible && (
          <div style={{ position: "absolute", top: 8, right: 8 }}>
            <span
              style={{
                display: "inline-block",
                backgroundColor: AMBER,
                color: "#fff",
                fontFamily: FONT_BODY,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.4px",
                textTransform: "uppercase",
                padding: "3px 7px",
                borderRadius: 4,
              }}
            >
              Library Card
            </span>
          </div>
        )}
      </Link>

      {/* Card body */}
      <div style={{ padding: "10px 12px 12px", flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
        {/* Type label + neighborhood */}
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          {typeLabel && (
            <span
              style={{
                fontFamily: FONT_BODY,
                fontSize: 10,
                fontWeight: 600,
                color: SAGE,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              {typeLabel}
            </span>
          )}
          {typeLabel && neighborhood && (
            <span style={{ color: BORDER, fontSize: 10 }}>·</span>
          )}
          {neighborhood && (
            <span
              style={{
                fontFamily: FONT_BODY,
                fontSize: 10,
                color: MUTED,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {neighborhood}
            </span>
          )}
        </div>

        {/* Name */}
        <Link
          href={href}
          style={{
            fontFamily: FONT_HEADING,
            fontSize: 14,
            fontWeight: 700,
            color: TEXT,
            lineHeight: 1.3,
            textDecoration: "none",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {name}
        </Link>

        {/* Description — only show if no neighborhood and name is short enough */}
        {description && (
          <p
            style={{
              fontFamily: FONT_BODY,
              fontSize: 11,
              color: MUTED,
              lineHeight: 1.4,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              marginTop: 1,
            }}
          >
            {description}
          </p>
        )}

        {/* Footer: event count + editorial signal */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: "auto", paddingTop: 6 }}>
          {upcoming_event_count > 0 && (
            <span
              style={{
                fontFamily: FONT_BODY,
                fontSize: 10,
                fontWeight: 600,
                color: SAGE,
              }}
            >
              {upcoming_event_count} upcoming event{upcoming_event_count !== 1 ? "s" : ""}
            </span>
          )}
          {upcoming_event_count > 0 && editorial_mention_count > 0 && (
            <span style={{ color: BORDER, fontSize: 10 }}>·</span>
          )}
          {editorial_mention_count > 0 && (
            <span
              style={{
                fontFamily: FONT_BODY,
                fontSize: 10,
                color: MUTED,
                fontStyle: "italic",
              }}
            >
              In the press
            </span>
          )}
          {upcoming_event_count === 0 && editorial_mention_count === 0 && (
            <span
              style={{
                fontFamily: FONT_BODY,
                fontSize: 10,
                color: MUTED,
              }}
            >
              Open year-round
            </span>
          )}
        </div>
      </div>
    </div>
  );
});

function typeEmojiFor(venue_type: string | null): string {
  const MAP: Record<string, string> = {
    museum: "🏛️",
    zoo: "🦁",
    aquarium: "🐟",
    theme_park: "🎢",
    park: "🌳",
    garden: "🌸",
    nature_preserve: "🌿",
    playground: "🛝",
    farm: "🐄",
    recreation_center: "🏊",
    bowling: "🎳",
    arcade: "🕹️",
    trampoline_park: "🤸",
    indoor_play: "🎪",
    library: "📚",
    swimming_pool: "🏊",
    botanical_garden: "🌺",
  };
  return venue_type ? (MAP[venue_type] ?? "📍") : "📍";
}


