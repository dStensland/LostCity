import { PortalHeader } from "@/components/headers";
import BestOfLeaderboard from "@/components/best-of/BestOfLeaderboard";

export const revalidate = 60;

type Props = {
  params: Promise<{ portal: string; slug: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const title = slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return {
    title: `${title} | Best Of | Lost City`,
    description: `Community-ranked leaderboard — ${title}`,
  };
}

export default async function BestOfLeaderboardPage({ params }: Props) {
  const { portal: portalSlug, slug } = await params;

  return (
    <div className="min-h-screen">
      <PortalHeader
        portalSlug={portalSlug}
        backLink={{ label: "Best Of", fallbackHref: `/${portalSlug}?view=community&tab=bestof` }}
        hideNav
      />

      <div className="max-w-3xl mx-auto px-4 py-6 pb-28">
        <BestOfLeaderboard categorySlug={slug} portalSlug={portalSlug} />
      </div>
    </div>
  );
}
