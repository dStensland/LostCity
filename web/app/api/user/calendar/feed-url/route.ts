import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  generateFeedToken,
  generateFeedUserSecret,
  generateLegacyFeedToken,
} from "@/lib/calendar-feed-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

function buildCalendarUrls(userId: string, token: string) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://lostcity.ai";
  const feedUrl = `${baseUrl}/api/user/calendar/feed?uid=${userId}&token=${token}`;

  // Google Calendar requires webcal:// protocol for subscriptions
  const webcalUrl = feedUrl.replace(/^https?:\/\//, "webcal://");
  const googleCalendarUrl = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcalUrl)}`;
  const outlookUrl = `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(feedUrl)}&name=Lost%20City%20Events`;

  return {
    feedUrl,
    googleCalendarUrl,
    outlookUrl,
  };
}

function isMissingColumnError(error: unknown): boolean {
  const err = error as { code?: string; message?: string } | null;
  if (!err) return false;
  if (err.code === "42703") return true;
  if (typeof err.message === "string" && err.message.includes("calendar_feed_secret")) return true;
  return false;
}

async function resolveFeedToken(userId: string, rotate: boolean): Promise<string> {
  const serviceClient = createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profileData, error: profileError } = await (serviceClient as any)
    .from("profiles")
    .select("calendar_feed_secret")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    if (isMissingColumnError(profileError)) {
      return generateLegacyFeedToken(userId);
    }
    throw profileError;
  }

  const profile = profileData as { calendar_feed_secret: string | null } | null;
  if (!profile) {
    return generateLegacyFeedToken(userId);
  }

  let userSecret = profile.calendar_feed_secret;
  if (!userSecret || rotate) {
    userSecret = generateFeedUserSecret();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (serviceClient as any)
      .from("profiles")
      .update({ calendar_feed_secret: userSecret })
      .eq("id", userId);

    if (updateError) {
      if (isMissingColumnError(updateError)) {
        return generateLegacyFeedToken(userId);
      }
      throw updateError;
    }
  }

  return generateFeedToken(userId, userSecret);
}

export async function GET(request: Request) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.auth, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = await resolveFeedToken(user.id, false);
  return NextResponse.json(buildCalendarUrls(user.id, token));
}

// POST /api/user/calendar/feed-url - rotate feed token and return new URLs.
export async function POST(request: Request) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.auth, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = await resolveFeedToken(user.id, true);
  return NextResponse.json({
    ...buildCalendarUrls(user.id, token),
    rotated: true,
  });
}
