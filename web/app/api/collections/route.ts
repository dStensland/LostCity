import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-utils";
import { withAuth } from "@/lib/api-middleware";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type CollectionRow = {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  user_id: string | null;
  visibility: string;
  is_featured: boolean;
  created_at: string;
  item_count: { count: number }[] | number;
};

// GET /api/collections - List collections
export async function GET(request: Request) {
  // Apply rate limiting (read tier - public read endpoint)
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const supabase = await createClient();
  const { searchParams } = new URL(request.url);

  const featured = searchParams.get("featured") === "true";
  const userId = searchParams.get("user");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
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
      item_count:collection_items(count)
    `)
    .order("created_at", { ascending: false });

  if (featured) {
    query = query.eq("is_featured", true).order("featured_order", { ascending: true });
  } else if (userId) {
    query = query.eq("user_id", userId);
  } else {
    query = query.eq("visibility", "public");
  }

  const { data, error } = await query.limit(20);

  if (error) {
    return errorResponse(error, "collections:GET");
  }

  // Transform count
  const collections = ((data || []) as CollectionRow[]).map((c) => ({
    ...c,
    item_count: Array.isArray(c.item_count) ? c.item_count[0]?.count || 0 : 0,
  }));

  return NextResponse.json({ collections });
}

// POST /api/collections - Create a new collection
export const POST = withAuth(async (request, { user, serviceClient }) => {
  // Apply rate limiting (write tier - creates data)
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const body = await request.json();
  const { title, description, visibility = "public" } = body;

  if (!title || typeof title !== "string" || title.trim().length === 0) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  // Generate slug from title
  const baseSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);

  // Make slug unique by appending random suffix
  const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 8)}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (serviceClient as any)
    .from("collections")
    .insert({
      slug,
      title: title.trim(),
      description: description?.trim() || null,
      user_id: user.id,
      visibility,
    })
    .select()
    .maybeSingle();

  if (error) {
    return errorResponse(error, "collections:POST");
  }

  return NextResponse.json({ collection: data }, { status: 201 });
});
