"use client";

import { useMemo } from "react";
import { ShareNetwork, UserPlus } from "@phosphor-icons/react";
import { DetailLayout } from "@/components/detail/core/DetailLayout";
import { DetailLoadingSkeleton } from "@/components/detail/core/DetailLoadingSkeleton";
import { SeededDetailSkeleton } from "@/components/detail/core/SeededDetailSkeleton";
import type { OrgSeed } from "@/lib/detail/entity-preview-store";
import { OrgIdentity } from "@/components/detail/identity/OrgIdentity";
import { orgManifest } from "@/components/detail/manifests/org";
import { useDetailData } from "@/lib/detail/use-detail-data";
import { getCategoryColor } from "@/lib/category-config";
import type { OrgApiResponse, HeroConfig, ActionConfig, EntityData } from "@/lib/detail/types";

// ── Org type accent colors ────────────────────────────────────────────────────

const ORG_TYPE_COLORS: Record<string, string> = {
  arts_nonprofit: "#C4B5FD",
  film_society: "#A5B4FC",
  community_group: "#6EE7B7",
  running_club: "#5EEAD4",
  cultural_org: "#FBBF24",
  food_festival: "#FDBA74",
  venue: "#A78BFA",
  festival: "#F9A8D4",
};

// ── Props ────────────────────────────────────────────────────────────────────

interface OrgDetailViewProps {
  slug: string;
  portalSlug: string;
  onClose?: () => void;
  initialData?: OrgApiResponse;
  /** Partial card-published seed for fast first paint. */
  seedData?: OrgSeed;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function OrgDetailView({
  slug,
  portalSlug,
  onClose,
  initialData,
  seedData,
}: OrgDetailViewProps) {
  const { data, status } = useDetailData<OrgApiResponse>({
    entityType: "org",
    identifier: slug,
    portalSlug,
    initialData,
  });

  const organization = data?.organization ?? null;
  const events = useMemo(() => data?.events ?? [], [data]);

  const accentColor = useMemo(() => {
    if (!organization) return "var(--vibe)";
    // Prefer org type color; fall back to first category color
    const orgTypeColor = ORG_TYPE_COLORS[organization.org_type];
    if (orgTypeColor) return orgTypeColor;
    const firstCat = organization.categories?.[0];
    if (firstCat) return getCategoryColor(firstCat);
    return "var(--vibe)";
  }, [organization]);

  const heroConfig = useMemo<HeroConfig>(() => ({
    imageUrl: organization?.logo_url ?? null,
    aspectClass: "aspect-video lg:aspect-[16/10]",
    fallbackMode: "logo",
    galleryEnabled: false,
  }), [organization]);

  const actionConfig = useMemo<ActionConfig>(() => {
    const website = organization?.website ?? null;
    const primaryCTA: ActionConfig["primaryCTA"] = website
      ? { label: "Visit Website", href: website, variant: "outlined" }
      : null;

    return {
      primaryCTA,
      secondaryActions: [
        { icon: <UserPlus size={18} weight="duotone" />, label: "Follow" },
        { icon: <ShareNetwork size={18} weight="duotone" />, label: "Share" },
      ],
      stickyBar: { enabled: false },
    };
  }, [organization]);

  const entityData = useMemo<EntityData | null>(
    () => (data ? { entityType: "org", payload: data } : null),
    [data],
  );

  if (status === "loading" || !entityData || !organization) {
    if (seedData) return <SeededDetailSkeleton seed={seedData} />;
    return <DetailLoadingSkeleton />;
  }

  // NOTE: intentionally no shellVariant prop — orgs stay on the sidebar
  // shell for now. Elevated shell is events-only in this landing; org
  // elevation is not currently scoped.
  return (
    <DetailLayout
      heroConfig={heroConfig}
      identity={
        <OrgIdentity
          organization={organization}
          events={events}
          portalSlug={portalSlug}
        />
      }
      actionConfig={actionConfig}
      manifest={orgManifest}
      data={entityData}
      portalSlug={portalSlug}
      accentColor={accentColor}
      entityType="org"
      onClose={onClose}
    />
  );
}
