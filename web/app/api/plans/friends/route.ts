import { NextRequest, NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

// In-memory cache keyed by user ID (bounded, with eviction)
const cache = new Map<string, { data: unknown; expiry: number }>();
const CACHE_TTL = 60_000; // 60s
const CACHE_MAX_SIZE = 500;
let cacheWriteCount = 0;

function getCached(key: string): unknown | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiry > Date.now()) return entry.data;
  cache.delete(key);
  return null;
}

function setCache(key: string, data: unknown): void {
  cache.set(key, { data, expiry: Date.now() + CACHE_TTL });
  cacheWriteCount++;
  // Sweep expired entries every 100 writes or when over size cap
  if (cacheWriteCount >= 100 || cache.size > CACHE_MAX_SIZE) {
    cacheWriteCount = 0;
    const now = Date.now();
    for (const [k, v] of cache) {
      if (v.expiry <= now) cache.delete(k);
    }
    // Hard cap: evict oldest if still over limit
    if (cache.size > CACHE_MAX_SIZE) {
      const overflow = cache.size - CACHE_MAX_SIZE;
      const keys = cache.keys();
      for (let i = 0; i < overflow; i++) {
        const { value } = keys.next();
        if (value) cache.delete(value);
      }
    }
  }
}

export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check cache
  const cacheKey = `friend-plans:${user.id}`;
  const cached = getCached(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  const supabase = await createClient();

  // Get mutual friend IDs
  const { data: friendIdsData } = await supabase.rpc(
    "get_friend_ids" as never,
    { user_id: user.id } as never
  ) as { data: { friend_id: string }[] | null; error: unknown };

  const friendIds = (friendIdsData || []).map((r) => r.friend_id);

  // Defense-in-depth: filter blocked users even though enforce_block_unfriend
  // trigger should prevent them from appearing as friends
  const { data: blocks } = await supabase
    .from("user_blocks")
    .select("blocker_id, blocked_id")
    .or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`);

  const blockedIds = new Set<string>();
  if (blocks) {
    for (const b of blocks as { blocker_id: string; blocked_id: string }[]) {
      blockedIds.add(b.blocker_id === user.id ? b.blocked_id : b.blocker_id);
    }
  }

  const safeFriendIds = friendIds.filter((id) => !blockedIds.has(id));

  if (safeFriendIds.length === 0) {
    const empty = { plans: [] };
    setCache(cacheKey, empty);
    return NextResponse.json(empty);
  }

  const today = new Date().toISOString().split("T")[0];

  const { data: plans, error } = await supabase
    .from("plans")
    .select(`
      id, title, description, plan_date, plan_time, status, visibility, created_at,
      creator:profiles!plans_creator_id_fkey(id, username, display_name, avatar_url),
      items:plan_items(id, title, sort_order, venue_id, event_id, start_time, venue:places(id, name, slug)),
      participants:plan_participants(
        id, status,
        user:profiles!plan_participants_user_id_fkey(id, username, display_name, avatar_url)
      )
    `)
    .in("creator_id", safeFriendIds)
    .in("status", ["active"])
    .in("visibility", ["friends", "public"])
    .gte("plan_date", today)
    .order("plan_date", { ascending: true })
    .limit(15);

  if (error) {
    console.error("Error fetching friend plans:", error.message);
    return NextResponse.json({ error: "Failed to load plans" }, { status: 500 });
  }

  const result = { plans: plans || [] };
  setCache(cacheKey, result);

  return NextResponse.json(result);
}
