/**
 * Presearch content is STATIC and CURATED-ONCE. Any change requires a PR
 * reviewed by the search working group. See spec §5.3 — "presearch is not
 * a recommendations slot."
 */

export interface PresearchPill {
  label: string;
  href: string;
}

export interface PresearchConfig {
  quickIntents: PresearchPill[];
  categories: PresearchPill[];
  neighborhoods: PresearchPill[];
}

const ATLANTA: PresearchConfig = {
  quickIntents: [
    { label: "Tonight", href: "/atlanta/explore?lane=events&date=today" },
    { label: "Free", href: "/atlanta/explore?lane=events&free=true" },
    { label: "This Weekend", href: "/atlanta/explore?lane=events&date=weekend" },
    { label: "Brunch", href: "/atlanta/explore?lane=events&categories=food_drink" },
    { label: "Live Music", href: "/atlanta/explore?lane=shows&tab=music" },
    { label: "Outdoor", href: "/atlanta/explore?lane=events&tags=outdoor" },
    { label: "Family", href: "/atlanta/explore?lane=events&categories=family" },
    { label: "Art", href: "/atlanta/explore?lane=events&categories=art" },
  ],
  categories: [
    { label: "Music", href: "/atlanta/explore?lane=events&categories=music" },
    { label: "Comedy", href: "/atlanta/explore?lane=events&categories=comedy" },
    { label: "Food", href: "/atlanta/explore?lane=events&categories=food_drink" },
    { label: "Art", href: "/atlanta/explore?lane=events&categories=art" },
    { label: "Nightlife", href: "/atlanta/explore?lane=events&categories=nightlife" },
    { label: "Sports", href: "/atlanta/explore?lane=game-day" },
    { label: "Film", href: "/atlanta/explore?lane=shows&tab=film" },
    { label: "Family", href: "/atlanta/explore?lane=events&categories=family" },
  ],
  neighborhoods: [
    { label: "Ponce City", href: "/atlanta/explore?lane=events&neighborhoods=ponce-city-market" },
    { label: "Beltline", href: "/atlanta/explore?lane=events&neighborhoods=beltline" },
    { label: "Cabbagetown", href: "/atlanta/explore?lane=events&neighborhoods=cabbagetown" },
    { label: "Old Fourth Ward", href: "/atlanta/explore?lane=events&neighborhoods=old-fourth-ward" },
    { label: "West End", href: "/atlanta/explore?lane=events&neighborhoods=west-end" },
    { label: "Decatur", href: "/atlanta/explore?lane=events&neighborhoods=decatur" },
  ],
};

const PORTAL_CONFIGS: Record<string, PresearchConfig> = {
  atlanta: ATLANTA,
};

const EMPTY_CONFIG: PresearchConfig = {
  quickIntents: [],
  categories: [],
  neighborhoods: [],
};

export function getPresearchConfig(portalSlug: string): PresearchConfig {
  return PORTAL_CONFIGS[portalSlug] ?? EMPTY_CONFIG;
}
