import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { getLocalDateString } from "@/lib/formats";

type Organization = {
  id: string;
  name: string;
  slug: string;
  org_type: string;
  website: string | null;
  instagram: string | null;
  logo_url: string | null;
  description: string | null;
  categories: string[] | null;
  neighborhood: string | null;
  featured: boolean;
};

export async function GET(request: NextRequest) {
  // Rate limit: read endpoint
  const rateLimitResult = applyRateLimit(request, RATE_LIMITS.read);
  if (rateLimitResult) return rateLimitResult;

  try {
    // Get current date for event counting
    const today = getLocalDateString();

    // Fetch organizations
    const { data: organizations, error } = await supabase
      .from("organizations")
      .select("id, name, slug, org_type, website, instagram, logo_url, description, categories, neighborhood, featured")
      .eq("hidden", false)
      .order("featured", { ascending: false })
      .order("name");

    if (error) {
      console.error("Error fetching organizations:", error);
      return NextResponse.json({ error: "Failed to fetch organizations" }, { status: 500 });
    }

    // Get event counts for each organization
    const { data: events } = await supabase
      .from("events")
      .select("organization_id")
      .gte("start_date", today)
      .not("organization_id", "is", null);

    const eventCounts: Record<string, number> = {};
    for (const event of (events || []) as { organization_id: string }[]) {
      eventCounts[event.organization_id] = (eventCounts[event.organization_id] || 0) + 1;
    }

    // Add event counts to organizations
    const organizationsWithCounts = ((organizations || []) as Organization[]).map((o) => ({
      ...o,
      event_count: eventCounts[o.id] || 0,
    }));

    return NextResponse.json(
      { organizations: organizationsWithCounts },
      {
        headers: {
          // Organizations rarely change - cache for 5 minutes
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (err) {
    console.error("Error in organizations API:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
