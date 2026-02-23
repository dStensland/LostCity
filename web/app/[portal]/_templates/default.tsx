import CityPulseShell from "@/components/feed/CityPulseShell";
import { FamilyFeed } from "@/components/family";
import type { Portal } from "@/lib/portal-context";

interface DefaultTemplateProps {
  portal: Portal;
}

/**
 * Default template - CityPulse feed for all portals.
 */
export async function DefaultTemplate({
  portal,
}: DefaultTemplateProps) {
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

  return (
    <CityPulseShell
      portalSlug={portal.slug}
    />
  );
}

export type { DefaultTemplateProps };
