import { NextRequest, NextResponse } from "next/server";
import { canManagePortal } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  adminErrorResponse,
  checkBodySize,
  checkParsedBodySize,
  isValidString,
  isValidUUID,
  type AnySupabase,
} from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { mapContestRow, type BestOfContest } from "@/lib/best-of-contests";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string; contestId: string }>;
};

const VALID_STATUSES = ['draft', 'active', 'completed', 'archived'] as const;

function isValidStatus(value: unknown): value is BestOfContest['status'] {
  return typeof value === 'string' && (VALID_STATUSES as readonly string[]).includes(value);
}

function isValidDateString(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const d = new Date(value);
  return !isNaN(d.getTime());
}

async function requirePortalAccess(portalId: string, context: string) {
  if (!isValidUUID(portalId)) {
    return { response: NextResponse.json({ error: "Invalid portal id" }, { status: 400 }) };
  }

  if (!(await canManagePortal(portalId))) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const db = createServiceClient() as unknown as AnySupabase;
  const { data: portal, error } = await db
    .from("portals")
    .select("id, slug, name")
    .eq("id", portalId)
    .maybeSingle();

  if (error) {
    return { response: adminErrorResponse(error, context), db };
  }

  if (!portal) {
    return { response: NextResponse.json({ error: "Portal not found" }, { status: 404 }), db };
  }

  return { db, portal };
}

async function getContest(db: AnySupabase, portalId: string, contestId: string, context: string) {
  if (!isValidUUID(contestId)) {
    return { response: NextResponse.json({ error: "Invalid contest id" }, { status: 400 }) };
  }

  const { data, error } = await db
    .from("best_of_contests")
    .select("id, category_id, portal_id, slug, title, prompt, description, cover_image_url, accent_color, starts_at, ends_at, status, winner_venue_id, winner_snapshot, winner_announced_at, created_by, created_at, updated_at")
    .eq("id", contestId)
    .eq("portal_id", portalId)
    .maybeSingle();

  if (error) {
    return { response: adminErrorResponse(error, context) };
  }

  if (!data) {
    return { response: NextResponse.json({ error: "Contest not found" }, { status: 404 }) };
  }

  return { contestRow: data as Record<string, unknown> };
}

/**
 * GET /api/admin/portals/[id]/contests/[contestId]
 * Single contest detail
 */
export async function GET(request: NextRequest, { params }: Props) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { id: portalId, contestId } = await params;
  const access = await requirePortalAccess(portalId, "GET /api/admin/portals/[id]/contests/[contestId] (portal)");
  if (access.response) return access.response;
  const { db } = access;

  const result = await getContest(db, portalId, contestId, "GET /api/admin/portals/[id]/contests/[contestId]");
  if (result.response) return result.response;

  const contest = mapContestRow(result.contestRow);

  return NextResponse.json({ contest });
}

/**
 * PATCH /api/admin/portals/[id]/contests/[contestId]
 * Update contest fields: title, prompt, description, dates, status, cover image, accent color
 * When activating, verifies no other active contest exists (the DB partial unique index enforces
 * this at the DB layer, but we surface a friendlier error message here)
 */
