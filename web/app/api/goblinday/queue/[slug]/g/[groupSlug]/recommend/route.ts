import { NextRequest, NextResponse } from "next/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { checkBodySize } from "@/lib/api-utils";
import { createServiceClient } from "@/lib/supabase/service";
import { ensureMovie } from "@/lib/goblin-movie-utils";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; groupSlug: string }> }
) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const bodySizeResult = checkBodySize(request);
  if (bodySizeResult) return bodySizeResult;

  const { slug, groupSlug } = await params;

  let body: {
    tmdb_id?: unknown;
    recommender_name?: unknown;
    note?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Validate tmdb_id
  const tmdb_id_raw = body.tmdb_id;
  if (
    !tmdb_id_raw ||
    typeof tmdb_id_raw !== "number" ||
    !Number.isFinite(tmdb_id_raw) ||
    !Number.isInteger(tmdb_id_raw) ||
    tmdb_id_raw <= 0
  ) {
    return NextResponse.json({ error: "tmdb_id must be a positive integer" }, { status: 400 });
  }
  const tmdb_id: number = tmdb_id_raw;

  // Validate recommender_name
  if (
    body.recommender_name === undefined ||
    body.recommender_name === null ||
    typeof body.recommender_name !== "string"
  ) {
    return NextResponse.json({ error: "recommender_name is required" }, { status: 400 });
  }
  const recommender_name = body.recommender_name.trim();
  if (recommender_name.length < 1) {
    return NextResponse.json({ error: "recommender_name must not be empty" }, { status: 400 });
  }
  if (recommender_name.length > 50) {
    return NextResponse.json({ error: "recommender_name must be at most 50 characters" }, { status: 400 });
  }

  // Validate optional note
  let note: string | null = null;
  if (body.note !== undefined && body.note !== null) {
    if (typeof body.note !== "string" || body.note.length > 500) {
      return NextResponse.json({ error: "note must be a string of max 500 characters" }, { status: 400 });
    }
    note = body.note.trim() || null;
  }

  const serviceClient = createServiceClient();

  // Resolve target user by username
  const { data: targetProfile } = await serviceClient
    .from("profiles")
    .select("id")
    .eq("username", slug)
    .maybeSingle();

  if (!targetProfile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const targetUserId = (targetProfile as { id: string }).id;

  // Resolve group list by slug + user
  const { data: group } = await serviceClient
    .from("goblin_lists")
    .select("id")
    .eq("user_id", targetUserId)
    .eq("slug", groupSlug)
    .eq("is_recommendations", false)
    .maybeSingle();

  if (!group) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  const listId = (group as { id: number }).id;

  // Ensure movie exists
  const movie = await ensureMovie(serviceClient, tmdb_id);
  if (!movie) {
    return NextResponse.json({ error: "Failed to find or create movie" }, { status: 404 });
  }

  // Insert recommendation scoped to this group
  const { error: insertError } = await serviceClient
    .from("goblin_watchlist_recommendations")
    .insert({
      target_user_id: targetUserId,
      list_id: listId,
      movie_id: movie.id,
      recommender_name,
      note,
      status: "pending",
    } as never);

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json(
        { error: "You already recommended this movie to this queue" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Failed to create recommendation" }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
