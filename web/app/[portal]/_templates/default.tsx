import FeedShell from "@/components/feed/FeedShell";
import CuratedContent from "@/components/feed/CuratedContent";
import { FamilyFeed } from "@/components/family";
import type { Portal } from "@/lib/portal-context";

type FeedTab = "curated" | "foryou";

interface DefaultTemplateProps {
  portal: Portal;
  feedTab: FeedTab;
}

/**
 * Default template - standard feed layout used by most portals.
 * Supports both curated and personalized "for you" content.
 */
export async function DefaultTemplate({
  portal,
  feedTab,
}: DefaultTemplateProps) {
  const isExclusive = portal.portal_type === "business" && !portal.parent_portal_id;

  // Special case: atlanta-families uses custom FamilyFeed
  if (portal.slug === "atlanta-families") {
    return (
      <FamilyFeed
        portalId={portal.id}
        portalSlug={portal.slug}
        portalExclusive={isExclusive}
      />
    );
  }

  // Standard feed for all other portals
  return (
    <FeedShell
      portalId={portal.id}
      portalSlug={portal.slug}
      activeTab={feedTab}
      curatedContent={<CuratedContent portalSlug={portal.slug} />}
    />
  );
}

export type { DefaultTemplateProps };
