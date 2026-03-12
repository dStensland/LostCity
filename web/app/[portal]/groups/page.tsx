import { notFound } from "next/navigation";
import { PortalHeader } from "@/components/headers";
import { getCachedPortalBySlug, getPortalVertical } from "@/lib/portal";
import PortalGroupsClient from "@/components/channels/PortalGroupsClient";
import { CivicTabBar } from "@/components/civic/CivicTabBar";
import { Suspense } from "react";
import { getInterestChannelPresentation } from "@/lib/interest-channel-presentation";

export const revalidate = 60;

type Props = {
  params: Promise<{ portal: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { portal: slug } = await params;
  const portal = await getCachedPortalBySlug(slug);

  if (!portal) {
    return {
      title: "Groups | Lost City",
    };
  }

  const groupsMetaDescription = typeof portal.settings.groups_meta_description === "string"
    ? portal.settings.groups_meta_description
    : `Join civic and community groups in ${portal.name} to personalize your feed.`;

  return {
    title: `Groups | ${portal.name} | Lost City`,
    description: groupsMetaDescription,
  };
}

export default async function PortalGroupsPage({ params }: Props) {
  const { portal: portalSlug } = await params;
  const portal = await getCachedPortalBySlug(portalSlug);
  if (!portal) notFound();

  const presentation = getInterestChannelPresentation(portal);
  const channelsLabel = presentation.channelsLabel;
  const groupsPageTitle = presentation.groupsPageTitle;
  const groupsDescription = typeof portal.settings.groups_page_description === "string"
    ? portal.settings.groups_page_description
    : "Follow city, county, school board, and topic groups to keep the feed aligned with what you care about.";

  const vertical = getPortalVertical(portal);
  const isCommunity = vertical === "community";
  const actLabel =
    typeof portal.settings.nav_labels === "object" &&
    portal.settings.nav_labels !== null &&
    typeof (portal.settings.nav_labels as Record<string, unknown>).feed === "string"
      ? (portal.settings.nav_labels as Record<string, string>).feed
      : "Act";

  return (
    <div className="min-h-screen">
      <PortalHeader portalSlug={portalSlug} />

      <main className="max-w-5xl mx-auto px-4 py-6 pb-28 space-y-4">
        <header className="space-y-1">
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
            {channelsLabel}
          </p>
          <h1 className="text-2xl font-semibold text-[var(--cream)]">{groupsPageTitle}</h1>
          <p className="text-sm text-[var(--soft)] max-w-3xl">
            {groupsDescription}
          </p>
        </header>

        <PortalGroupsClient portalSlug={portalSlug} />
      </main>

      {isCommunity && (
        <>
          <Suspense fallback={null}>
            <CivicTabBar portalSlug={portalSlug} actLabel={actLabel} />
          </Suspense>
          <div className="h-14 sm:hidden" />
        </>
      )}
    </div>
  );
}
