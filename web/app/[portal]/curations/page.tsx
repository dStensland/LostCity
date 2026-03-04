import { PortalHeader } from "@/components/headers";
import CurationsDiscoveryView from "@/components/community/CurationsDiscoveryView";
import { createServiceClient } from "@/lib/supabase/service";
import type { AnySupabase } from "@/lib/api-utils";

export const revalidate = 60;

type Props = {
  params: Promise<{ portal: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { portal } = await params;
  return {
    title: `Curations | ${portal.charAt(0).toUpperCase() + portal.slice(1)} | Lost City`,
    description: `Browse community-curated guides on Lost City`,
  };
}

export default async function CurationsPage({ params }: Props) {
  const { portal: portalSlug } = await params;

  // Resolve portal_id for the discovery view
  const svc = createServiceClient() as AnySupabase;
  const { data: portal } = await svc
    .from("portals")
    .select("id")
    .eq("slug", portalSlug)
    .maybeSingle();

  const portalId = portal?.id || "";

  return (
    <div className="min-h-screen">
      <PortalHeader portalSlug={portalSlug} />

      <div className="max-w-3xl mx-auto px-4 py-6 pb-28">
        <CurationsDiscoveryView portalId={portalId} portalSlug={portalSlug} />
      </div>
    </div>
  );
}
