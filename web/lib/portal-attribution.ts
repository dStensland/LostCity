import { NextRequest, NextResponse } from "next/server";
import { resolvePortalId, extractPortalSlugFromReferer } from "@/lib/portal-resolution";
import { isValidUUID } from "@/lib/api-utils";
import { PORTAL_CONTEXT_COOKIE } from "@/lib/auth-utils";
import { logger } from "@/lib/logger";

type ResolvePortalAttributionOptions = {
  endpoint: string;
  body?: unknown;
  required?: boolean;
  requireWhenHinted?: boolean;
};

type PortalAttributionResult =
  | { portalId: string | null; response: null }
  | { portalId: null; response: NextResponse };

function hasBodyPortalHint(body: unknown): boolean {
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  const payload = body as Record<string, unknown>;
  return Boolean(payload.portal_slug || payload.portal_id);
}

function hasRequestPortalHint(request: NextRequest, body?: unknown): boolean {
  const url = new URL(request.url);
  const portalParam = url.searchParams.get("portal");
  const portalIdParam = url.searchParams.get("portal_id");
  const headerPortalSlug = request.headers.get("x-portal-slug");
  const headerPortalId = request.headers.get("x-portal-id");
  const cookiePortalSlug = request.cookies.get(PORTAL_CONTEXT_COOKIE)?.value || null;
  const refererPortalSlug = extractPortalSlugFromReferer(request);

  return Boolean(
    hasBodyPortalHint(body) ||
      portalParam ||
      (portalIdParam && isValidUUID(portalIdParam)) ||
      headerPortalSlug ||
      (headerPortalId && isValidUUID(headerPortalId)) ||
      cookiePortalSlug ||
      refererPortalSlug
  );
}

export async function resolvePortalAttributionForWrite(
  request: NextRequest,
  options: ResolvePortalAttributionOptions
): Promise<PortalAttributionResult> {
  const {
    endpoint,
    body,
    required = false,
    requireWhenHinted = true,
  } = options;

  const portalId = await resolvePortalId(request);
  if (portalId) {
    return { portalId, response: null };
  }

  const hasHint = hasRequestPortalHint(request, body);
  const shouldRequire = required || (requireWhenHinted && hasHint);

  if (shouldRequire) {
    logger.warn("Portal attribution missing on write request", {
      endpoint,
      hasHint,
      method: request.method,
      pathname: new URL(request.url).pathname,
    });

    return {
      portalId: null,
      response: NextResponse.json(
        {
          error: "Portal attribution is required for this request",
          code: "portal_attribution_required",
        },
        { status: 400 }
      ),
    };
  }

  logger.warn("Portal attribution omitted on write request", {
    endpoint,
    hasHint,
    method: request.method,
    pathname: new URL(request.url).pathname,
  });

  return { portalId: null, response: null };
}
