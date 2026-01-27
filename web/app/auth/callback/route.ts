import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/types";
import { isValidRedirect } from "@/lib/auth-utils";

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

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const rawRedirect = requestUrl.searchParams.get("redirect") || "/";
  // Validate redirect to prevent Open Redirect vulnerability
  const redirect = isValidRedirect(rawRedirect) ? rawRedirect : "/";
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
      console.log("Auth callback - user authenticated:", data.user.id);

      // Check if profile exists - use maybeSingle() to avoid error when no rows
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profile, error: profileCheckError } = await (supabase as any)
        .from("profiles")
        .select("id")
        .eq("id", data.user.id)
        .maybeSingle();

      // If RLS recursion error (42P17), the profile might exist but we can't check
      // In that case, we'll try to create and handle the conflict
      const hasRlsError = profileCheckError?.code === "42P17";
      if (profileCheckError && !hasRlsError) {
        console.error("Profile check error:", profileCheckError);
      }

      console.log("Profile check result:", profile ? "exists" : "not found", hasRlsError ? "(RLS error - will try create)" : "");

      // If profile exists, redirect to home
      if (profile) {
        return NextResponse.redirect(`${origin}${redirect}`);
      }

      // If no profile exists (or RLS error), try to create one
      // Use username from metadata (email signup) or generate from email (OAuth)
        const metadataUsername = data.user.user_metadata?.username;
        const email = data.user.email || "";
        let emailUsername = email.split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "");

        // Username must be at least 3 characters (database constraint)
        if (emailUsername.length < 3) {
          emailUsername = emailUsername + "_" + Math.floor(Math.random() * 1000).toString().padStart(3, "0");
        }

        const baseUsername = metadataUsername || emailUsername;

        // Make sure username is unique by appending random suffix if needed
        // Also ensure minimum 3 chars and max 25 chars (leaving room for uniqueness suffix)
        let username = baseUsername.slice(0, 25);
        if (username.length < 3) {
          username = "user_" + data.user.id.slice(0, 6);
        }
        let attempts = 0;
        let isUnique = false;
        const maxAttempts = 10;

        while (!isUnique && attempts < maxAttempts) {
          const checkUsername = attempts === 0 ? username : `${username.slice(0, 20)}${Math.floor(Math.random() * 10000)}`;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: existing } = await (supabase as any)
            .from("profiles")
            .select("id")
            .eq("username", checkUsername)
            .maybeSingle();

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

        console.log("Creating profile with username:", username, "for user:", data.user.id);

        // Use upsert to handle race conditions atomically
        // If profile exists (by id), do nothing (ignoreDuplicates)
        // If username conflict, retry with different username
        let profileCreated = false;
        let profileAlreadyExists = false;
        let profileAttempts = 0;
        const maxProfileAttempts = 3;

        while (!profileCreated && !profileAlreadyExists && profileAttempts < maxProfileAttempts) {
          const profileData = {
            id: data.user.id,
            username,
            display_name: data.user.user_metadata?.full_name || null,
            avatar_url: data.user.user_metadata?.avatar_url || null,
          };
          console.log("Profile upsert attempt", profileAttempts + 1, "data:", JSON.stringify(profileData));

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: profileError } = await (supabase as any)
            .from("profiles")
            .upsert(profileData, {
              onConflict: "id",
              ignoreDuplicates: true  // If profile exists by id, don't error or update
            });

          if (!profileError) {
            // Check if this was an insert or a no-op (profile already existed)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: existingProfile } = await (supabase as any)
              .from("profiles")
              .select("created_at")
              .eq("id", data.user.id)
              .single();

            // If profile was created recently (within last 5 seconds), it's new
            const createdAt = new Date(existingProfile?.created_at);
            const isNewProfile = (Date.now() - createdAt.getTime()) < 5000;

            if (isNewProfile) {
              console.log("Profile created successfully");
              profileCreated = true;
            } else {
              console.log("Profile already exists (returning user)");
              profileAlreadyExists = true;
            }
          } else if (profileError.code === "23505") {
            // Username unique constraint violation - try with different username
            const detail = profileError.details || profileError.message || "";
            console.log("Constraint violation detail:", detail);

            if (detail.includes("username") || detail.includes("Key (username)")) {
              console.log("Username conflict, retrying with new username");
              profileAttempts++;
              username = `user_${data.user.id.slice(0, 8)}_${profileAttempts}`;
            } else {
              // Profile already exists (id conflict from race condition)
              console.log("Profile already exists (id conflict) - returning user");
              profileAlreadyExists = true;
            }
          } else {
            console.error("Profile creation error:", JSON.stringify(profileError), "Code:", profileError.code, "Message:", profileError.message);
            return NextResponse.redirect(`${origin}/auth/login?error=profile_failed`);
          }
        }

        // If profile already exists (returning user), just redirect to home
        if (profileAlreadyExists) {
          console.log("Returning user detected, redirecting to home");
          return NextResponse.redirect(`${origin}${redirect}`);
        }

        if (!profileCreated) {
          console.error("Failed to create profile after max attempts");
          return NextResponse.redirect(`${origin}/auth/login?error=profile_failed`);
        }

        // Create default preferences with error handling (only for new users)
        try {
          const prefsData = {
            user_id: data.user.id,
          };
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: prefsError } = await (supabase as any)
            .from("user_preferences")
            .insert(prefsData);

          if (prefsError) {
            // Log but don't block signup - preferences can be created later
            console.error("Preferences creation error:", prefsError);
          }
        } catch (err) {
          // Log but don't block signup - preferences can be created later
          console.error("Preferences creation exception:", err);
        }

      // Redirect new users (OAuth or email confirmation) to Discovery Mode onboarding
      return NextResponse.redirect(`${origin}/onboarding`);
    }
  }

  // Redirect to the specified path or home
  return NextResponse.redirect(`${origin}${redirect}`);
}
