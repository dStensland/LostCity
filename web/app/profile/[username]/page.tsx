import { notFound } from "next/navigation";
import UnifiedHeader from "@/components/UnifiedHeader";
import PageFooter from "@/components/PageFooter";
import { ProfileView } from "@/components/profile/ProfileView";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { AnySupabase } from "@/lib/api-utils";
import type { PublicProfile } from "@/lib/types/profile";
import { getProfileLabel } from "@/lib/profile-utils";

type Props = {
  params: Promise<{ username: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { username } = await params;

  try {
    const serviceClient = createServiceClient() as unknown as AnySupabase;
    const { data } = await serviceClient.rpc("get_public_profile", {
      p_username: username,
      p_viewer_id: null,
    });

    if (!data) {
      return { title: "Profile Not Found | Lost City" };
    }

    const profile = data as PublicProfile;
    const label = getProfileLabel(profile);

    return {
      title: `${label} | Lost City`,
      description: profile.bio ?? `@${username} on Lost City`,
    };
  } catch {
    return { title: "Profile Not Found | Lost City" };
  }
}

export default async function ProfilePage({ params }: Props) {
  const { username } = await params;

  // Get current viewer ID — null for unauthenticated visitors
  const supabase = await createClient();
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  // Call the privacy-gated RPC via service client (bypasses RLS; RPC handles gating itself)
  const serviceClient = createServiceClient() as unknown as AnySupabase;
  const { data, error } = await serviceClient.rpc("get_public_profile", {
    p_username: username,
    p_viewer_id: currentUser?.id ?? null,
  });

  if (error || !data) {
    notFound();
  }

  const profile = data as PublicProfile;

  // Default portal slug for the standalone /profile route
  const portalSlug = "atlanta";

  return (
    <div className="min-h-screen bg-[var(--void)]">
      <UnifiedHeader />
      <ProfileView profile={profile} portalSlug={portalSlug} />
      <PageFooter />
    </div>
  );
}
