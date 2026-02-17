import { NextRequest, NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

// In-memory cache
const cache = new Map<string, { data: unknown; expiry: number }>();
const CACHE_TTL = 300_000; // 5 minutes

export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check cache
  const cacheKey = `invite-stats:${user.id}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiry > Date.now()) {
    return NextResponse.json(cached.data);
  }

  const supabase = await createClient();

  // Query email invites sent
  const { count: emailsSent } = await supabase
    .from("email_invites")
    .select("id", { count: "exact", head: true })
    .eq("inviter_id", user.id);

  // Query friend requests sent and their statuses
  const { data: requestsData } = await supabase
    .from("friend_requests")
    .select("id, status, invitee:profiles!friend_requests_invitee_id_fkey(username, display_name, avatar_url)")
    .eq("inviter_id", user.id);

  type RequestRow = {
    id: string;
    status: string;
    invitee: { username: string; display_name: string | null; avatar_url: string | null } | null;
  };

  const requests = (requestsData || []) as unknown as RequestRow[];
  const requestsSent = requests.length;
  const friendsMade = requests.filter((r) => r.status === "accepted").length;

  // Get recent joiners (friends made in the last 30 days)
  const recentJoiners = requests
    .filter((r) => r.status === "accepted" && r.invitee)
    .slice(0, 3)
    .map((r) => ({
      username: r.invitee!.username,
      display_name: r.invitee!.display_name,
      avatar_url: r.invitee!.avatar_url,
    }));

  const result = {
    emailsSent: emailsSent || 0,
    requestsSent,
    friendsMade,
    recentJoiners,
  };

  cache.set(cacheKey, { data: result, expiry: Date.now() + CACHE_TTL });

  return NextResponse.json(result);
}
