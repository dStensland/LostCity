"use client";

import Link from "next/link";
import { FamilyDestinationCard, type FamilyDestination } from "../FamilyDestinationCard";
import { FAMILY_TOKENS } from "@/lib/family-design-tokens";
import { SectionLabel, SeeAllLink } from "./_shared";

const SAGE = FAMILY_TOKENS.sage;
const BORDER = FAMILY_TOKENS.border;

// ---- PlacesToGoSection -----------------------------------------------------

export function PlacesToGoSection({
  destinations,
  isLoading,
  portalSlug,
  weatherContext,
  mobileEdgeBleed = false,
}: {
  destinations: FamilyDestination[] | undefined;
  isLoading: boolean;
  portalSlug: string;
  weatherContext?: "rainy" | "sunny" | null;
  /**
   * When true, applies negative horizontal margins so the carousel bleeds to
   * the screen edge on mobile (matching the original inline mobile layout).
   * Desktop layout uses false (default) so the carousel stays within the grid.
   */
  mobileEdgeBleed?: boolean;
}) {
  const labelText =
    weatherContext === "rainy"
      ? "Indoor Places to Go"
      : weatherContext === "sunny"
      ? "Get Outside Today"
      : "Places to Go";

  const has = (destinations?.length ?? 0) > 0;

  const scrollStyle: React.CSSProperties = mobileEdgeBleed
    ? {
        scrollbarWidth: "none",
        paddingBottom: 4,
        marginLeft: -16,
        paddingLeft: 16,
        marginRight: -16,
        paddingRight: 16,
      }
    : { scrollbarWidth: "none", paddingBottom: 4 };

  return (
    <section>
      <SectionLabel
        text={labelText}
        color={SAGE}
        rightSlot={<SeeAllLink href={`/${portalSlug}?view=find&type=destinations`} />}
      />
      {isLoading ? (
        <div className="flex gap-2.5 overflow-hidden">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex-shrink-0 rounded-2xl animate-pulse"
              style={{ width: 260, height: 200, backgroundColor: BORDER }}
            />
          ))}
        </div>
      ) : has ? (
        <div className="flex gap-3 overflow-x-auto" style={scrollStyle}>
          {destinations!.map((d) => (
            <FamilyDestinationCard
              key={d.id}
              destination={d}
              portalSlug={portalSlug}
              layout="carousel"
            />
          ))}
        </div>
      ) : (
        <Link
          href={`/${portalSlug}?view=find&type=destinations`}
          className="hover:opacity-70 transition-opacity"
          style={{ fontFamily: "var(--font-dm-sans, system-ui, sans-serif)", fontSize: 13, color: SAGE }}
        >
          Discover family-friendly spots nearby →
        </Link>
      )}
    </section>
  );
}
