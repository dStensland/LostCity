"use client";

import type { PersonalizationInfo } from "@/lib/hooks/useForYouEvents";
import { Sparkle } from "@phosphor-icons/react/dist/ssr";

interface PersonalizedIndicatorProps {
  personalization: PersonalizationInfo | null;
  onToggle: () => void;
}

export default function PersonalizedIndicator({
  personalization,
  onToggle,
}: PersonalizedIndicatorProps) {
  if (!personalization) return null;

  const {
    followedVenueIds,
    followedOrgIds,
    favoriteNeighborhoods,
    favoriteCategories,
    isPersonalized,
  } = personalization;

  const hasPersonalization =
    followedVenueIds.length > 0 ||
    followedOrgIds.length > 0 ||
    favoriteNeighborhoods.length > 0 ||
    favoriteCategories.length > 0;

  if (!hasPersonalization) return null;

  return (
    <div className="flex items-center gap-2 px-1 py-2">
      {isPersonalized ? (
        <span className="inline-flex items-center gap-1.5 text-xs text-[var(--soft)]">
          <Sparkle size={12} weight="fill" className="text-[var(--coral)]" />
          Curated for you
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 text-xs text-[var(--muted)]">
          Showing all events
        </span>
      )}
      <button
        onClick={onToggle}
        className="text-[0.65rem] font-mono text-[var(--muted)] hover:text-[var(--cream)] transition-colors underline underline-offset-2 decoration-[var(--twilight)]"
      >
        {isPersonalized ? "Show all" : "Personalize"}
      </button>
    </div>
  );
}
