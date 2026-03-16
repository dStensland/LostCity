import CityPulseShell from "@/components/feed/CityPulseShell";
import CivicFeedShell from "@/components/feed/CivicFeedShell";
import ArtsFeedShell from "@/components/feed/ArtsFeedShell";
import { FamilyFeed } from "@/components/family";
import { AdventureFeed } from "@/components/adventure";
import type { Portal } from "@/lib/portal-context";
import { getPortalVertical } from "@/lib/portal";

interface DefaultTemplateProps {
  portal: Portal;
}

/**
 * Default template — dispatches to vertical-specific feed shells.
 *
 * Each vertical gets its own bespoke shell rather than a shared shell
 * with feature flags. This keeps each feed focused and maintainable.
 */
export async function DefaultTemplate({
  portal,
}: DefaultTemplateProps) {
  const vertical = getPortalVertical(portal);

  // Family portal — custom FamilyFeed shell
  if (vertical === "family" || portal.slug === "atlanta-families") {
    const isExclusive = portal.portal_type === "business" && !portal.parent_portal_id;
    return (
      <FamilyFeed
        portalId={portal.id}
        portalSlug={portal.slug}
        portalExclusive={isExclusive}
      />
    );
  }

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
    />
  );
}

export type { DefaultTemplateProps };
