import { NextRequest, NextResponse } from "next/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.standard,
    getClientIdentifier(request)
  );
  if (rateLimitResult) return rateLimitResult;

  let payload: unknown = null;
  try {
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json") || contentType.includes("application/csp-report")) {
      payload = await request.json();
    } else {
      const text = await request.text();
      payload = text ? JSON.parse(text) : null;
    }
  } catch {
    payload = null;
  }

  if (payload) {
    logger.info("CSP report received", { component: "csp-report", report: payload });
  } else {
    logger.info("CSP report received (unparseable)", { component: "csp-report" });
  }

  return new NextResponse(null, { status: 204 });
}

export async function GET() {
  return NextResponse.json({ ok: true }, { status: 200 });
}
