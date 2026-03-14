import { NextResponse } from "next/server";
import { errorResponse, checkBodySize } from "@/lib/api-utils";
import { withAuthAndParams } from "@/lib/api-middleware";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type CollectionRow = { id: number; user_id: string | null };

// POST /api/collections/[slug]/items - Add event to collection
export const POST = withAuthAndParams<{ slug: string }>(async (request, { user, supabase, params }) => {
  // Check body size
  const bodySizeError = checkBodySize(request);
  if (bodySizeError) return bodySizeError;

  // Apply rate limiting (write tier - adds data)
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { slug } = params;

  const body = await request.json();
  const { event_id, note } = body;

  if (!event_id || typeof event_id !== "number") {
    return NextResponse.json({ error: "event_id is required" }, { status: 400 });
  }

  // Get collection and verify ownership
  const { data: collectionData } = await supabase
    .from("collections")
    .select("id, user_id")
    .eq("slug", slug)
    .maybeSingle();

  const collection = collectionData as CollectionRow | null;

  if (!collection) {
    return NextResponse.json({ error: "Collection not found" }, { status: 404 });
  }

  if (collection.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Get max position
  const { data: maxPosData } = await supabase
    .from("collection_items")
    .select("position")
    .eq("collection_id", collection.id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const maxPos = maxPosData as { position: number } | null;
  const nextPosition = (maxPos?.position || 0) + 1;

  // Add item (use any to bypass type checking for new table)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("collection_items")
    .insert({
      collection_id: collection.id,
      event_id,
      note: note?.trim() || null,
      position: nextPosition,
    })
    .select()
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Event already in collection" }, { status: 409 });
    }
    return errorResponse(error, "POST /api/collections/[slug]/items");
  }

  return NextResponse.json({ item: data }, { status: 201 });
});

// DELETE /api/collections/[slug]/items?event_id=123 - Remove event from collection
export const DELETE = withAuthAndParams<{ slug: string }>(async (request, { user, supabase, params }) => {
  // Apply rate limiting (write tier - deletes data)
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { slug } = params;
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("event_id");

  if (!eventId) {
    return NextResponse.json({ error: "event_id is required" }, { status: 400 });
  }

  // Get collection and verify ownership
  const { data: collectionData } = await supabase
    .from("collections")
    .select("id, user_id")
    .eq("slug", slug)
    .maybeSingle();

  const collection = collectionData as CollectionRow | null;

  if (!collection) {
    return NextResponse.json({ error: "Collection not found" }, { status: 404 });
  }

  if (collection.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Remove item (use any to bypass type checking for new table)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("collection_items")
    .delete()
    .eq("collection_id", collection.id)
    .eq("event_id", parseInt(eventId, 10));

  if (error) {
    return errorResponse(error, "DELETE /api/collections/[slug]/items");
  }

  return NextResponse.json({ success: true });
});
