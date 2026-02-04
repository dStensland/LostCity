"use client";

import type { PersonalizationInfo } from "@/lib/hooks/useForYouEvents";

interface PersonalizedIndicatorProps {
  personalization: PersonalizationInfo | null;
  onToggle: () => void;
}

export default function PersonalizedIndicator({
  personalization,
  onToggle,
}: PersonalizedIndicatorProps) {
  if (!personalization) return null;

  const { followedVenueIds, followedOrgIds, favoriteNeighborhoods, favoriteCategories, isPersonalized } = personalization;

  // Count active personalization sources
  const venueCount = followedVenueIds.length;
  const orgCount = followedOrgIds.length;
  const neighborhoodCount = favoriteNeighborhoods.length;
  const categoryCount = favoriteCategories.length;

  // Check if user has any personalization
  const hasPersonalization = venueCount > 0 || orgCount > 0 || neighborhoodCount > 0 || categoryCount > 0;

  if (!hasPersonalization) return null;

  // Build description parts
  const parts: string[] = [];
  if (venueCount > 0) {
    parts.push(`${venueCount} venue${venueCount === 1 ? "" : "s"}`);
  }
  if (orgCount > 0) {
    parts.push(`${orgCount} org${orgCount === 1 ? "" : "s"}`);
  }
  if (neighborhoodCount > 0) {
    parts.push(`${neighborhoodCount} neighborhood${neighborhoodCount === 1 ? "" : "s"}`);
  }
  if (categoryCount > 0) {
    parts.push(`${categoryCount} categor${categoryCount === 1 ? "y" : "ies"}`);
  }

  // Format the parts into a readable string
  const description = parts.length === 1
    ? parts[0]
    : parts.length === 2
    ? `${parts[0]} & ${parts[1]}`
    : `${parts.slice(0, -1).join(", ")} & ${parts[parts.length - 1]}`;

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2 bg-[var(--twilight)]/50 border-b border-[var(--twilight)]">
      <div className="flex items-center gap-2 min-w-0">
        {isPersonalized ? (
          <>
            {/* Personalized icon */}
            <div className="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--coral)]/20 flex items-center justify-center">
              <svg
                className="w-3 h-3 text-[var(--coral)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <span className="text-xs text-[var(--soft)] truncate">
              Showing events from{" "}
              <span className="text-[var(--cream)] font-medium">{description}</span>
              {" "}you follow
            </span>
          </>
        ) : (
          <>
            {/* All events icon */}
            <div className="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--muted)]/20 flex items-center justify-center">
              <svg
                className="w-3 h-3 text-[var(--muted)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 10h16M4 14h16M4 18h16"
                />
              </svg>
            </div>
            <span className="text-xs text-[var(--soft)] truncate">
              Showing all events
            </span>
          </>
        )}
      </div>

      {/* Toggle button */}
      <button
        onClick={onToggle}
        className={`flex-shrink-0 px-2.5 py-1 rounded-full font-mono text-[0.65rem] font-medium transition-all ${
          isPersonalized
            ? "bg-[var(--coral)]/20 text-[var(--coral)] hover:bg-[var(--coral)]/30"
            : "bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--dusk)]"
        }`}
      >
        {isPersonalized ? "Show all" : "Personalize"}
      </button>
    </div>
  );
}