export async function PATCH(request: NextRequest, { params }: Props) {
  const sizeCheck = checkBodySize(request, 32_768);
  if (sizeCheck) return sizeCheck;

  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { id: portalId, contestId } = await params;
  const access = await requirePortalAccess(portalId, "PATCH /api/admin/portals/[id]/contests/[contestId] (portal)");
  if (access.response) return access.response;
  const { db } = access;

  const contestResult = await getContest(db, portalId, contestId, "PATCH /api/admin/portals/[id]/contests/[contestId] (fetch)");
  if (contestResult.response) return contestResult.response;

  const currentContest = mapContestRow(contestResult.contestRow);

  let body: {
    title?: string;
    prompt?: string | null;
    description?: string | null;
    coverImageUrl?: string | null;
    accentColor?: string | null;
    startsAt?: string;
    endsAt?: string;
    status?: string;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsedSizeCheck = checkParsedBodySize(body, 32_768);
  if (parsedSizeCheck) return parsedSizeCheck;

  const updates: Record<string, unknown> = {};

  if (body.title !== undefined) {
    if (!isValidString(body.title, 1, 200)) {
      return NextResponse.json({ error: "title must be 1-200 characters" }, { status: 400 });
    }
    updates.title = body.title;
  }

  if (body.prompt !== undefined) {
    if (body.prompt !== null && !isValidString(body.prompt, 1, 500)) {
      return NextResponse.json({ error: "prompt must be 1-500 characters when provided" }, { status: 400 });
    }
    updates.prompt = body.prompt;
  }

  if (body.description !== undefined) {
    if (body.description !== null && !isValidString(body.description, 1, 2000)) {
      return NextResponse.json({ error: "description must be 1-2000 characters when provided" }, { status: 400 });
    }
    updates.description = body.description;
  }

  if (body.coverImageUrl !== undefined) {
    updates.cover_image_url = body.coverImageUrl;
  }

  if (body.accentColor !== undefined) {
    if (body.accentColor !== null && !/^#[0-9a-fA-F]{3,8}$/.test(body.accentColor)) {
      return NextResponse.json({ error: "accentColor must be a valid hex color (e.g. #FF6B7A)" }, { status: 400 });
    }
    updates.accent_color = body.accentColor;
  }

  if (body.startsAt !== undefined) {
    if (!isValidDateString(body.startsAt)) {
      return NextResponse.json({ error: "startsAt must be a valid ISO date string" }, { status: 400 });
    }
    updates.starts_at = body.startsAt;
  }

  if (body.endsAt !== undefined) {
    if (!isValidDateString(body.endsAt)) {
      return NextResponse.json({ error: "endsAt must be a valid ISO date string" }, { status: 400 });
    }
    updates.ends_at = body.endsAt;
  }

  // Cross-validate date ordering if either date is changing
  const effectiveStartsAt = (updates.starts_at as string) ?? currentContest.startsAt;
  const effectiveEndsAt = (updates.ends_at as string) ?? currentContest.endsAt;
  if (new Date(effectiveEndsAt) <= new Date(effectiveStartsAt)) {
    return NextResponse.json({ error: "endsAt must be after startsAt" }, { status: 400 });
  }

  if (body.status !== undefined) {
    if (!isValidStatus(body.status)) {
      return NextResponse.json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 });
    }

    // Guard against activating when another contest is already active
    if (body.status === 'active' && currentContest.status !== 'active') {
      const { data: existingActive } = await db
        .from("best_of_contests")
        .select("id, slug, title")
        .eq("portal_id", portalId)
        .eq("status", "active")
        .neq("id", contestId)
        .maybeSingle();

      if (existingActive) {
        const row = existingActive as { id: string; slug: string; title: string };
        return NextResponse.json({
          error: `Another contest is already active for this portal: "${row.title}" (${row.slug}). Complete or archive it first.`,
        }, { status: 409 });
      }
    }

    updates.status = body.status;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  updates.updated_at = new Date().toISOString();

  const { data: updatedData, error: updateError } = await db
    .from("best_of_contests")
    .update(updates as never)
    .eq("id", contestId)
    .eq("portal_id", portalId)
    .select("id, category_id, portal_id, slug, title, prompt, description, cover_image_url, accent_color, starts_at, ends_at, status, winner_venue_id, winner_snapshot, winner_announced_at, created_by, created_at, updated_at")
    .maybeSingle();

  if (updateError) {
    const code = typeof updateError === "object" && updateError && "code" in updateError
      ? String((updateError as { code?: unknown }).code) : null;
    // Partial unique index violation: only one active contest per portal
    if (code === "23505") {
      return NextResponse.json({
        error: "Another contest is already active for this portal. Complete or archive it first.",
      }, { status: 409 });
    }
    return adminErrorResponse(updateError, "PATCH /api/admin/portals/[id]/contests/[contestId] (update)");
  }

  if (!updatedData) {
    return NextResponse.json({ error: "Contest not found" }, { status: 404 });
  }

  const contest = mapContestRow(updatedData as Record<string, unknown>);

  return NextResponse.json({ contest });
}
