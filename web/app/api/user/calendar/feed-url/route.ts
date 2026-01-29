import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { createHmac } from "crypto";

// Generate a secure token for calendar feed URL
function generateFeedToken(userId: string): string {
  const secret = process.env.CALENDAR_FEED_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "calendar-feed-secret";
  return createHmac("sha256", secret).update(userId).digest("hex").slice(0, 32);
}

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = generateFeedToken(user.id);
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://lostcity.ai";
  const feedUrl = `${baseUrl}/api/user/calendar/feed?uid=${user.id}&token=${token}`;

  // Generate URLs for different calendar services
  const googleCalendarUrl = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(feedUrl)}`;
  const outlookUrl = `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(feedUrl)}&name=Lost%20City%20Events`;

  return NextResponse.json({
    feedUrl,
    googleCalendarUrl,
    outlookUrl,
    // For Apple Calendar, users typically add via Settings > Calendar > Add Account > Other > Add Subscribed Calendar
  });
}
