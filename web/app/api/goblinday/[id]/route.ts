import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { parseIntParam } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

const MUTABLE_FIELDS = new Set([
  "rt_critics_score",
  "rt_audience_score",
  "streaming_info",
]);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Rate limit before auth so unauthenticated spam is bounced cheaply
  const rateLimitResult = applyRateLimit(
    request,
    RATE_LIMITS.write,
    getClientIdentifier(request),
  );
  if (rateLimitResult) return rateLimitResult;

  // Require authenticated user. goblin_movies is a shared catalog edited
  // by logged-in Goblin users; anonymous writes were a privacy/integrity
  // hole (rt_critics_score, rt_audience_score, streaming_info could be
  // set by any unauthenticated caller).
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const movieId = parseIntParam(id);
  if (movieId === null || movieId <= 0) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Filter to only allowed fields
  const updates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (MUTABLE_FIELDS.has(key)) {
      updates[key] = value;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  // Use service client for the actual write (auth is verified above)
  const serviceClient = createServiceClient();
  const { data, error } = await serviceClient
    .from("goblin_movies")
    .update(updates as never)
    .eq("id", movieId)
    .select()
    .single();

  if (error) {
    // Generic error — don't leak supabase internals
    return NextResponse.json({ error: "Failed to update movie" }, { status: 500 });
  }

  return NextResponse.json(data);
}
