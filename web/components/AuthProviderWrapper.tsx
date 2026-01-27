import { AuthProvider } from "@/lib/auth-context";
import { getSession, createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/auth-context";

export default async function AuthProviderWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  // Pre-fetch profile on server - this will be null for non-auth pages
  // but hydrates instantly for authenticated users
  let initialProfile: Profile | null = null;

  try {
    // Use getSession (fast, from cookies) instead of getUser (network call)
    const session = await getSession();
    if (session?.user) {
      const supabase = await createClient();
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .maybeSingle();

      if (profileData) {
        initialProfile = profileData as Profile;
      }
    }
  } catch {
    // Silently fail - profile will be fetched client-side
  }

  return <AuthProvider initialProfile={initialProfile}>{children}</AuthProvider>;
}
