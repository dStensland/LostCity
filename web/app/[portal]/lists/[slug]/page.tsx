import ListDetailView from "@/components/community/ListDetailView";
import { getCachedPortalBySlug } from "@/lib/portal";
import { createServiceClient } from "@/lib/supabase/service";
import type { Metadata } from "next";

// Revalidate every minute - community lists change infrequently
export const revalidate = 60;

type Props = {
  params: Promise<{ portal: string; slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { portal: portalSlug, slug } = await params;
  const portal = await getCachedPortalBySlug(portalSlug);
  const portalName = portal?.name || "Lost City";

  const supabase = createServiceClient();
  const { data: list } = await supabase
    .from("lists")
    .select("title, description, cover_image_url, category, item_count")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  if (!list) {
    return {
      title: `Curation | ${portalName}`,
      description: `Community-curated guide on ${portalName}`,
    };
  }

  const title = `${(list as { title: string }).title} | ${portalName}`;
  const listTitle = (list as { title: string }).title;
  const itemCount = (list as { item_count: number | null }).item_count;
  const rawDesc = (list as { description: string | null }).description;
  const description = rawDesc
    ? rawDesc.slice(0, 160)
    : `${listTitle} \u2014 a curated guide${itemCount ? ` with ${itemCount} picks` : ""}.`;
  const coverImage = (list as { cover_image_url: string | null }).cover_image_url;

  return {
    title,
    description,
    alternates: {
      canonical: `/${portalSlug}/lists/${slug}`,
    },
    openGraph: {
      title: listTitle,
      description,
      type: "website",
      ...(coverImage ? { images: [{ url: coverImage }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: listTitle,
      description,
    },
  };
}

export default async function ListDetailPage({ params }: Props) {
  const { portal: portalSlug, slug } = await params;

  return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto px-4 py-6 pb-28">
        <ListDetailView portalSlug={portalSlug} listSlug={slug} />
      </div>
    </div>
  );
}
