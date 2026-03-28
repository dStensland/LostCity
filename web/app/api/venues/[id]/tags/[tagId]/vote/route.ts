// 308 Permanent Redirect — route moved to /api/places/[id]/tags/[tagId]/vote
import { NextRequest, NextResponse } from "next/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

function redirect(request: NextRequest): NextResponse {
  const url = new URL(request.url);
  url.pathname = url.pathname.replace("/api/venues/", "/api/places/");
  return NextResponse.redirect(url.toString(), 308);
}

export async function POST(request: NextRequest) {
  const rl = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rl) return rl;
  return redirect(request);
}
