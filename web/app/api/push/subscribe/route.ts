import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

// POST /api/push/subscribe — save push subscription
export async function POST(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { endpoint, auth_key, p256dh_key } = body as {
    endpoint: string;
    auth_key: string;
    p256dh_key: string;
  };

  if (!endpoint || !auth_key || !p256dh_key) {
    return NextResponse.json({ error: "endpoint, auth_key, and p256dh_key required" }, { status: 400 });
  }

  const serviceClient = createServiceClient();

  const { error } = await serviceClient
    .from("push_subscriptions")
    .upsert(
      {
        user_id: user.id,
        endpoint,
        auth_key,
        p256dh_key,
      } as never,
      { onConflict: "user_id,endpoint" }
    );

  if (error) {
    return NextResponse.json({ error: "Failed to save subscription" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// DELETE /api/push/subscribe — remove push subscription
export async function DELETE(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { endpoint } = body as { endpoint: string };

  if (!endpoint) {
    return NextResponse.json({ error: "endpoint required" }, { status: 400 });
  }

  const serviceClient = createServiceClient();

  await serviceClient
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", endpoint);

  return NextResponse.json({ success: true });
}
