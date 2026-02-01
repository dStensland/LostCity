import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "edge";

/**
 * Internal API for resolving custom domains to portal slugs.
 * Used by middleware for edge-compatible domain resolution.
 *
 * This endpoint is not authenticated but only accepts internal requests
 * (checked via x-internal-secret header).
 */
export async function GET(request: NextRequest) {
  // Verify this is an internal request using shared secret
  const internalSecret = request.headers.get("x-internal-secret");
  const expectedSecret = process.env.INTERNAL_API_SECRET;

  if (!expectedSecret || internalSecret !== expectedSecret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const domain = request.nextUrl.searchParams.get("domain");
  if (!domain) {
    return NextResponse.json({ error: "Missing domain parameter" }, { status: 400 });
  }

  const normalizedDomain = domain.toLowerCase().replace(/^www\./, "");

  // Query for portal with this custom domain
  // Uses type assertion since custom_domain is a new column
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("portals")
    .select("slug")
    .eq("custom_domain", normalizedDomain)
    .eq("custom_domain_verified", true)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    console.error("Error resolving custom domain:", error);
    return NextResponse.json({ slug: null });
  }

  return NextResponse.json({ slug: data?.slug || null });
}
