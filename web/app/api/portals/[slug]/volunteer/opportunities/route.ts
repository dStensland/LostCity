import { NextRequest, NextResponse } from "next/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { errorApiResponse, parseIntParam } from "@/lib/api-utils";
import { resolvePortalSlugAlias } from "@/lib/portal-aliases";
import { getVolunteerOpportunitiesForPortal, getVolunteerProfileForUser } from "@/lib/volunteer-opportunities";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request),
  );
  if (rateLimitResult) return rateLimitResult;

  try {
    const { slug } = await context.params;
    const canonicalSlug = resolvePortalSlugAlias(slug);
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const searchParams = request.nextUrl.searchParams;

    const rawLimit = parseIntParam(searchParams.get("limit"), 24);
    if (rawLimit === null || rawLimit < 1 || rawLimit > 100) {
      return errorApiResponse("Invalid limit", 400);
    }

    const commitmentLevel = searchParams.get("commitment_level");
    if (
      commitmentLevel !== null
      && commitmentLevel !== "drop_in"
      && commitmentLevel !== "ongoing"
      && commitmentLevel !== "lead_role"
    ) {
      return errorApiResponse("Invalid commitment_level", 400);
    }

    const organizationSlug = searchParams.get("organization_slug") || undefined;
    const timeHorizon = searchParams.get("time_horizon");
    const onboardingLevel = searchParams.get("onboarding_level");
    const cause = searchParams.get("cause") || undefined;
    const query = searchParams.get("q") || undefined;
    const remoteParam = searchParams.get("remote_allowed");

    if (
      timeHorizon !== null
      && timeHorizon !== "one_day"
      && timeHorizon !== "multi_week"
      && timeHorizon !== "multi_month"
      && timeHorizon !== "ongoing"
    ) {
      return errorApiResponse("Invalid time_horizon", 400);
    }

    if (
      onboardingLevel !== null
      && onboardingLevel !== "none"
      && onboardingLevel !== "light"
      && onboardingLevel !== "screening_required"
      && onboardingLevel !== "training_required"
    ) {
      return errorApiResponse("Invalid onboarding_level", 400);
    }

    if (remoteParam !== null && remoteParam !== "true" && remoteParam !== "false") {
      return errorApiResponse("Invalid remote_allowed", 400);
    }

    const profile = user ? await getVolunteerProfileForUser(user.id) : null;

    const payload = await getVolunteerOpportunitiesForPortal({
      portalSlug: canonicalSlug,
      limit: rawLimit,
      commitmentLevel: commitmentLevel ?? undefined,
      organizationSlug,
      timeHorizon: timeHorizon ?? undefined,
      onboardingLevel: onboardingLevel ?? undefined,
      cause,
      query,
      remoteAllowed: remoteParam === null ? undefined : remoteParam === "true",
      profile,
    });

    if (!payload) {
      return errorApiResponse("Portal not found", 404);
    }

    return NextResponse.json(
      {
        portal: payload.portal,
        opportunities: payload.opportunities,
        summary: payload.summary,
        personalization: {
          applied: Boolean(profile),
          has_profile: Boolean(profile),
        },
        generated_at: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      },
    );
  } catch (error) {
    console.error("Error in volunteer opportunities GET:", error);
    return errorApiResponse("Failed to load volunteer opportunities", 500);
  }
}
