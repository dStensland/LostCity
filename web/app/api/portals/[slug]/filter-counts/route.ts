import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  applyRateLimit,
  RATE_LIMITS,
  getClientIdentifier,
} from "@/lib/rate-limit";
import { successResponse, errorApiResponse } from "@/lib/api-utils";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

export const revalidate = 300; // 5-minute ISR cache
export const maxDuration = 30;

// GET /api/portals/[slug]/filter-counts — lightweight filter counts from available_filters
export async function GET(request: NextRequest, context: RouteContext) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request)
  );
  if (rateLimitResult) return rateLimitResult;

  const { slug } = await context.params;
  const supabase = await createClient();

  // Verify portal exists
  const { data: portal } = await supabase
    .from("portals")
    .select("id")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  if (!portal) {
    return errorApiResponse("Portal not found", 404);
  }

  // Fetch all available_filters grouped by type
  const { data: filters, error } = await supabase
    .from("available_filters")
    .select("filter_type, filter_value, display_label, event_count, parent_value, display_order")
    .gt("event_count", 0)
    .order("display_order", { ascending: false })
    .order("event_count", { ascending: false });

  if (error) {
    return errorApiResponse("Failed to fetch filter counts", 500);
  }

  const typedFilters = (filters || []) as {
    filter_type: string;
    filter_value: string;
    display_label: string;
    event_count: number;
    parent_value: string | null;
    display_order: number;
  }[];

  // Group by filter_type
  const grouped: Record<string, Record<string, number>> = {};
  for (const f of typedFilters) {
    if (!grouped[f.filter_type]) {
      grouped[f.filter_type] = {};
    }
    grouped[f.filter_type][f.filter_value] = f.event_count;
  }

  return successResponse(grouped, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
