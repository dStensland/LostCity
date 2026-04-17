import { NextRequest, NextResponse } from "next/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { getEventTagCount } from "@/lib/events/get-tag-count";

export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { searchParams } = request.nextUrl;
  const tag = searchParams.get("tag");
  if (!tag || tag.length > 50) {
    return NextResponse.json({ count: 0 });
  }

  const count = await getEventTagCount({
    tag,
    portalSlug: searchParams.get("portal"),
  });

  return NextResponse.json(
    { count },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } }
  );
}
