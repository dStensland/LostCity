import { NextRequest, NextResponse } from "next/server";
import { withAuthAndParams } from "@/lib/api-middleware";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import {
  checkBodySize,
  isValidString,
  isValidStringArray,
  isValidUUID,
  validationError,
  errorApiResponse,
  successResponse,
} from "@/lib/api-utils";
import { logger } from "@/lib/logger";
import type { KidProfile, UpdateKidProfileRequest } from "@/lib/types/kid-profiles";

const VALID_SCHOOL_SYSTEMS = ["aps", "dekalb", "cobb", "gwinnett"] as const;

function isValidSchoolSystem(value: unknown): boolean {
  return (
    typeof value === "string" &&
    (VALID_SCHOOL_SYSTEMS as readonly string[]).includes(value)
  );
}

/**
 * PATCH /api/user/kids/[id]
 *
 * Update a kid profile. Verifies ownership via user_id match before writing.
 */
export const PATCH = async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse | Response> => {
  const sizeCheck = checkBodySize(request, 10 * 1024);
  if (sizeCheck) return sizeCheck;

  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.write,
    getClientIdentifier(request)
  );
  if (rateLimitResult) return rateLimitResult;

  return withAuthAndParams<{ id: string }>(
    async (req: NextRequest, { user, serviceClient, params }) => {
      const { id } = params;

      if (!isValidUUID(id)) {
        return validationError("Invalid kid profile id");
      }

      try {
        const body = (await req.json()) as Partial<UpdateKidProfileRequest>;
        const { nickname, age, color, emoji, school_system, interests } = body;

        // Nothing to update
        if (
          nickname === undefined &&
          age === undefined &&
          color === undefined &&
          emoji === undefined &&
          school_system === undefined &&
          interests === undefined
        ) {
          return validationError("No fields provided to update");
        }

        // Optional field validation — only validate fields that are present
        if (nickname !== undefined && !isValidString(nickname, 1, 50)) {
          return validationError("nickname must be 1–50 characters");
        }
        if (
          age !== undefined &&
          (typeof age !== "number" || !Number.isInteger(age) || age < 0 || age > 18)
        ) {
          return validationError("age must be an integer between 0 and 18");
        }
        if (color !== undefined && !isValidString(color, 4, 9)) {
          return validationError("color must be a hex color (e.g. #4A7DB5)");
        }
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

        // Verify ownership by filtering on both id AND user_id
        const { data, error } = await serviceClient
          .from("kid_profiles")
          .update({
            ...(nickname !== undefined && { nickname: nickname.trim() }),
            ...(age !== undefined && { age }),
            ...(color !== undefined && { color }),
            ...(emoji !== undefined && { emoji }),
            ...(school_system !== undefined && { school_system }),
            ...(interests !== undefined && { interests }),
          } as never)
          .eq("id", id)
          .eq("user_id", user.id)
          .select()
          .single();

        if (error) {
          if (error.code === "23505") {
            return errorApiResponse("A kid with that nickname already exists", 409);
          }
          if (error.code === "PGRST116") {
            // No rows matched — either doesn't exist or belongs to another user
            return errorApiResponse("Kid profile not found", 404);
          }
          logger.error("Error updating kid profile", error, {
            userId: user.id,
            kidId: id,
            component: "user/kids/[id] PATCH",
          });
          return errorApiResponse("Failed to update kid profile", 500);
        }

        return successResponse({ kid: data as KidProfile });
      } catch (error) {
        logger.error("Kid profile PATCH error", error, {
          component: "user/kids/[id] PATCH",
        });
        return errorApiResponse("Internal server error", 500);
      }
    }
  )(request, context);
};

/**
 * DELETE /api/user/kids/[id]
 *
 * Delete a kid profile. Verifies ownership via user_id match before deleting.
 */
export const DELETE = async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse | Response> => {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.write,
    getClientIdentifier(request)
  );
  if (rateLimitResult) return rateLimitResult;

  return withAuthAndParams<{ id: string }>(
    async (_req: NextRequest, { user, serviceClient, params }) => {
      const { id } = params;

      if (!isValidUUID(id)) {
        return validationError("Invalid kid profile id");
      }

      try {
        const { error, count } = await serviceClient
          .from("kid_profiles")
          .delete({ count: "exact" })
          .eq("id", id)
          .eq("user_id", user.id);

        if (error) {
          logger.error("Error deleting kid profile", error, {
            userId: user.id,
            kidId: id,
            component: "user/kids/[id] DELETE",
          });
          return errorApiResponse("Failed to delete kid profile", 500);
        }

        if ((count ?? 0) === 0) {
          return errorApiResponse("Kid profile not found", 404);
        }

        return successResponse({ success: true });
      } catch (error) {
        logger.error("Kid profile DELETE error", error, {
          component: "user/kids/[id] DELETE",
        });
        return errorApiResponse("Internal server error", 500);
      }
    }
  )(request, context);
};
