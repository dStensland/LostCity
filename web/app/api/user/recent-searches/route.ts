import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/api-middleware";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { normalizeSearchQuery } from "@/lib/search/normalize";

const MAX_RECENT_PER_USER = 50;

const InsertSchema = z.object({
  query: z.string().min(1).max(120),
  filters: z
    .object({
      types: z.array(z.string().max(32)).max(8).optional(),
      categories: z.array(z.string().max(32)).max(20).optional(),
      date: z.enum(["today", "tomorrow", "weekend", "week"]).nullable().optional(),
    })
    .optional(),
});

const DeleteSchema = z
  .object({
    id: z.string().uuid().optional(),
    clearAll: z.boolean().optional(),
  })
  .refine((v) => Boolean(v.id) !== Boolean(v.clearAll), {
    message: "Provide exactly one of id or clearAll",
  });

/**
 * CSRF defense via Origin header check. SameSite=Lax cookies (the Supabase
 * SSR default) block classic form-POST CSRF but NOT cross-site fetch() with
 * credentials. An explicit Origin header comparison catches the latter.
 */
function isAllowedOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false; // reject if no Origin (modern browsers always send it on non-GET)
  try {
    return new URL(origin).host === request.nextUrl.host;
  } catch {
    return false;
  }
}

export const dynamic = "force-dynamic";
export const maxDuration = 5;

/**
 * POST /api/user/recent-searches
 *
 * Insert a recent search for the authenticated user. The underlying RPC
 * (insert_recent_search) enforces auth.uid() === p_user_id per Sprint B's
 * R3 fix — defense in depth. Rotation keeps at most 50 per user.
 */
export const POST = withAuth(async (request: NextRequest, { user, serviceClient }) => {
  if (!isAllowedOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const rl = await applyRateLimit(request, RATE_LIMITS.write, `user:${user.id}`);
  if (rl) return rl;

  let body;
  try {
    body = InsertSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid input", detail: err instanceof Error ? err.message : "unknown" },
      { status: 400 }
    );
  }

  const normalized = normalizeSearchQuery(body.query);
  if (!normalized) {
    return NextResponse.json({ error: "Empty query after normalization" }, { status: 400 });
  }

  const { error } = await serviceClient.rpc("insert_recent_search", {
    p_user_id: user.id,
    p_query: normalized,
    p_filters: body.filters ?? null,
    p_max_rows: MAX_RECENT_PER_USER,
  } as never);
  if (error) {
    return NextResponse.json({ error: "insert_failed", detail: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
});

/**
 * DELETE /api/user/recent-searches
 *
 * Remove one entry (by id) OR clear all entries for the authenticated user.
 * GDPR cascade is handled at the DB level via ON DELETE CASCADE on the
 * user_id FK — this endpoint is for user-initiated cleanup, not account
 * deletion.
 */
export const DELETE = withAuth(async (request: NextRequest, { user, serviceClient }) => {
  if (!isAllowedOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const rl = await applyRateLimit(request, RATE_LIMITS.write, `user:${user.id}`);
  if (rl) return rl;

  let body;
  try {
    body = DeleteSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid input", detail: err instanceof Error ? err.message : "unknown" },
      { status: 400 }
    );
  }

  // Destructure { error } off the Supabase response and fail loudly on
  // any DB error. Previously this handler ignored the response entirely —
  // a failed DELETE would return 200/ok:true and the client would
  // optimistically remove the row from its local state, leaving the DB
  // out of sync. E-3.6 fixes that.
  let error: { message: string } | null = null;
  if (body.clearAll) {
    ({ error } = await serviceClient
      .from("user_recent_searches")
      .delete()
      .eq("user_id", user.id));
  } else if (body.id) {
    ({ error } = await serviceClient
      .from("user_recent_searches")
      .delete()
      .eq("user_id", user.id)
      .eq("id", body.id));
  }

  if (error) {
    return NextResponse.json(
      { error: "delete_failed", detail: error.message },
      { status: 500 }
    );
  }

  return new NextResponse(null, { status: 204 });
});
