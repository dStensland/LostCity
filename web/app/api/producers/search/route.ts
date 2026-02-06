import { NextRequest, NextResponse } from "next/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

// Redirect to /api/organizations/search for backwards compatibility
export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.search, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const url = new URL(request.url);
  const newUrl = url.href.replace("/api/producers", "/api/organizations");
  return NextResponse.redirect(newUrl, { status: 308 }); // Permanent redirect
}
