import { checkBodySize, errorResponse, isValidString } from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export async function POST(request: Request) {
  // Check body size (10KB limit)
  const sizeCheck = checkBodySize(request);
  if (sizeCheck) return sizeCheck;

  // Rate limit to prevent abuse
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.auth, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  try {
    const { email, portal_id, source } = await request.json();

    // Validate email
    if (!isValidString(email, 3, 255) || !email.includes("@")) {
      return NextResponse.json(
        { error: "Valid email is required" },
        { status: 400 }
      );
    }

    // Normalize email (lowercase, trim)
    const normalizedEmail = email.toLowerCase().trim();

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Store in Supabase using service client (bypasses RLS)
    const serviceClient = createServiceClient();

    const { error: dbError } = await serviceClient
      .from("newsletter_subscribers")
      .upsert({
        email: normalizedEmail,
        portal_id: portal_id || null,
        source: source || "website",
        subscribed_at: new Date().toISOString(),
        unsubscribed_at: null, // Re-subscribe if previously unsubscribed
      } as never, {
        onConflict: "email",
      });

    if (dbError) {
      logger.error("Newsletter subscription DB error:", dbError);
      return errorResponse(dbError, "POST /api/newsletter");
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, "POST /api/newsletter");
  }
}
