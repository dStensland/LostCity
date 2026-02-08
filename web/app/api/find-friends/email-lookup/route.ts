import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { checkBodySize } from "@/lib/api-utils";

const MAX_EMAILS = 100;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST = withAuth(async (request, { user, serviceClient }) => {
  const sizeCheck = checkBodySize(request);
  if (sizeCheck) return sizeCheck;

  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.auth, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const body = await request.json();
  const { emails } = body as { emails: string[] };

  if (!Array.isArray(emails) || emails.length === 0) {
    return NextResponse.json({ error: "emails array is required" }, { status: 400 });
  }

  if (emails.length > MAX_EMAILS) {
    return NextResponse.json({ error: `Maximum ${MAX_EMAILS} emails allowed` }, { status: 400 });
  }

  // Validate and normalize emails
  const normalizedEmails = emails
    .filter((e): e is string => typeof e === "string")
    .map((e) => e.toLowerCase().trim())
    .filter((e) => EMAIL_REGEX.test(e));

  if (normalizedEmails.length === 0) {
    return NextResponse.json({ matched: [], unmatched: [] });
  }

  // Look up users by email — query only the emails we need, not all users
  const { data: authUsers, error: authError } = await serviceClient
    .from("auth_users_view" as never)
    .select("id, email")
    .in("email", normalizedEmails as never) as { data: Array<{ id: string; email: string }> | null; error: unknown };

  // Fallback: if the view doesn't exist, use RPC or direct query
  let emailToUser = new Map<string, string>();
  if (authError || !authUsers) {
    // Fallback to admin API with pagination if view not available
    const { data: authData } = await serviceClient.auth.admin.listUsers({
      perPage: 1000,
    });
    const users = authData?.users || [];
    for (const u of users) {
      if (u.email) {
        emailToUser.set(u.email.toLowerCase(), u.id);
      }
    }
  } else {
    for (const u of authUsers) {
      if (u.email) {
        emailToUser.set(u.email.toLowerCase(), u.id);
      }
    }
  }

  const matchedUserIds: string[] = [];
  const unmatchedEmails: string[] = [];

  for (const email of normalizedEmails) {
    const userId = emailToUser.get(email);
    if (userId && userId !== user.id) {
      matchedUserIds.push(userId);
    } else if (!userId) {
      unmatchedEmails.push(email);
    }
  }

  // Fetch profiles for matched users
  let matched: Array<{
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    bio: string | null;
  }> = [];

  if (matchedUserIds.length > 0) {
    const { data: profiles } = await serviceClient
      .from("profiles")
      .select("id, username, display_name, avatar_url, bio")
      .in("id", matchedUserIds);

    matched = (profiles || []) as typeof matched;
  }

  return NextResponse.json({ matched, unmatched: unmatchedEmails });
});
