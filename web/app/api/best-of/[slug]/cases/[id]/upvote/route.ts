import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { isValidUUID } from "@/lib/api-utils";
import { ensureUserProfile } from "@/lib/user-utils";

/**
 * POST /api/best-of/[slug]/cases/[id]/upvote
 * Toggle upvote on a case
 */
export const POST = withAuth(async (request: NextRequest, { user, serviceClient }) => {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.write,
    user.id
  );
  if (rateLimitResult) return rateLimitResult;

  try {
    // Extract case ID from pathname
    const pathname = new URL(request.url).pathname;
    const casesMatch = pathname.match(/\/cases\/([^/]+)\/upvote/);
    const caseId = casesMatch?.[1];

    if (!caseId || !isValidUUID(caseId)) {
      return NextResponse.json({ error: "Invalid case ID" }, { status: 400 });
    }

    await ensureUserProfile(user, serviceClient);

    // Parallel: verify case exists + check existing upvote
    const [{ data: caseData }, { data: existing }] = await Promise.all([
      serviceClient
        .from("best_of_cases")
        .select("id, user_id")
        .eq("id", caseId)
        .maybeSingle(),
      serviceClient
        .from("best_of_case_upvotes")
        .select("id")
        .eq("user_id", user.id)
        .eq("case_id", caseId)
        .maybeSingle(),
    ]);

    if (!caseData) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }

    // Prevent self-upvote
    const caseRow = caseData as unknown as { id: string; user_id: string };
    if (caseRow.user_id === user.id) {
      return NextResponse.json({ error: "Cannot upvote your own case" }, { status: 400 });
    }

    if (existing) {
      // Toggle off
      const existingUpvote = existing as unknown as { id: string };
      await serviceClient
        .from("best_of_case_upvotes")
        .delete()
        .eq("id", existingUpvote.id);

      const { data: updated } = await serviceClient
        .from("best_of_cases")
        .select("upvote_count")
        .eq("id", caseId)
        .maybeSingle();

      const count = (updated as unknown as { upvote_count: number })?.upvote_count ?? 0;
      return NextResponse.json({ success: true, upvoted: false, upvoteCount: count });
    } else {
      // Toggle on
      const { error: insertError } = await serviceClient
        .from("best_of_case_upvotes")
        .insert({
          user_id: user.id,
          case_id: caseId,
        } as never);

      if (insertError) {
        if (insertError.code === "23505") {
          return NextResponse.json({ success: true, upvoted: true });
        }
        console.error("Case upvote error:", insertError);
        return NextResponse.json({ error: "Failed to upvote" }, { status: 500 });
      }

      const { data: updated } = await serviceClient
        .from("best_of_cases")
        .select("upvote_count")
        .eq("id", caseId)
        .maybeSingle();

      const count = (updated as unknown as { upvote_count: number })?.upvote_count ?? 0;
      return NextResponse.json({ success: true, upvoted: true, upvoteCount: count });
    }
  } catch (error) {
    console.error("Case upvote API error:", error);
    return NextResponse.json({ error: "Failed to toggle upvote" }, { status: 500 });
  }
});
