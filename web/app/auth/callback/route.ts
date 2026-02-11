import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/types";
import {
  extractPortalFromRedirect,
  isValidPortalSlug,
  isValidRedirect,
  PORTAL_CONTEXT_COOKIE,
} from "@/lib/auth-utils";
import { attributeSignupToPortal } from "@/lib/auth-attribution";

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
  const portalParam = requestUrl.searchParams.get("portal");
  const isNewUser = requestUrl.searchParams.get("new") === "true";

  // Validate redirect to prevent Open Redirect vulnerability
  const redirect = isValidRedirect(rawRedirect) ? rawRedirect : "/";
  const origin = requestUrl.origin;

  if (!code) {
    return NextResponse.redirect(`${origin}${redirect}`);
  }

  const cookieStore = await cookies();
  const portalFromCookie = cookieStore.get(PORTAL_CONTEXT_COOKIE)?.value;
  const portalSlug = isValidPortalSlug(portalParam)
    ? portalParam
    : extractPortalFromRedirect(rawRedirect) || (isValidPortalSlug(portalFromCookie) ? portalFromCookie : null);

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

  if (isNewUser && portalSlug) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await attributeSignupToPortal(user.id, portalSlug);
      }
    } catch (attributionError) {
      console.error("Failed to apply signup attribution:", attributionError);
    }
  }

  // Profile is created automatically by database trigger (handle_new_user)
  // Redirect new signups to onboarding, returning users to their destination
  if (isNewUser) {
    const onboardingUrl = portalSlug
      ? `${origin}/onboarding?portal=${encodeURIComponent(portalSlug)}`
      : `${origin}/onboarding`;
    return NextResponse.redirect(onboardingUrl);
  }

  return NextResponse.redirect(`${origin}${redirect}`);
}
