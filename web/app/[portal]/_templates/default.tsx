import CityPulseShell from "@/components/feed/CityPulseShell";
import CivicFeedShell from "@/components/feed/CivicFeedShell";
import { FamilyFeed } from "@/components/family";
import type { Portal } from "@/lib/portal-context";

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
  const vertical = portal.settings?.vertical || "city";

  // Special case: atlanta-families uses custom FamilyFeed
  if (portal.slug === "atlanta-families") {
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

  return (
    <CityPulseShell
      portalSlug={portal.slug}
    />
  );
}

export type { DefaultTemplateProps };
