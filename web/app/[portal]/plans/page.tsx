import { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PlansPageClient } from "./PlansPageClient";

export const metadata: Metadata = { title: "Plans" };

export default async function PlansPage({
  params,
}: {
  params: Promise<{ portal: string }>;
}) {
  const { portal: portalSlug } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <PlansPageClient
      portalSlug={portalSlug}
      isAuthenticated={!!user}
    />
  );
}
