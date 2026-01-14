import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/types";

type ProfileInsert = Database["public"]["Tables"]["profiles"]["Insert"];
type PreferencesInsert = Database["public"]["Tables"]["user_preferences"]["Insert"];

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const redirect = requestUrl.searchParams.get("redirect") || "/";
  const isNewUser = requestUrl.searchParams.get("new") === "true";
  const origin = requestUrl.origin;

  if (code) {
    const supabase = await createClient();
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
