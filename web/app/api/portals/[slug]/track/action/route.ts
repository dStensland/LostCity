import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { checkBodySize, isValidEnum, sanitizeString, type AnySupabase } from "@/lib/api-utils";
import { resolvePortalSlugAlias } from "@/lib/portal-aliases";

const VALID_ACTION_TYPES = ["mode_selected", "wayfinding_opened", "resource_clicked"] as const;
const VALID_PAGE_TYPES = ["feed", "find", "event", "spot", "series", "community", "hospital"] as const;
const VALID_MODES = ["urgent", "treatment", "visitor", "staff"] as const;

function optionalString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = sanitizeString(value).trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
}

function isValidTargetUrl(value: string | null): boolean {
  if (!value) return true;
  if (value.startsWith("/")) return true;
  return /^https?:\/\//i.test(value);
}

// POST /api/portals/[slug]/track/action - Track portal-attributed interaction events
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.standard, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const sizeCheck = checkBodySize(request, 4096);
  if (sizeCheck) return sizeCheck;

  const { slug } = await params;
  const canonicalSlug = resolvePortalSlugAlias(slug);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }

  const actionType = body.action_type;
  if (!isValidEnum(actionType, VALID_ACTION_TYPES)) {
    return new Response(null, { status: 400 });
  }

  const pageType = isValidEnum(body.page_type, VALID_PAGE_TYPES)
    ? body.page_type
    : "hospital";

  const modeContext = isValidEnum(body.mode_context, VALID_MODES)
    ? body.mode_context
    : null;

  if (actionType === "mode_selected" && !modeContext) {
    return new Response(null, { status: 400 });
  }

  const hospitalSlug = optionalString(body.hospital_slug, 120);
  const sectionKey = optionalString(body.section_key, 40);
  const targetKind = optionalString(body.target_kind, 40);
  const targetId = optionalString(body.target_id, 120);
  const targetLabel = optionalString(body.target_label, 180);
  const targetUrl = optionalString(body.target_url, 700);

  if (!isValidTargetUrl(targetUrl)) {
    return new Response(null, { status: 400 });
  }

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

  if (hospitalSlug) {
    const { data: hospital } = await (supabase as unknown as AnySupabase)
      .from("portal_hospital_locations")
      .select("id")
      .eq("portal_id", portalId)
      .eq("slug", hospitalSlug)
      .eq("is_active", true)
      .maybeSingle();

    if (!hospital) {
      return new Response(null, { status: 400 });
    }
  }

  const rawMetadata = body.metadata;
  const metadata = rawMetadata && typeof rawMetadata === "object" && !Array.isArray(rawMetadata)
    ? rawMetadata
    : null;

  const insertPayload = {
    portal_id: portalId,
    action_type: actionType,
    page_type: pageType,
    hospital_slug: hospitalSlug,
    mode_context: modeContext,
    section_key: sectionKey,
    target_kind: targetKind,
    target_id: targetId,
    target_label: targetLabel,
    target_url: targetUrl,
    referrer: optionalString(body.referrer, 500),
    utm_source: optionalString(body.utm_source, 100),
    utm_medium: optionalString(body.utm_medium, 100),
    utm_campaign: optionalString(body.utm_campaign, 100),
    user_agent: request.headers.get("user-agent")?.slice(0, 500) || null,
    metadata,
  };

  const { error: insertError } = await (supabase as unknown as AnySupabase)
    .from("portal_interaction_events")
    .insert(insertPayload);

  if (insertError) {
    return new Response(null, { status: 500 });
  }

  return new Response(null, { status: 204 });
}
