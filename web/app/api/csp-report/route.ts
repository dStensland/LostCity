import { NextRequest, NextResponse } from "next/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { checkBodySize, checkParsedBodySize } from "@/lib/api-utils";

const MAX_CSP_REPORT_BYTES = 20 * 1024;

export async function POST(request: NextRequest) {
  const sizeCheck = checkBodySize(request, MAX_CSP_REPORT_BYTES);
  if (sizeCheck) return sizeCheck;

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
    const parsedSizeCheck = checkParsedBodySize(payload, MAX_CSP_REPORT_BYTES);
    if (parsedSizeCheck) return parsedSizeCheck;

    // Prevent log amplification by truncating very large serialized payloads.
    const serialized = JSON.stringify(payload);
    const reportForLog = serialized.length > 2000
      ? `${serialized.slice(0, 2000)}...[truncated]`
      : payload;

    logger.info("CSP report received", { component: "csp-report", report: reportForLog });
  } else {
    logger.info("CSP report received (unparseable)", { component: "csp-report" });
  }

  return new NextResponse(null, { status: 204 });
}

export async function GET() {
  return NextResponse.json({ ok: true }, { status: 200 });
}
