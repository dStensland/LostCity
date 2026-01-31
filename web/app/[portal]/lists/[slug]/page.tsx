import { Suspense } from "react";
import UnifiedHeader from "@/components/UnifiedHeader";
import PortalFooter from "@/components/PortalFooter";
import ListDetailView from "@/components/community/ListDetailView";

export const dynamic = "force-dynamic";

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
      <UnifiedHeader portalSlug={portalSlug} />

      <div className="max-w-3xl mx-auto px-4 py-6 pb-28">
        <Suspense
          fallback={
            <div className="space-y-6">
              {/* Header skeleton */}
              <div className="space-y-4">
                <div className="h-6 w-24 skeleton-shimmer rounded" />
                <div className="h-10 w-3/4 skeleton-shimmer rounded" />
                <div className="h-4 w-1/2 skeleton-shimmer rounded" />
                <div className="flex gap-3 mt-4">
                  <div className="h-10 w-24 skeleton-shimmer rounded-lg" />
                  <div className="h-10 w-24 skeleton-shimmer rounded-lg" />
                </div>
              </div>
              {/* Items skeleton */}
              <div className="space-y-3 mt-8">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="p-4 rounded-xl border border-[var(--twilight)] bg-[var(--card-bg)]">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 skeleton-shimmer rounded-lg" />
                      <div className="w-14 h-14 skeleton-shimmer rounded-lg" />
                      <div className="flex-1 space-y-2">
                        <div className="h-5 w-2/3 skeleton-shimmer rounded" />
                        <div className="h-4 w-1/2 skeleton-shimmer rounded" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          }
        >
          <ListDetailView portalSlug={portalSlug} listSlug={slug} />
        </Suspense>
      </div>

      <PortalFooter />
    </div>
  );
}
