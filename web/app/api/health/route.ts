import { createClient } from "@/lib/supabase/server";
import { NextResponse, NextRequest } from "next/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier} from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

// Version from package.json
const VERSION = "0.1.0";

export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const timestamp = new Date().toISOString();
  const checks: Record<string, string> = {};

  // Check database connectivity with a simple, fast query
  // Don't fail the health check if DB is slow - just report the status
  try {
    const supabase = await createClient();

    // Use a simple query with timeout - just check if we can connect
    // Select from a table that's guaranteed to exist and be fast
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s timeout

    const { error } = await supabase
      .from("events")
      .select("id")
      .limit(1)
      .abortSignal(controller.signal);

    clearTimeout(timeoutId);

    if (error) {
      checks.database = "error";
      logger.error("Health check DB error:", error.message);
    } else {
      checks.database = "ok";
    }
  } catch (error) {
    // Timeout or connection error - don't fail the health check
    checks.database = "timeout";
    logger.error("Health check DB timeout:", error);
  }

  // Always return 200 OK - uptime monitors need a consistent success response
  // The checks object shows component health details
  return NextResponse.json(
    {
      status: "healthy",
      timestamp,
      version: VERSION,
      checks,
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30",
      },
    }
  );
}
