"use client";

import { memo } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import SmartImage from "@/components/SmartImage";
import type { LibraryPassData } from "@/lib/types/programs";

// ---- Afternoon Field palette -----------------------------------------------
const AMBER = "#C48B1D";
const AMBER_BG = "#C48B1D14";
const TEXT = "#1E2820";
const MUTED = "#756E63";
const CARD = "#FAFAF6";
const BORDER = "#E0DDD4";
const SAGE = "#5E7A5E";

const FONT_HEADING = "var(--font-plus-jakarta-sans, 'Plus Jakarta Sans', system-ui, sans-serif)";
const FONT_BODY = "var(--font-dm-sans, 'DM Sans', system-ui, sans-serif)";

// ---- Types ------------------------------------------------------------------

type LibraryPassVenue = {
  id: number;
  name: string;
  slug: string | null;
  place_type: string | null;
  neighborhood: string | null;
  image_url: string | null;
  short_description: string | null;
  library_pass: LibraryPassData;
};

// ---- Data fetch -------------------------------------------------------------

async function fetchLibraryPassVenues(): Promise<LibraryPassVenue[]> {
  const res = await fetch("/api/family/library-pass-venues");
  if (!res.ok) return [];
  const json = await res.json();
  return (json.venues as LibraryPassVenue[]) ?? [];
}

// ---- Venue card -------------------------------------------------------------

function LibraryPassVenueCard({
  venue,
  portalSlug,
}: {
  venue: LibraryPassVenue;
  portalSlug: string;
}) {
  const href = venue.slug ? `/${portalSlug}?spot=${venue.slug}` : null;

  const inner = (
    <div
      style={{
        backgroundColor: CARD,
        borderRadius: 12,
        border: `1px solid ${BORDER}`,
        overflow: "hidden",
        flexShrink: 0,
        width: 180,
        boxShadow: "0 1px 4px rgba(30,40,32,0.06)",
      }}
    >
      {/* Image */}
      <div style={{ position: "relative", width: "100%", height: 100, backgroundColor: AMBER_BG }}>
        {venue.image_url ? (
          <SmartImage
            src={venue.image_url}
            alt={venue.name}
            fill
            sizes="180px"
            style={{ objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 32,
            }}
            aria-hidden="true"
          >
            📚
          </div>
        )}
        {/* Benefit badge overlaid on image */}
        <div
          style={{
            position: "absolute",
            bottom: 6,
            left: 6,
            backgroundColor: "rgba(196,139,29,0.92)",
            borderRadius: 6,
            padding: "2px 7px",
          }}
        >
          <span
            style={{
              fontFamily: FONT_HEADING,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.4px",
              textTransform: "uppercase",
              color: "#fff",
            }}
          >
            Free w/ Library Card
          </span>
        </div>
      </div>

      {/* Text */}
      <div style={{ padding: "8px 10px 10px" }}>
        <p
          style={{
            fontFamily: FONT_HEADING,
            fontSize: 13,
            fontWeight: 700,
            color: TEXT,
            lineHeight: 1.25,
            marginBottom: 3,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {venue.name}
        </p>
        <p
          style={{
            fontFamily: FONT_BODY,
            fontSize: 11,
            color: MUTED,
            lineHeight: 1.35,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical" as const,
          }}
        >
          {venue.library_pass.benefit}
        </p>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} style={{ textDecoration: "none", flexShrink: 0 }}>
        {inner}
      </Link>
    );
  }
  return <div style={{ flexShrink: 0 }}>{inner}</div>;
}

// ---- Skeleton card ----------------------------------------------------------

function SkeletonVenueCard() {
  return (
    <div
      style={{
        backgroundColor: CARD,
        borderRadius: 12,
        border: `1px solid ${BORDER}`,
        overflow: "hidden",
        flexShrink: 0,
        width: 180,
      }}
    >
      <div style={{ height: 100, backgroundColor: BORDER, opacity: 0.5 }} />
      <div style={{ padding: "8px 10px 10px" }}>
        <div style={{ height: 12, backgroundColor: BORDER, borderRadius: 4, marginBottom: 6, width: "80%" }} />
        <div style={{ height: 10, backgroundColor: BORDER, borderRadius: 4, width: "60%" }} />
      </div>
    </div>
  );
}

// ---- Main component ---------------------------------------------------------

interface LibraryPassSectionProps {
  portalSlug: string;
}

export const LibraryPassSection = memo(function LibraryPassSection({
  portalSlug,
}: LibraryPassSectionProps) {
  const { data: venues = [], isLoading } = useQuery({
    queryKey: ["family-library-pass-venues"],
    queryFn: fetchLibraryPassVenues,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  // Don't render if loading finished with no results
  if (!isLoading && venues.length === 0) return null;

  return (
    <div style={{ paddingTop: 4 }}>
      {/* Section header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 20px",
          marginBottom: 10,
        }}
      >
        {/* Left: label + tip */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16, lineHeight: 1 }} aria-hidden="true">📚</span>
          <div>
            <p
              style={{
                fontFamily: FONT_HEADING,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.8px",
                textTransform: "uppercase",
                color: AMBER,
                margin: 0,
                lineHeight: 1,
              }}
            >
              Free with Library Card
            </p>
            <p
              style={{
                fontFamily: FONT_BODY,
                fontSize: 11,
                color: MUTED,
                margin: 0,
                marginTop: 2,
              }}
            >
              Show your library card, skip the admission fee
            </p>
          </div>
        </div>

        {/* Right: "How it works" link */}
        <a
          href="https://georgialibraries.org/passes/"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontFamily: FONT_BODY,
            fontSize: 12,
            color: SAGE,
            textDecoration: "none",
            flexShrink: 0,
          }}
        >
          How it works →
        </a>
      </div>

      {/* Horizontal scroll of venue cards */}
      <div
        style={{
          display: "flex",
          gap: 10,
          padding: "0 20px 4px",
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
        }}
        className="scrollbar-hide"
      >
        {isLoading ? (
          <>
            <SkeletonVenueCard />
            <SkeletonVenueCard />
            <SkeletonVenueCard />
          </>
        ) : (
          venues.map((venue) => (
            <LibraryPassVenueCard
              key={venue.id}
              venue={venue}
              portalSlug={portalSlug}
            />
          ))
        )}
      </div>

    </div>
  );
});

export type { LibraryPassSectionProps };
