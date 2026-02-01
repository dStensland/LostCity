import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { generateFeedToken } from "@/lib/calendar-feed-utils";

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
