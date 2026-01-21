import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/types";

type ProfileInsert = Database["public"]["Tables"]["profiles"]["Insert"];
type PreferencesInsert = Database["public"]["Tables"]["user_preferences"]["Insert"];

// Validate redirect URL to prevent Open Redirect attacks
function isValidRedirect(redirect: string): boolean {
  // Only allow relative URLs starting with / (not //)
  return redirect.startsWith("/") && !redirect.startsWith("//") && !redirect.includes(":");
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const rawRedirect = requestUrl.searchParams.get("redirect") || "/";
  // Validate redirect to prevent Open Redirect vulnerability
  const redirect = isValidRedirect(rawRedirect) ? rawRedirect : "/";
  const isNewUser = requestUrl.searchParams.get("new") === "true";
  const origin = requestUrl.origin;

  if (code) {
    const cookieStore = await cookies();

    // Create Supabase client with cookie handling for auth callback
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("Auth callback error:", error);
      return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`);
    }

    if (data.user) {
      // Check if profile exists
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", data.user.id)
        .single();

      // If no profile exists, create one for OAuth users
      if (!profile) {
        // Generate a username from email or user metadata
        const email = data.user.email || "";
        const emailUsername = email.split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "");

        // Make sure username is unique by appending random suffix if needed
        let username = emailUsername.slice(0, 25);
        let attempts = 0;
        let isUnique = false;

        while (!isUnique && attempts < 10) {
          const checkUsername = attempts === 0 ? username : `${username}${Math.floor(Math.random() * 1000)}`;
          const { data: existing } = await supabase
            .from("profiles")
            .select("id")
            .eq("username", checkUsername)
            .single();

          if (!existing) {
            username = checkUsername;
            isUnique = true;
          }
          attempts++;
        }

        // Create profile
        const profileData: ProfileInsert = {
          id: data.user.id,
          username,
          display_name: data.user.user_metadata?.full_name || null,
          avatar_url: data.user.user_metadata?.avatar_url || null,
        };
        const { error: profileError } = await supabase
          .from("profiles")
          .insert(profileData as never);

        if (profileError) {
          console.error("Profile creation error:", profileError);
        }

        // Create default preferences
        const prefsData: PreferencesInsert = {
          user_id: data.user.id,
        };
        await supabase.from("user_preferences").insert(prefsData as never);

        // Redirect new OAuth users to set preferences
        if (isNewUser) {
          return NextResponse.redirect(`${origin}/settings/preferences?welcome=true`);
        }
      }
    }
  }

  // Redirect to the specified path or home
  return NextResponse.redirect(`${origin}${redirect}`);
}
