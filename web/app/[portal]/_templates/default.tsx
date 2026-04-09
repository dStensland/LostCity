import CityPulseShell from "@/components/feed/CityPulseShell";
import CivicFeedShell from "@/components/feed/CivicFeedShell";
import ArtsFeedShell from "@/components/feed/ArtsFeedShell";
import { AdventureFeed } from "@/components/adventure";
import type { Portal } from "@/lib/portal-context";
import { getPortalVertical } from "@/lib/portal";
import type { CityPulseResponse } from "@/lib/city-pulse/types";
import type { FeedEventData } from "@/components/EventCard";

interface DefaultTemplateProps {
  portal: Portal;
  /** Server-computed hero image URL for LCP preload optimization. */
  serverHeroUrl?: string;
  /**
   * Server-side pre-fetched city-pulse feed data.
   * Only used by the default city-portal path — not community/adventure/arts.
   */
  serverFeedData?: CityPulseResponse | null;
  /**
   * Server-side pre-fetched regulars data.
   * Seeds the React Query cache so RegularHangsSection renders without a client fetch.
   */
  serverRegularsData?: { events: FeedEventData[] } | null;
}

/**
 * Default template — dispatches to vertical-specific feed shells.
 *
 * Each vertical gets its own bespoke shell rather than a shared shell
 * with feature flags. This keeps each feed focused and maintainable.
 *
 * Note: family vertical is handled upstream in page.tsx and never reaches here.
 */
export async function DefaultTemplate({
  portal,
  serverHeroUrl,
  serverFeedData,
  serverRegularsData,
}: DefaultTemplateProps) {
  const vertical = getPortalVertical(portal);

  // Community/civic portals get a purpose-built civic feed
  if (vertical === "community") {
    return <CivicFeedShell portalSlug={portal.slug} />;
  }

  // Adventure portal — bespoke AdventureFeed shell with Nordic Brutalist design
  if (vertical === "adventure") {
    return (
      <AdventureFeed
        portalSlug={portal.slug}
      />
    );
  }

  // Arts portal — bespoke feed shell with exhibition-centric sections
  if (vertical === "arts") {
    return <ArtsFeedShell portalSlug={portal.slug} />;
  }

  return (
    <CityPulseShell
      portalSlug={portal.slug}
      serverHeroUrl={serverHeroUrl}
      serverFeedData={serverFeedData}
      serverRegularsData={serverRegularsData}
    />
  );
}

export type { DefaultTemplateProps };
