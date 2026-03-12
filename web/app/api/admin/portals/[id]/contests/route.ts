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
  params: Promise<{ id: string }>;
};

const VALID_STATUSES = ['draft', 'active', 'completed', 'archived'] as const;

function isValidStatus(value: unknown): value is BestOfContest['status'] {
  return typeof value === 'string' && (VALID_STATUSES as readonly string[]).includes(value);
}

function isValidSlug(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length >= 2 && value.length <= 120;
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

/**
 * GET /api/admin/portals/[id]/contests
 * List all contests for a portal (all statuses), ordered by created_at DESC
 */
export async function GET(request: NextRequest, { params }: Props) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { id: portalId } = await params;
  const access = await requirePortalAccess(portalId, "GET /api/admin/portals/[id]/contests (portal)");
  if (access.response) return access.response;
  const { db } = access;

  const { data: rows, error } = await db
    .from("best_of_contests")
    .select("id, category_id, portal_id, slug, title, prompt, description, cover_image_url, accent_color, starts_at, ends_at, status, winner_venue_id, winner_snapshot, winner_announced_at, created_by, created_at, updated_at")
    .eq("portal_id", portalId)
    .order("created_at", { ascending: false });

  if (error) {
    return adminErrorResponse(error, "GET /api/admin/portals/[id]/contests (list)");
  }

  const contests = (rows ?? []).map((r) => mapContestRow(r as Record<string, unknown>));

  return NextResponse.json({ contests });
}

/**
 * POST /api/admin/portals/[id]/contests
 * Create a new contest for a portal
 * Validates that the category belongs to this portal
 */
export async function POST(request: NextRequest, { params }: Props) {
  const sizeCheck = checkBodySize(request, 32_768);
  if (sizeCheck) return sizeCheck;

  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { id: portalId } = await params;
  const access = await requirePortalAccess(portalId, "POST /api/admin/portals/[id]/contests (portal)");
  if (access.response) return access.response;
  const { db } = access;

  let body: {
    categoryId?: string;
    slug?: string;
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

  // Validate required fields
  if (!isValidUUID(body.categoryId)) {
    return NextResponse.json({ error: "categoryId must be a valid UUID" }, { status: 400 });
  }
  if (!isValidSlug(body.slug)) {
    return NextResponse.json({ error: "slug must be kebab-case and 2-120 characters" }, { status: 400 });
  }
  if (!isValidString(body.title, 1, 200)) {
    return NextResponse.json({ error: "title is required (1-200 characters)" }, { status: 400 });
  }
  if (!isValidDateString(body.startsAt)) {
    return NextResponse.json({ error: "startsAt must be a valid ISO date string" }, { status: 400 });
  }
  if (!isValidDateString(body.endsAt)) {
    return NextResponse.json({ error: "endsAt must be a valid ISO date string" }, { status: 400 });
  }
  if (new Date(body.endsAt!) <= new Date(body.startsAt!)) {
    return NextResponse.json({ error: "endsAt must be after startsAt" }, { status: 400 });
  }

  // Optional field validation
  if (body.prompt !== undefined && body.prompt !== null && !isValidString(body.prompt, 1, 500)) {
    return NextResponse.json({ error: "prompt must be 1-500 characters when provided" }, { status: 400 });
  }
  if (body.description !== undefined && body.description !== null && !isValidString(body.description, 1, 2000)) {
    return NextResponse.json({ error: "description must be 1-2000 characters when provided" }, { status: 400 });
  }
  if (body.accentColor !== undefined && body.accentColor !== null) {
    if (!/^#[0-9a-fA-F]{3,8}$/.test(body.accentColor)) {
      return NextResponse.json({ error: "accentColor must be a valid hex color (e.g. #FF6B7A)" }, { status: 400 });
    }
  }
  if (body.status !== undefined && !isValidStatus(body.status)) {
    return NextResponse.json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 });
  }

  // Verify category belongs to this portal
  const { data: categoryRow, error: catError } = await db
    .from("best_of_categories")
    .select("id, name")
    .eq("id", body.categoryId)
    .eq("portal_id", portalId)
    .maybeSingle();

  if (catError) {
    return adminErrorResponse(catError, "POST /api/admin/portals/[id]/contests (category lookup)");
  }
  if (!categoryRow) {
    return NextResponse.json({ error: "Category not found or does not belong to this portal" }, { status: 400 });
  }

  const { data: contestData, error: createError } = await db
    .from("best_of_contests")
    .insert({
      category_id: body.categoryId,
      portal_id: portalId,
      slug: body.slug,
      title: body.title,
      prompt: body.prompt ?? null,
      description: body.description ?? null,
      cover_image_url: body.coverImageUrl ?? null,
      accent_color: body.accentColor ?? null,
      starts_at: body.startsAt,
      ends_at: body.endsAt,
      status: body.status ?? 'draft',
    } as never)
    .select("id, category_id, portal_id, slug, title, prompt, description, cover_image_url, accent_color, starts_at, ends_at, status, winner_venue_id, winner_snapshot, winner_announced_at, created_by, created_at, updated_at")
    .maybeSingle();

  if (createError) {
    const code = typeof createError === "object" && createError && "code" in createError
      ? String((createError as { code?: unknown }).code) : null;
    if (code === "23505") {
      return NextResponse.json({ error: "Contest slug already exists for this portal" }, { status: 409 });
    }
    // DB-level trigger fires if category doesn't match portal
    if (code === "P0001" || (createError as { message?: string }).message?.includes("Category does not belong")) {
      return NextResponse.json({ error: "Category does not belong to contest portal" }, { status: 400 });
    }
    return adminErrorResponse(createError, "POST /api/admin/portals/[id]/contests (insert)");
  }

  if (!contestData) {
    return NextResponse.json({ error: "Failed to create contest" }, { status: 500 });
  }

  const contest = mapContestRow(contestData as Record<string, unknown>);

  return NextResponse.json({ contest }, { status: 201 });
}
