import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { ProfileView } from "@/components/profile/ProfileView";
import type { PublicProfile } from "@/lib/types/profile";

export const revalidate = 0; // Profile pages are user-specific — no edge caching

type Props = {
  params: Promise<{ portal: string; username: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;

  // Lightweight lookup — just enough for the title tag
  const serviceClient = createServiceClient();
  const { data } = await serviceClient
    .from("profiles")
    .select("display_name, username")
    .eq("username", username)
    .maybeSingle();

  const profile = data as { display_name: string | null; username: string } | null;

  if (!profile) {
    return { title: "Profile Not Found | Lost City" };
  }

  const label = profile.display_name?.trim() || `@${profile.username}`;
  return {
    title: `${label} | Lost City`,
    robots: { index: false }, // User profiles should not be indexed
  };
}

export default async function PortalProfilePage({ params }: Props) {
  const { portal: portalSlug, username } = await params;

  // Get current viewer (optional — page works for anonymous visitors)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch the privacy-filtered profile via the SECURITY DEFINER RPC.
  // Using service client so the RPC can resolve blocked/friend relationships
  // without depending on the viewer's RLS context.
  const serviceClient = createServiceClient();
  const { data: profileData, error } = await serviceClient.rpc("get_public_profile", {
    p_username: username,
    p_viewer_id: user?.id ?? null,
  } as never);

  if (error) {
    console.error("[portal/profile] get_public_profile error:", error.message);
    notFound();
  }

  // RPC returns null when the profile doesn't exist or the viewer is blocked
  if (!profileData) {
    notFound();
  }

  const profile = profileData as unknown as PublicProfile;

  return (
    <ProfileView
      profile={profile}
      portalSlug={portalSlug}
    />
  );
}
