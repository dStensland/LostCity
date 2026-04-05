import CurationsDiscoveryView from "@/components/community/CurationsDiscoveryView";
import { resolveCommunityPageRequest } from "../_surfaces/community/resolve-community-page-request";

export const revalidate = 180;

type Props = {
  params: Promise<{ portal: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { portal: portalSlug } = await params;
  const request = await resolveCommunityPageRequest({
    portalSlug,
    pathname: `/${portalSlug}/curations`,
  });
  const portalName = request?.portal.name || portalSlug.charAt(0).toUpperCase() + portalSlug.slice(1);
  return {
    title: `Curations | ${portalName} | Lost City`,
    description: `Browse community-curated guides on Lost City`,
  };
}

export default async function CurationsPage({ params }: Props) {
  const { portal: portalSlug } = await params;
  const request = await resolveCommunityPageRequest({
    portalSlug,
    pathname: `/${portalSlug}/curations`,
  });

  const portalId = request?.portal.id || "";
  const activePortalSlug = request?.portal.slug || portalSlug;

  return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto px-4 py-6 pb-28">
        <CurationsDiscoveryView portalId={portalId} portalSlug={activePortalSlug} />
      </div>
    </div>
  );
}
