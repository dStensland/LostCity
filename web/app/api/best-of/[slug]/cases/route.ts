import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { checkBodySize, checkParsedBodySize, validationError, isValidUUID, sanitizeString } from "@/lib/api-utils";
import { ensureUserProfile } from "@/lib/user-utils";
import { CASE_MIN_LENGTH, CASE_MAX_LENGTH } from "@/lib/best-of";

/** Strip zero-width and control characters, then HTML-encode for defense-in-depth */
function sanitizeCaseContent(input: string): string {
  const cleaned = input
    .replace(/[\u200B-\u200D\uFEFF\u00AD\u2060\u180E]/g, "") // zero-width chars
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "") // control chars (keep \t \n \r)
    .trim();
  return sanitizeString(cleaned);
}

/**
 * POST /api/best-of/[slug]/cases
 * Write a "Make Your Case" blurb for a venue
 * Body: { categoryId: string, venueId: number, content: string }
 */
export const POST = withAuth(async (request: NextRequest, { user, serviceClient }) => {
  const sizeCheck = checkBodySize(request);
  if (sizeCheck) return sizeCheck;

  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.write,
    user.id
  );
  if (rateLimitResult) return rateLimitResult;

  try {
    const body = await request.json();
    const parsedSizeCheck = checkParsedBodySize(body);
    if (parsedSizeCheck) return parsedSizeCheck;
    const { categoryId, venueId, content } = body;

    if (!isValidUUID(categoryId)) {
      return validationError("Invalid categoryId");
    }
    if (!venueId || typeof venueId !== "number" || !Number.isInteger(venueId) || venueId <= 0) {
      return validationError("Invalid venueId");
    }
    if (!content || typeof content !== "string") {
      return validationError("Content is required");
    }

    const sanitized = sanitizeCaseContent(content);
    if (sanitized.length < CASE_MIN_LENGTH) {
      return validationError(`Case must be at least ${CASE_MIN_LENGTH} characters`);
    }
    if (sanitized.length > CASE_MAX_LENGTH) {
      return validationError(`Case must be at most ${CASE_MAX_LENGTH} characters`);
    }

    await ensureUserProfile(user, serviceClient);

    // Parallel validation: category + venue
    const [{ data: category }, { data: venue }] = await Promise.all([
      serviceClient
        .from("best_of_categories")
        .select("id, portal_id")
        .eq("id", categoryId)
        .eq("is_active", true)
        .maybeSingle(),
      serviceClient
        .from("venues")
        .select("id")
        .eq("id", venueId)
        .maybeSingle(),
    ]);

    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }
    if (!venue) {
      return NextResponse.json({ error: "Venue not found" }, { status: 404 });
    }

    // Upsert: if user already wrote a case for this venue+category, update it
    const { data: existing } = await serviceClient
      .from("best_of_cases")
      .select("id")
      .eq("user_id", user.id)
      .eq("category_id", categoryId)
      .eq("venue_id", venueId)
      .maybeSingle();

    if (existing) {
      const existingCase = existing as unknown as { id: string };
      const { error: updateError } = await serviceClient
        .from("best_of_cases")
        .update({
          content: sanitized,
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id", existingCase.id);

      if (updateError) {
        console.error("Case update error:", updateError);
        return NextResponse.json({ error: "Failed to update case" }, { status: 500 });
      }

      return NextResponse.json({ success: true, caseId: existingCase.id, updated: true });
    }

    // Insert new case
    const { data: newCase, error: insertError } = await serviceClient
      .from("best_of_cases")
      .insert({
        user_id: user.id,
        category_id: categoryId,
        venue_id: venueId,
        content: sanitized,
      } as never)
      .select("id")
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        return NextResponse.json({ success: true, updated: true });
      }
      console.error("Case insert error:", insertError);
      return NextResponse.json({ error: "Failed to create case" }, { status: 500 });
    }

    const caseRow = newCase as unknown as { id: string };
    return NextResponse.json({ success: true, caseId: caseRow.id, updated: false });
  } catch (error) {
    console.error("Case API error:", error);
    return NextResponse.json({ error: "Failed to process case" }, { status: 500 });
  }
});
