import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";
import { applyRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { checkBodySize } from "@/lib/api-utils";
import { generalInviteEmail, eventInviteEmail } from "@/lib/email-templates";
import { Resend } from "resend";

// Lazy-initialize Resend
let resendClient: Resend | null = null;
function getResend(): Resend {
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

const MAX_EMAILS_PER_REQUEST = 10;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Strict rate limit: 5 requests per minute to prevent email spam
const INVITE_RATE_LIMIT = { limit: 5, windowSec: 60 };

export const POST = withAuth(async (request, { user, serviceClient }) => {
  const sizeCheck = checkBodySize(request);
  if (sizeCheck) return sizeCheck;

  const rateLimitResult = await applyRateLimit(request, INVITE_RATE_LIMIT, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const body = await request.json();
  const { emails, eventId } = body as { emails: string[]; eventId?: number };

  if (!Array.isArray(emails) || emails.length === 0) {
    return NextResponse.json({ error: "emails array is required" }, { status: 400 });
  }

  if (emails.length > MAX_EMAILS_PER_REQUEST) {
    return NextResponse.json({ error: `Maximum ${MAX_EMAILS_PER_REQUEST} emails per request` }, { status: 400 });
  }

  // Validate emails
  const validEmails = emails
    .filter((e): e is string => typeof e === "string")
    .map((e) => e.toLowerCase().trim())
    .filter((e) => EMAIL_REGEX.test(e));

  if (validEmails.length === 0) {
    return NextResponse.json({ error: "No valid emails provided" }, { status: 400 });
  }

  // Get inviter profile
  const { data: profile } = await serviceClient
    .from("profiles")
    .select("username, display_name")
    .eq("id", user.id)
    .maybeSingle();

  const inviterName = (profile as { display_name: string | null; username: string } | null)?.display_name
    || (profile as { username: string } | null)?.username
    || "Someone";
  const inviterUsername = (profile as { username: string } | null)?.username || "";

  // Check which emails have already been invited by this user
  const { data: existingInvites } = await serviceClient
    .from("email_invites")
    .select("email")
    .eq("inviter_id", user.id)
    .in("email", validEmails);

  const alreadyInvitedSet = new Set(
    ((existingInvites || []) as Array<{ email: string }>).map((i) => i.email)
  );

  const newEmails = validEmails.filter((e) => !alreadyInvitedSet.has(e));
  const alreadyInvited = validEmails.filter((e) => alreadyInvitedSet.has(e));

  // Get event details if eventId provided
  let eventTitle = "";
  let eventUrl = "";
  if (eventId) {
    const { data: event } = await serviceClient
      .from("events")
      .select("title, id")
      .eq("id", eventId)
      .maybeSingle();

    if (event) {
      const e = event as { title: string; id: number };
      eventTitle = e.title;
      eventUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "https://lostcity.ai"}/events/${e.id}`;
    }
  }

  const baseInviteUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "https://lostcity.ai"}/invite/${inviterUsername}`;

  // Send emails
  let sentCount = 0;
  for (const email of newEmails) {
    const emailContent = eventId && eventTitle
      ? eventInviteEmail({
          inviterName,
          eventTitle,
          eventUrl,
          inviteUrl: baseInviteUrl,
        })
      : generalInviteEmail({
          inviterName,
          inviteUrl: baseInviteUrl,
        });

    try {
      await getResend().emails.send({
        from: "Lost City <noreply@lostcity.ai>",
        to: email,
        subject: emailContent.subject,
        text: emailContent.text,
        html: emailContent.html,
      });

      // Record the invite
      await serviceClient
        .from("email_invites")
        .insert({
          inviter_id: user.id,
          email,
          event_id: eventId || null,
        } as never);

      sentCount++;
    } catch (err) {
      console.error(`Failed to send invite to ${email}:`, err);
    }
  }

  return NextResponse.json({
    sent: sentCount,
    alreadyInvited,
  });
});
