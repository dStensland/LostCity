import { PortalHeader } from "@/components/headers";
import ListDetailView from "@/components/community/ListDetailView";

// Revalidate every minute - community lists change infrequently
export const revalidate = 60;

type Props = {
  params: Promise<{ portal: string; slug: string }>;
};

export async function generateMetadata({ params }: Props) {
  // Could fetch list title here for better SEO using params.slug
  void params; // Mark as intentionally unused for now
  return {
    title: `List | Lost City`,
    description: `Community-curated list on Lost City`,
  };
}

export default async function ListDetailPage({ params }: Props) {
  const { portal: portalSlug, slug } = await params;

  return (
    <div className="min-h-screen">
      <PortalHeader portalSlug={portalSlug} backLink={{ label: "Back", fallbackHref: `/${portalSlug}` }} hideNav />

      <div className="max-w-3xl mx-auto px-4 py-6 pb-28">
        <ListDetailView portalSlug={portalSlug} listSlug={slug} />
      </div>
    </div>
  );
}
