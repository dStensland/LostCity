import { getCachedPortalBySlug, getPortalVertical } from "@/lib/portal";
import DetailViewRouter from "@/components/views/DetailViewRouter";
import DiningExperienceView from "../_components/hotel/forth/views/DiningExperienceView";
import { isForthVariantPortal } from "../_components/hotel/forth/server-utils";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

export const revalidate = 60;

type Props = {
  params: Promise<{ portal: string }>;
};

export default async function PortalDiningPage({ params }: Props) {
  const { portal: slug } = await params;
  const portal = await getCachedPortalBySlug(slug);

  if (!portal) {
    notFound();
  }

  const vertical = getPortalVertical(portal);
  if (vertical !== "hotel") {
    notFound();
  }

  if (!isForthVariantPortal(portal)) {
    redirect(`/${portal.slug}`);
  }

  return (
    <div className="min-h-screen overflow-x-hidden">
      <Suspense fallback={null}>
        <DetailViewRouter portalSlug={portal.slug}>
          <DiningExperienceView portal={portal} />
        </DetailViewRouter>
      </Suspense>
    </div>
  );
}
