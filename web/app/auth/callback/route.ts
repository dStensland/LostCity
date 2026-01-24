import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/types";

type ProfileInsert = Database["public"]["Tables"]["profiles"]["Insert"];
type PreferencesInsert = Database["public"]["Tables"]["user_preferences"]["Insert"];

// Sanitize API key - remove any whitespace, control chars, or URL encoding artifacts
function sanitizeKey(key: string | undefined): string | undefined {
  if (!key) return undefined;
  return key
    .trim()
    .replace(/[\s\n\r\t]/g, '')
    .replace(/%0A/gi, '')
    .replace(/%0D/gi, '')
    .replace(/[^\x20-\x7E]/g, '');
}

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
      process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
      sanitizeKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
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
        let username = emailUsername.slice(0, 25) || "user";
        let attempts = 0;
        let isUnique = false;
        const maxAttempts = 10;

        while (!isUnique && attempts < maxAttempts) {
          const checkUsername = attempts === 0 ? username : `${username.slice(0, 20)}${Math.floor(Math.random() * 10000)}`;
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

        // Guaranteed fallback: use user ID prefix if all random attempts failed
        if (!isUnique) {
          username = `user_${data.user.id.slice(0, 8)}`;
        }

        // Create profile with retry logic for race conditions
        let profileCreated = false;
        let profileAttempts = 0;

        while (!profileCreated && profileAttempts < 3) {
          const profileData: ProfileInsert = {
            id: data.user.id,
            username,
            display_name: data.user.user_metadata?.full_name || null,
            avatar_url: data.user.user_metadata?.avatar_url || null,
          };
          const { error: profileError } = await supabase
            .from("profiles")
            .insert(profileData as never);

          if (!profileError) {
            profileCreated = true;
          } else if (profileError.code === "23505") {
            // Unique constraint violation - use ID-based username
            profileAttempts++;
            username = `user_${data.user.id.slice(0, 8)}_${profileAttempts}`;
          } else {
            console.error("Profile creation error:", profileError);
            return NextResponse.redirect(`${origin}/auth/login?error=profile_failed`);
          }
        }

        if (!profileCreated) {
          console.error("Failed to create profile after max attempts");
          return NextResponse.redirect(`${origin}/auth/login?error=profile_failed`);
        }

        // Create default preferences with error handling
        try {
          const prefsData: PreferencesInsert = {
            user_id: data.user.id,
          };
          const { error: prefsError } = await supabase
            .from("user_preferences")
            .insert(prefsData as never);

          if (prefsError) {
            // Log but don't block signup - preferences can be created later
            console.error("Preferences creation error:", prefsError);
          }
        } catch (err) {
          // Log but don't block signup - preferences can be created later
          console.error("Preferences creation exception:", err);
        }

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
