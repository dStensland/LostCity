import BestOfCategoryGrid from "@/components/best-of/BestOfCategoryGrid";
import { resolveCommunityPageRequest } from "../_surfaces/community/resolve-community-page-request";

type Props = {
  params: Promise<{ portal: string }>;
};

export const revalidate = 180;

export async function generateMetadata({ params }: Props) {
  const { portal: portalSlug } = await params;
  const request = await resolveCommunityPageRequest({
    portalSlug,
    pathname: `/${portalSlug}/best-of`,
  });
  const portalName = request?.portal.name || portalSlug.charAt(0).toUpperCase() + portalSlug.slice(1);
  return {
    title: `Best Of ${portalName} | Lost City`,
    description: "Community-ranked leaderboards and local favorites.",
  };
}

export default function BestOfIndexPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 pb-24">
      <BestOfCategoryGrid />
    </div>
  );
}
