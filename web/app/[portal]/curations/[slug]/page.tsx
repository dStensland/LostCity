import { PortalHeader } from "@/components/headers";
import ListDetailView from "@/components/community/ListDetailView";

export const revalidate = 60;

type Props = {
  params: Promise<{ portal: string; slug: string }>;
};

export async function generateMetadata({ params }: Props) {
  void params;
  return {
    title: `Curation | Lost City`,
    description: `Community-curated guide on Lost City`,
  };
}

export default async function CurationDetailPage({ params }: Props) {
  const { portal: portalSlug, slug } = await params;

  return (
    <div className="min-h-screen">
      <PortalHeader portalSlug={portalSlug} backLink={{ label: "Back", fallbackHref: `/${portalSlug}/curations` }} hideNav />

      <div className="max-w-3xl mx-auto px-4 py-6 pb-28">
        <ListDetailView portalSlug={portalSlug} listSlug={slug} />
      </div>
    </div>
  );
}
