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
    .replace(/[\s\n\r\t]/g, "")
    .replace(/%0A/gi, "")
    .replace(/%0D/gi, "")
    .replace(/[^\x20-\x7E]/g, "");
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const rawRedirect = requestUrl.searchParams.get("redirect") || "/";
  const isNewUser = requestUrl.searchParams.get("new") === "true";

  // Validate redirect to prevent Open Redirect vulnerability
  const redirect = isValidRedirect(rawRedirect) ? rawRedirect : "/";
  const origin = requestUrl.origin;

  if (!code) {
    return NextResponse.redirect(`${origin}${redirect}`);
  }

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

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("Auth callback error:", error);
    return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`);
  }

  // Profile is created automatically by database trigger (handle_new_user)
  // Redirect new signups to onboarding, returning users to their destination
  if (isNewUser) {
    return NextResponse.redirect(`${origin}/onboarding`);
  }

  return NextResponse.redirect(`${origin}${redirect}`);
}
