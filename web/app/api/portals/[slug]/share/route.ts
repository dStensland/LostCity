import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getUser } from "@/lib/supabase/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { checkBodySize, isValidEnum } from "@/lib/api-utils";
import { resolvePortalSlugAlias } from "@/lib/portal-aliases";

const VALID_SHARE_METHODS = ["native", "clipboard", "unknown"] as const;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.standard, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const sizeCheck = checkBodySize(request, 2048);
  if (sizeCheck) return sizeCheck;

  const { slug } = await params;
  const canonicalSlug = resolvePortalSlugAlias(slug);
  let body: { event_id?: unknown; method?: unknown };

  try {
    body = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }

  const eventId = typeof body.event_id === "number" && Number.isInteger(body.event_id) && body.event_id > 0
    ? body.event_id
    : null;

  if (!eventId) {
    return new Response(null, { status: 400 });
  }

  const shareMethod = isValidEnum(body.method, VALID_SHARE_METHODS) ? body.method : "unknown";

  const supabase = createServiceClient();

  const { data: portal } = await supabase
    .from("portals")
    .select("id")
    .eq("slug", canonicalSlug)
    .eq("status", "active")
    .maybeSingle();

  if (!portal) {
    return new Response(null, { status: 404 });
  }

  const portalId = (portal as { id: string }).id;

  const { data: event } = await supabase
    .from("events")
    .select("id")
    .eq("id", eventId)
    .eq("portal_id", portalId)
    .maybeSingle();

  if (!event) {
    return new Response(null, { status: 400 });
  }

  const user = await getUser();

  const { error: insertError } = await (supabase as unknown as {
    from: (table: string) => {
      insert: (payload: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
    };
  })
    .from("portal_event_shares")
    .insert({
      portal_id: portalId,
      event_id: eventId,
      user_id: user?.id || null,
      share_method: shareMethod,
    });

  if (insertError) {
    return new Response(null, { status: 500 });
  }

  return new Response(null, { status: 204 });
}
