import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { checkBodySize } from "@/lib/api-utils";

const MAX_EMAILS = 100;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST = withAuth(async (request, { user, serviceClient }) => {
  const sizeCheck = checkBodySize(request);
  if (sizeCheck) return sizeCheck;

  const rateLimitId = `${user.id}:${getClientIdentifier(request)}`;
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.auth, rateLimitId);
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

  // Look up users by email using a scoped view.
  // Do not fall back to listing all auth users.
  const { data: authUsers, error: authError } = await serviceClient
    .from("auth_users_view" as never)
    .select("id, email")
    .in("email", normalizedEmails as never) as { data: Array<{ id: string; email: string }> | null; error: unknown };

  if (authError || !authUsers) {
    return NextResponse.json({ error: "Contact lookup unavailable" }, { status: 503 });
  }

  const emailToUser = new Map<string, string>();
  for (const u of authUsers) {
    if (u.email) {
      emailToUser.set(u.email.toLowerCase(), u.id);
    }
  }

  const candidateUserIds = new Set<string>();

  for (const email of normalizedEmails) {
    const userId = emailToUser.get(email);
    if (userId && userId !== user.id) {
      candidateUserIds.add(userId);
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

  if (candidateUserIds.size > 0) {
    const { data: profiles } = await serviceClient
      .from("profiles")
      .select("id, username, display_name, avatar_url, bio")
      .in("id", Array.from(candidateUserIds))
      .eq("is_public", true);

    matched = (profiles || []) as typeof matched;
  }

  const publicMatchedUserIds = new Set(matched.map((profile) => profile.id));
  const unmatchedEmails = normalizedEmails.filter((email) => {
    const userId = emailToUser.get(email);
    if (!userId) return true;
    if (userId === user.id) return false;
    return !publicMatchedUserIds.has(userId);
  });

  return NextResponse.json({ matched, unmatched: unmatchedEmails });
});
