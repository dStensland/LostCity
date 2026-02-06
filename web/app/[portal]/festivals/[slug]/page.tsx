import { notFound } from "next/navigation";
import UnifiedHeader from "@/components/UnifiedHeader";
import PortalFooter from "@/components/PortalFooter";
import FestivalDetailPageClient from "@/components/views/FestivalDetailPageClient";
import { getCachedPortalBySlug } from "@/lib/portal";

export const revalidate = 300;

type Props = {
  params: Promise<{ portal: string; slug: string }>;
};

export default async function FestivalPage({ params }: Props) {
  const { portal: portalSlug, slug } = await params;
  const portal = await getCachedPortalBySlug(portalSlug);

  if (!portal) {
    notFound();
  }

  // Use the URL portal or fall back to the resolved portal record
  const activePortalSlug = portal.slug || portalSlug;
  const activePortalName = portal.name || portalSlug.charAt(0).toUpperCase() + portalSlug.slice(1);

  return (
    <>
      <UnifiedHeader portalSlug={activePortalSlug} portalName={activePortalName} />
      <main className="min-h-screen px-4 sm:px-6 lg:px-8 pt-6 pb-16">
        <div className="max-w-4xl mx-auto">
          <FestivalDetailPageClient portalSlug={activePortalSlug} slug={slug} />
        </div>
      </main>
      <PortalFooter />
    </>
  );
}
