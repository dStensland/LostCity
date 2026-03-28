import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

type RouteContext = { params: Promise<{ token: string }> };

// GET /api/plans/share/:token — public plan data by share token
// No auth required — the share token IS the authorization
export async function GET(request: NextRequest, context: RouteContext) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { token } = await context.params;

  if (!token || token.length < 10) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  const serviceClient = createServiceClient();

  // Fetch plan by share_token — only active plans with friends/public visibility
  const { data: plan, error } = await serviceClient
    .from("plans")
    .select(`
      id, title, description, plan_date, plan_time, status, visibility, created_at,
      creator:profiles!plans_creator_id_fkey(id, username, display_name, avatar_url),
      items:plan_items(
        id, title, sort_order, event_id, venue_id, note, start_time,
        event:events(id, title, start_date, start_time, image_url),
        venue:places(id, name, slug, image_url, neighborhood)
      ),
      participants:plan_participants(
        id, status,
        user:profiles!plan_participants_user_id_fkey(id, username, display_name, avatar_url)
      )
    `)
    .eq("share_token", token)
    .eq("status", "active")
    .single();

  if (error || !plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  return NextResponse.json({ plan });
}
