import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

type WalkableRow = {
  walk_minutes: number;
  neighbor: { id: number; name: string; slug: string } | null;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { slug } = await params;

  if (!slug) {
    return Response.json({ error: "Invalid slug" }, { status: 400 });
  }

  const supabase = await createClient();

  // Resolve venue ID from slug
  const { data: venueData } = await supabase
    .from("venues")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  const venue = venueData as { id: number } | null;
  if (!venue) {
    return Response.json({ error: "Venue not found" }, { status: 404 });
  }

  // Fetch walkable neighbors with venue details
  const { data: neighbors } = await supabase
    .from("walkable_neighbors" as never)
    .select(`
      walk_minutes,
      neighbor:neighbor_id(id, name, slug)
    `)
    .eq("venue_id", venue.id)
    .order("walk_minutes", { ascending: true })
    .limit(10);

  const rows = (neighbors || []) as unknown as WalkableRow[];

  const result = rows
    .filter((row) => row.neighbor != null)
    .map((row) => ({
      id: row.neighbor!.id,
      name: row.neighbor!.name,
      slug: row.neighbor!.slug,
      walk_minutes: row.walk_minutes,
    }));

  return Response.json({ neighbors: result });
}
