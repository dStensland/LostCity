"use client";

import FindSearchInput from "@/components/find/FindSearchInput";
import { useExploreUrlState } from "@/lib/explore-platform/url-state";

function formatPortalLabel(slug: string): string {
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

interface ExploreSearchHeroProps {
  portalSlug: string;
  portalId: string;
}

/**
 * Persistent search hero for the Explore surface.
 *
 * Rendered above both the Explore home body and the unified search results
 * so the input stays mounted across the home ↔ results transition. Unmounting
 * the input mid-type (which happens if the hero lives inside ExploreHomeScreen)
 * drops focus and makes the query appear to vanish as the user types.
 */
export function ExploreSearchHero({
  portalSlug,
  portalId,
}: ExploreSearchHeroProps) {
  const state = useExploreUrlState();
  const shouldFocusSearch = state.params.get("focus") === "search";

  return (
    <div className="rounded-[24px] border border-[var(--twilight)]/30 bg-[linear-gradient(140deg,rgba(10,14,24,0.96),rgba(14,19,30,0.82))] p-5">
      <p className="text-xs font-mono uppercase tracking-[0.14em] text-[var(--muted)]">
        Explore {formatPortalLabel(portalSlug)}
      </p>
      <h1 className="mt-2 text-2xl sm:text-3xl font-semibold tracking-[-0.03em] text-[var(--cream)]">
        Search events, places, and classes.
      </h1>
      <p className="mt-2 max-w-2xl text-sm sm:text-base text-[var(--soft)]">
        Start with search, or jump straight into a lane.
      </p>

      <div className="mt-5">
        <FindSearchInput
          portalSlug={portalSlug}
          portalId={portalId}
          basePath={`/${portalSlug}/explore`}
          placeholder="Search events, places, classes, teams..."
          autoFocus={shouldFocusSearch}
          queryParam="q"
          onSubmitQuery={(query) => state.setSearchQuery(query)}
        />
      </div>
    </div>
  );
}
