import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { withAuth } from "@/lib/api-middleware";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import {
  checkBodySize,
  isValidString,
  isValidStringArray,
  validationError,
  errorApiResponse,
  successResponse,
  createdResponse,
} from "@/lib/api-utils";
import { logger } from "@/lib/logger";
import { MAX_KIDS } from "@/lib/types/kid-profiles";
import type { KidProfile, CreateKidProfileRequest } from "@/lib/types/kid-profiles";

const VALID_SCHOOL_SYSTEMS = ["aps", "dekalb", "cobb", "gwinnett"] as const;
type SchoolSystem = (typeof VALID_SCHOOL_SYSTEMS)[number];

function isValidSchoolSystem(value: unknown): value is SchoolSystem {
  return (
    typeof value === "string" &&
    (VALID_SCHOOL_SYSTEMS as readonly string[]).includes(value)
  );
}

/**
 * GET /api/user/kids
 *
 * Returns all kid profiles for the authenticated user, ordered by creation date.
 */
export const GET = withAuth(async (_request: NextRequest, { user, serviceClient }) => {
  try {
    const { data, error } = await serviceClient
      .from("kid_profiles")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (error) {
      logger.error("Error fetching kid profiles", error, {
        userId: user.id,
        component: "user/kids GET",
      });
      return errorApiResponse("Failed to fetch kid profiles", 500);
    }

    return successResponse({ kids: (data ?? []) as KidProfile[] });
  } catch (error) {
    logger.error("Kid profiles GET error", error, { component: "user/kids GET" });
    return errorApiResponse("Internal server error", 500);
  }
});

/**
 * POST /api/user/kids
 *
 * Create a new kid profile for the authenticated user.
 * Enforces a maximum of MAX_KIDS profiles per account.
 */
export async function POST(request: NextRequest): Promise<NextResponse | Response> {
  const sizeCheck = checkBodySize(request, 10 * 1024);
  if (sizeCheck) return sizeCheck;

  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.write,
    getClientIdentifier(request)
  );
  if (rateLimitResult) return rateLimitResult;

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorApiResponse("Unauthorized", 401);
    }

    const serviceClient = createServiceClient();
    const body = (await request.json()) as Partial<CreateKidProfileRequest>;
    const { nickname, age, color, emoji, school_system, interests } = body;

    // Required field validation
    if (!isValidString(nickname, 1, 50)) {
      return validationError("nickname is required and must be 1–50 characters");
    }
    if (
      typeof age !== "number" ||
      !Number.isInteger(age) ||
      age < 0 ||
      age > 18
    ) {
      return validationError(
        "age is required and must be an integer between 0 and 18"
      );
    }
    if (!isValidString(color, 4, 9)) {
      return validationError(
        "color is required and must be a hex color (e.g. #4A7DB5)"
      );
    }

    // Optional field validation
    if (emoji != null && !isValidString(emoji, 1, 10)) {
      return validationError("emoji must be 1–10 characters");
    }
    if (school_system != null && !isValidSchoolSystem(school_system)) {
      return validationError(
        "school_system must be one of: aps, dekalb, cobb, gwinnett"
      );
    }
    if (interests != null && !isValidStringArray(interests, 20, 50)) {
      return validationError("interests must be an array of up to 20 strings");
    }

    // Enforce MAX_KIDS limit
    const { count, error: countError } = await serviceClient
      .from("kid_profiles")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);

    if (countError) {
      logger.error("Error counting kid profiles", countError, {
        userId: user.id,
        component: "user/kids POST",
      });
      return errorApiResponse("Failed to validate kid count", 500);
    }

    if ((count ?? 0) >= MAX_KIDS) {
      return errorApiResponse(`Maximum of ${MAX_KIDS} kid profiles allowed`, 422);
    }

    // Insert
    const { data, error } = await serviceClient
      .from("kid_profiles")
      .insert({
        user_id: user.id,
        nickname: (nickname as string).trim(),
        age,
        color,
        ...(emoji != null && { emoji }),
        ...(school_system != null && { school_system }),
        ...(interests != null && { interests }),
      } as never)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return errorApiResponse("A kid with that nickname already exists", 409);
      }
      logger.error("Error creating kid profile", error, {
        userId: user.id,
        component: "user/kids POST",
      });
      return errorApiResponse("Failed to create kid profile", 500);
    }

    return createdResponse({ kid: data as KidProfile });
  } catch (error) {
    logger.error("Kid profiles POST error", error, { component: "user/kids POST" });
    return errorApiResponse("Internal server error", 500);
  }
}
