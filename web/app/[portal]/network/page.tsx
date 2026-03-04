import { PortalHeader } from "@/components/headers";
import NetworkFeedPage from "@/components/feed/sections/NetworkFeedPage";

export const revalidate = 60;

type Props = {
  params: Promise<{ portal: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { portal } = await params;
  const name = portal.charAt(0).toUpperCase() + portal.slice(1);
  return {
    title: `The Network | ${name} | Lost City`,
    description: `Independent ${name} — curated articles from the city's indie publications and voices.`,
  };
}

export default async function NetworkPage({ params }: Props) {
  const { portal: portalSlug } = await params;

  return (
    <div className="min-h-screen">
      <PortalHeader
        portalSlug={portalSlug}
      />

      <div className="max-w-2xl mx-auto px-4 py-6 pb-28">
        <NetworkFeedPage portalSlug={portalSlug} />
      </div>
    </div>
  );
}
