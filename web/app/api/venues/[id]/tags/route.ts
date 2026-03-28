// 308 Permanent Redirect — route moved to /api/places/[id]/tags
import { NextRequest, NextResponse } from "next/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

function redirect(request: NextRequest): NextResponse {
  const url = new URL(request.url);
  url.pathname = url.pathname.replace("/api/venues/", "/api/places/");
  return NextResponse.redirect(url.toString(), 308);
}

export async function GET(request: NextRequest) {
  const rl = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rl) return rl;
  return redirect(request);
}

export async function POST(request: NextRequest) {
  const rl = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rl) return rl;
  return redirect(request);
}

export async function DELETE(request: NextRequest) {
  const rl = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rl) return rl;
  return redirect(request);
}
