import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { checkBodySize, validationError, isValidUUID } from "@/lib/api-utils";
import { ensureUserProfile } from "@/lib/user-utils";

const MAX_NOMINATIONS_PER_USER_PER_CATEGORY = 3;

/**
 * POST /api/best-of/[slug]/nominate
 * Nominate a venue for a category
 * Body: { categoryId: string, venueId: number }
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
    const { categoryId, venueId } = body;

    if (!isValidUUID(categoryId)) {
      return validationError("Invalid categoryId");
    }
    if (!venueId || typeof venueId !== "number" || !Number.isInteger(venueId) || venueId <= 0) {
      return validationError("Invalid venueId");
    }

    await ensureUserProfile(user, serviceClient);

    // Parallel validation: category + venue + existing nomination + user quota
    const [{ data: category }, { data: venue }, { data: existing }, { count: userNomCount }] = await Promise.all([
      serviceClient
        .from("best_of_categories")
        .select("id, portal_id")
        .eq("id", categoryId)
        .eq("is_active", true)
        .maybeSingle(),
      serviceClient
        .from("venues")
        .select("id, city")
        .eq("id", venueId)
        .maybeSingle(),
      serviceClient
        .from("best_of_nominations")
        .select("id")
        .eq("category_id", categoryId)
        .eq("venue_id", venueId)
        .maybeSingle(),
      serviceClient
        .from("best_of_nominations")
        .select("*", { count: "exact", head: true })
        .eq("category_id", categoryId)
        .eq("user_id", user.id),
    ]);

    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }
    if (!venue) {
      return NextResponse.json({ error: "Venue not found" }, { status: 404 });
    }

    // Portal-venue scoping: verify venue belongs to same portal city
    const catRow = category as unknown as { id: string; portal_id: string };
    const venueRow = venue as unknown as { id: number; city: string | null };
    if (catRow.portal_id) {
      const { data: portal } = await serviceClient
        .from("portals")
        .select("filters")
        .eq("id", catRow.portal_id)
        .maybeSingle();
      const portalRow = portal as unknown as { filters: { city?: string } | null } | null;
      const portalCity = portalRow?.filters?.city;
      if (portalCity && venueRow.city && venueRow.city.toLowerCase() !== portalCity.toLowerCase()) {
        return NextResponse.json({ error: "Venue is not in this portal's city" }, { status: 400 });
      }
    }

    if (existing) {
      return NextResponse.json({ error: "Venue already nominated" }, { status: 409 });
    }
    if ((userNomCount ?? 0) >= MAX_NOMINATIONS_PER_USER_PER_CATEGORY) {
      return NextResponse.json(
        { error: `You can nominate up to ${MAX_NOMINATIONS_PER_USER_PER_CATEGORY} venues per category` },
        { status: 429 }
      );
    }

    // Insert nomination as pending — requires admin approval or threshold
    const { error: insertError } = await serviceClient
      .from("best_of_nominations")
      .insert({
        user_id: user.id,
        category_id: categoryId,
        venue_id: venueId,
        status: "pending",
      } as never);

    if (insertError) {
      if (insertError.code === "23505") {
        return NextResponse.json({ error: "Venue already nominated" }, { status: 409 });
      }
      console.error("Nomination insert error:", insertError);
      return NextResponse.json({ error: "Failed to nominate" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Nominate API error:", error);
    return NextResponse.json({ error: "Failed to process nomination" }, { status: 500 });
  }
});
