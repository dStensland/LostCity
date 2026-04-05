import { notFound } from "next/navigation";
import PortalGroupsClient from "@/components/channels/PortalGroupsClient";
import { getInterestChannelPresentation } from "@/lib/interest-channel-presentation";
import { resolveCommunityPageRequest } from "../_surfaces/community/resolve-community-page-request";

export const revalidate = 180;

type Props = {
  params: Promise<{ portal: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { portal: slug } = await params;
  const request = await resolveCommunityPageRequest({
    portalSlug: slug,
    pathname: `/${slug}/groups`,
  });
  const portal = request?.portal ?? null;

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
  const { portal: pathSlug } = await params;
  const request = await resolveCommunityPageRequest({
    portalSlug: pathSlug,
    pathname: `/${pathSlug}/groups`,
  });
  const portal = request?.portal ?? null;
  if (!portal) notFound();
  // Use the canonical portal slug (e.g. "helpatl") for child components, not the URL path segment.
  const portalSlug = portal.slug;

  const presentation = getInterestChannelPresentation(portal);
  const channelsLabel = presentation.channelsLabel;
  const groupsPageTitle = presentation.groupsPageTitle;
  const groupsDescription = typeof portal.settings.groups_page_description === "string"
    ? portal.settings.groups_page_description
    : "Follow city, county, school board, and topic groups to keep the feed aligned with what you care about.";

  return (
    <div className="min-h-screen">
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
    </div>
  );
}
