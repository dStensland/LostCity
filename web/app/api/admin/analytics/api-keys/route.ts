import { createClient } from "@/lib/supabase/server";
import { isAdmin, getUser } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { adminErrorResponse, checkBodySize } from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier} from "@/lib/rate-limit";
import { ENABLE_EXTERNAL_ANALYTICS_API } from "@/lib/launch-flags";

export const dynamic = "force-dynamic";

function apiDisabledResponse() {
  return NextResponse.json(
    { error: "External analytics API is disabled until post-launch." },
    { status: 404 }
  );
}

type ApiKeyRecord = {
  id: string;
  key_prefix: string;
  name: string;
  portal_id: string | null;
  scopes: string[];
  is_active: boolean;
  last_used_at: string | null;
  expires_at: string | null;
  created_by: string | null;
  created_at: string;
  portal?: { id: string; name: string; slug: string } | null;
  creator?: { id: string; username: string } | null;
};

// GET: List all API keys
export async function GET(request: NextRequest) {
  if (!ENABLE_EXTERNAL_ANALYTICS_API) return apiDisabledResponse();

  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.standard, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const supabase = await createClient();

  // Verify admin
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Get all API keys with portal and creator info
  const { data: keys, error } = await supabase
    .from("api_keys")
    .select(`
      id, key_prefix, name, portal_id, scopes, is_active,
      last_used_at, expires_at, created_by, created_at
    `)
    .order("created_at", { ascending: false });

  if (error) {
    // Table might not exist yet
    if (error.code === "42P01") {
      return NextResponse.json({ keys: [], message: "API keys table not yet created. Run migration 038." });
    }
    return adminErrorResponse(error, "GET /api/admin/analytics/api-keys");
  }

  // Get portal and creator names
  const portalIds = [...new Set((keys || []).map((k: ApiKeyRecord) => k.portal_id).filter(Boolean))];
  const creatorIds = [...new Set((keys || []).map((k: ApiKeyRecord) => k.created_by).filter(Boolean))];

  const portalMap = new Map<string, { id: string; name: string; slug: string }>();
  const creatorMap = new Map<string, { id: string; username: string }>();

  if (portalIds.length > 0) {
    const { data: portals } = await supabase
      .from("portals")
      .select("id, name, slug")
      .in("id", portalIds as string[]);

    for (const p of (portals || []) as { id: string; name: string; slug: string }[]) {
      portalMap.set(p.id, p);
    }
  }

  if (creatorIds.length > 0) {
    const { data: creators } = await supabase
      .from("profiles")
      .select("id, username")
      .in("id", creatorIds as string[]);

    for (const c of (creators || []) as { id: string; username: string }[]) {
      creatorMap.set(c.id, c);
    }
  }

  // Enrich keys with portal and creator info
  const enrichedKeys = (keys || []).map((k: ApiKeyRecord) => ({
    ...k,
    portal: k.portal_id ? portalMap.get(k.portal_id) || null : null,
    creator: k.created_by ? creatorMap.get(k.created_by) || null : null,
  }));

  return NextResponse.json({
    keys: enrichedKeys,
    summary: {
      total: enrichedKeys.length,
      active: enrichedKeys.filter((k: ApiKeyRecord) => k.is_active).length,
      expired: enrichedKeys.filter((k: ApiKeyRecord) => k.expires_at && new Date(k.expires_at) < new Date()).length,
    },
  });
}

// POST: Create new API key
export async function POST(request: NextRequest) {
  if (!ENABLE_EXTERNAL_ANALYTICS_API) return apiDisabledResponse();

  // Check body size
  const bodySizeError = checkBodySize(request);
  if (bodySizeError) return bodySizeError;

  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.standard, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const supabase = await createClient();

  // Verify admin
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { name?: string; portal_id?: string; scopes?: string[]; expires_in_days?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { name, portal_id, scopes = ["analytics:read"], expires_in_days } = body;

  if (!name || name.trim().length === 0) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  // Generate API key: lc_ + 32 random bytes as hex = 72 chars total
  const randomPart = randomBytes(32).toString("hex");
  const apiKey = `lc_${randomPart}`;
  const keyPrefix = apiKey.substring(0, 8); // "lc_xxxxx"
  const keyHash = createHash("sha256").update(apiKey).digest("hex");

  // Calculate expiry if specified
  let expiresAt: string | null = null;
  if (expires_in_days && expires_in_days > 0) {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + expires_in_days);
    expiresAt = expiry.toISOString();
  }

  // Insert the key (cast to any since api_keys table isn't in generated types yet)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: newKey, error } = await (supabase as any)
    .from("api_keys")
    .insert({
      key_hash: keyHash,
      key_prefix: keyPrefix,
      name: name.trim(),
      portal_id: portal_id || null,
      scopes,
      is_active: true,
      expires_at: expiresAt,
      created_by: user.id,
    })
    .select("id, key_prefix, name, portal_id, scopes, is_active, expires_at, created_at")
    .maybeSingle();

  if (error) {
    if (error.code === "42P01") {
      return NextResponse.json({ error: "API keys table not yet created. Run migration 038." }, { status: 500 });
    }
    return adminErrorResponse(error, "GET /api/admin/analytics/api-keys");
  }

  // Return the key record AND the actual key (shown only once)
  return NextResponse.json({
    key: newKey,
    api_key: apiKey, // Only returned on creation!
    message: "API key created. Save this key - it will not be shown again.",
  }, { status: 201 });
}

// DELETE: Revoke an API key
export async function DELETE(request: NextRequest) {
  if (!ENABLE_EXTERNAL_ANALYTICS_API) return apiDisabledResponse();

  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.standard, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const supabase = await createClient();

  // Verify admin
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const keyId = searchParams.get("id");

  if (!keyId) {
    return NextResponse.json({ error: "Key ID is required" }, { status: 400 });
  }

  // Soft delete by deactivating
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("api_keys")
    .update({ is_active: false })
    .eq("id", keyId);

  if (error) {
    return adminErrorResponse(error, "GET /api/admin/analytics/api-keys");
  }

  return NextResponse.json({ message: "API key revoked successfully" });
}

// PATCH: Update an API key (name, scopes, expiry)
export async function PATCH(request: NextRequest) {
  if (!ENABLE_EXTERNAL_ANALYTICS_API) return apiDisabledResponse();

  // Check body size
  const bodySizeError = checkBodySize(request);
  if (bodySizeError) return bodySizeError;

  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.standard, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const supabase = await createClient();

  // Verify admin
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  let body: { id?: string; name?: string; scopes?: string[]; is_active?: boolean; expires_at?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { id, name, scopes, is_active, expires_at } = body;

  if (!id) {
    return NextResponse.json({ error: "Key ID is required" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name.trim();
  if (scopes !== undefined) updates.scopes = scopes;
  if (is_active !== undefined) updates.is_active = is_active;
  if (expires_at !== undefined) updates.expires_at = expires_at;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No updates provided" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updatedKey, error } = await (supabase as any)
    .from("api_keys")
    .update(updates)
    .eq("id", id)
    .select("id, key_prefix, name, portal_id, scopes, is_active, expires_at, last_used_at, created_at")
    .maybeSingle();

  if (error) {
    return adminErrorResponse(error, "GET /api/admin/analytics/api-keys");
  }

  return NextResponse.json({ key: updatedKey });
}
