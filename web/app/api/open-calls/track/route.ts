import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { errorResponse, isValidString } from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// GET /api/open-calls/track — get user's tracked open calls
export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request)
  );
  if (rateLimitResult) return rateLimitResult;

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get("status");

  try {
    const serviceClient = createServiceClient();
    let query = serviceClient
      .from("user_open_call_tracking")
      .select(
        `
        id, user_id, open_call_id, status, remind_at, notes, created_at, updated_at,
        open_call:open_calls(
          id, slug, title, description, deadline, application_url,
          fee, call_type, status, confidence_tier,
          organization:organizations(id, name, slug),
          venue:venues(id, name, slug, neighborhood)
        )
      `
      )
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (statusFilter && isValidString(statusFilter, 1, 20)) {
      query = query.eq("status", statusFilter);
    }

    const { data, error } = await query;

    if (error) {
      return errorResponse(error, "GET /api/open-calls/track");
    }

    return NextResponse.json({ tracked: data ?? [] });
  } catch (error) {
    return errorResponse(error, "GET /api/open-calls/track");
  }
}

// POST /api/open-calls/track — save/applied/dismissed (upsert)
export async function POST(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.write,
    getClientIdentifier(request)
  );
  if (rateLimitResult) return rateLimitResult;

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { open_call_id, status, notes, remind_at } = body;

    if (!open_call_id || !isValidString(open_call_id, 1, 200)) {
      return NextResponse.json(
        { error: "open_call_id is required" },
        { status: 400 }
      );
    }

    if (!status || !["saved", "applied", "dismissed"].includes(status)) {
      return NextResponse.json(
        { error: "status must be saved, applied, or dismissed" },
        { status: 400 }
      );
    }

    const serviceClient = createServiceClient();

    const { data, error } = await serviceClient
      .from("user_open_call_tracking")
      .upsert(
        {
          user_id: user.id,
          open_call_id,
          status,
          notes: notes ?? null,
          remind_at: remind_at ?? null,
          updated_at: new Date().toISOString(),
        } as never,
        { onConflict: "user_id,open_call_id" }
      )
      .select("id, status")
      .single();

    if (error) {
      return errorResponse(error, "POST /api/open-calls/track");
    }

    return NextResponse.json({ success: true, tracking: data });
  } catch (error) {
    return errorResponse(error, "POST /api/open-calls/track");
  }
}

// DELETE /api/open-calls/track?open_call_id=... — remove tracking
export async function DELETE(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.write,
    getClientIdentifier(request)
  );
  if (rateLimitResult) return rateLimitResult;

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const openCallId = searchParams.get("open_call_id");

  if (!openCallId || !isValidString(openCallId, 1, 200)) {
    return NextResponse.json(
      { error: "open_call_id is required" },
      { status: 400 }
    );
  }

  try {
    const serviceClient = createServiceClient();
    const { error } = await serviceClient
      .from("user_open_call_tracking")
      .delete()
      .eq("user_id", user.id)
      .eq("open_call_id", openCallId);

    if (error) {
      return errorResponse(error, "DELETE /api/open-calls/track");
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, "DELETE /api/open-calls/track");
  }
}
