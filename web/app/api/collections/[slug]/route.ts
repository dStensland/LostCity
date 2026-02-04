import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

// Revalidate every 60 seconds - collections change infrequently
export const revalidate = 60;

type Props = {
  params: Promise<{ slug: string }>;
};

type CollectionData = {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  user_id: string | null;
  visibility: string;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
  owner: { username: string; display_name: string | null; avatar_url: string | null } | null;
};

// GET /api/collections/[slug] - Get collection with items
export async function GET(request: NextRequest, { params }: Props) {
  // Apply rate limiting (read tier - public read endpoint)
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { slug } = await params;
  const supabase = await createClient();

  // Get collection (use any for new table)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: collectionData, error: collectionError } = await (supabase as any)
    .from("collections")
    .select(`
      id,
      slug,
      title,
      description,
      cover_image_url,
      user_id,
      visibility,
      is_featured,
      created_at,
      updated_at,
      owner:profiles!collections_user_id_fkey(username, display_name, avatar_url)
    `)
    .eq("slug", slug)
    .maybeSingle();

  const collection = collectionData as CollectionData | null;

  if (collectionError || !collection) {
    return NextResponse.json({ error: "Collection not found" }, { status: 404 });
  }

  // Get items with event details
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: items } = await (supabase as any)
    .from("collection_items")
    .select(`
      id,
      note,
      position,
      added_at,
      event:events(
        id,
        title,
        start_date,
        start_time,
        is_all_day,
        is_free,
        price_min,
        price_max,
        category,
        image_url,
        venue:venues(name, slug, neighborhood)
      )
    `)
    .eq("collection_id", collection.id)
    .order("position", { ascending: true });

  // Filter out items with null events (deleted events)
  type ItemWithEvent = { id: number; note: string | null; position: number; added_at: string; event: unknown };
  const validItems = ((items || []) as ItemWithEvent[]).filter((item) => item.event !== null);

  return NextResponse.json({
    collection: {
      ...collection,
      item_count: validItems.length,
    },
    items: validItems,
  }, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120"
    }
  });
}

// DELETE /api/collections/[slug] - Delete collection
export async function DELETE(request: NextRequest, { params }: Props) {
  // Apply rate limiting (write tier - deletes data)
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { slug } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify ownership
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: collectionData } = await (supabase as any)
    .from("collections")
    .select("id, user_id")
    .eq("slug", slug)
    .maybeSingle();

  const collection = collectionData as { id: number; user_id: string | null } | null;

  if (!collection) {
    return NextResponse.json({ error: "Collection not found" }, { status: 404 });
  }

  if (collection.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("collections")
    .delete()
    .eq("id", collection.id);

  if (error) {
    return errorResponse(error, "DELETE /api/collections/[slug]");
  }

  return NextResponse.json({ success: true });
}
