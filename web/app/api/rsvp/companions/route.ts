import { NextRequest, NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { parseIntParam, validationError } from "@/lib/api-utils";

// GET /api/rsvp/companions?event_id=N — fetch companions for current user's RSVP
export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const eventId = parseIntParam(searchParams.get("event_id"));
  if (eventId === null) {
    return validationError("Invalid event_id");
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("rsvp_companions")
    .select(`
      companion_id,
      companion:profiles!rsvp_companions_companion_id_fkey(
        id, username, display_name, avatar_url
      )
    `)
    .eq("rsvp_user_id", user.id)
    .eq("event_id", eventId);

  if (error) {
    return NextResponse.json({ error: "Failed to fetch companions" }, { status: 500 });
  }

  type CompanionRow = {
    companion_id: string;
    companion: {
      id: string;
      username: string;
      display_name: string | null;
      avatar_url: string | null;
    } | null;
  };

  const companions = ((data || []) as unknown as CompanionRow[])
    .filter((r) => r.companion)
    .map((r) => r.companion!);

  return NextResponse.json({ companions });
}

// POST /api/rsvp/companions — set companions (replace all)
export async function POST(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { event_id, companion_ids } = body as { event_id: number; companion_ids: string[] };

  if (!event_id || !Array.isArray(companion_ids)) {
    return validationError("event_id and companion_ids[] required");
  }

  if (companion_ids.length > 10) {
    return validationError("Maximum 10 companions");
  }

  const serviceClient = createServiceClient();

  // Delete existing companions
  await serviceClient
    .from("rsvp_companions")
    .delete()
    .eq("rsvp_user_id", user.id)
    .eq("event_id", event_id);

  // Insert new companions
  if (companion_ids.length > 0) {
    const rows = companion_ids.map((cid) => ({
      rsvp_user_id: user.id,
      event_id,
      companion_id: cid,
    }));

    const { error } = await serviceClient
      .from("rsvp_companions")
      .insert(rows as never);

    if (error) {
      return NextResponse.json({ error: "Failed to save companions" }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true, count: companion_ids.length });
}

// DELETE /api/rsvp/companions?event_id=N — clear companions
export async function DELETE(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const eventId = parseIntParam(searchParams.get("event_id"));
  if (eventId === null) {
    return validationError("Invalid event_id");
  }

  const serviceClient = createServiceClient();

  await serviceClient
    .from("rsvp_companions")
    .delete()
    .eq("rsvp_user_id", user.id)
    .eq("event_id", eventId);

  return NextResponse.json({ success: true });
}
