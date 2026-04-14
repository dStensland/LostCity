import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { after } from "next/server";
import { withOptionalAuth } from "@/lib/api-middleware";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { resolvePortalRequest } from "@/lib/portal-runtime/resolvePortalRequest";
import { parseSearchInput } from "@/lib/search/input-schema";
import { search, annotate } from "@/lib/search";
import { logSearchEvent, getTodaySalt } from "@/lib/search/observability";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

/**
 * Public unified search endpoint.
 *
 * GET /{portal}/api/search/unified?q=...
 *
 * Portal is derived from the [portal] route segment — NEVER from query
 * params. Per security spec §3.1 and the architect review, any
 * client-supplied `portal_id` is silently stripped by the Zod schema.
 *
 * Response shape: PresentedResults (see lib/search/presenting/types.ts)
 *
 * Caching: short-ttl public cache for unauthenticated or non-time-sensitive
 * queries. Time-sensitive queries (date=today, date=tomorrow) get a tighter
 * s-maxage to avoid stale results at boundary crossings. Personalization
 * data is NEVER in this response — clients call /personalize separately.
 *
 * Observability: fires logSearchEvent via after() (Next 16 stable) so it
 * never blocks the response. The logged row has user_segment but NEVER
 * user_id (GDPR cascade prevention — see spec §3.6).
 */
export const GET = withOptionalAuth(
  async (request: NextRequest, { user }) => {
    // Layer 1: per-IP rate limit
    const ip = getClientIdentifier(request);
    const rl = await applyRateLimit(request, RATE_LIMITS.read, ip);
    if (rl) return rl;

    // Resolve portal from the ROUTE path segment
    const url = new URL(request.url);
    const portalSlugFromPath = url.pathname.split("/")[1];
    const resolved = await resolvePortalRequest({
      slug: portalSlugFromPath,
      headersList: await headers(),
      pathname: url.pathname,
      searchParams: url.searchParams,
      surface: "explore",
    });
    if (!resolved) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const { portal } = resolved;

    // Parse and validate input
    let input;
    try {
      input = parseSearchInput(url.searchParams);
    } catch (err) {
      return NextResponse.json(
        {
          error: "Invalid input",
          detail: err instanceof Error ? err.message : "unknown",
        },
        { status: 400 }
      );
    }

    // Run search
    try {
      const result = await search(input.q, {
        portal_id: portal.id,
        portal_slug: portal.slug,
        limit: input.limit,
        user_id: user?.id,
      });

      const response = NextResponse.json(result);

      // Tighter cache for time-sensitive queries to avoid stale boundary crossings
      const isTimeSensitive =
        input.date === "today" || input.date === "tomorrow";
      const sMaxAge = isTimeSensitive ? 15 : 30;
      const swr = isTimeSensitive ? 30 : 120;
      response.headers.set(
        "Cache-Control",
        `public, s-maxage=${sMaxAge}, stale-while-revalidate=${swr}`
      );

      // Fire-and-forget observability — never blocks response
      after(async () => {
        try {
          const annotated = await annotate(input.q, {
            portal_id: portal.id,
            portal_slug: portal.slug,
          });
          const salt = await getTodaySalt();
          await logSearchEvent({
            query: input.q,
            portalSlug: portal.slug,
            segment: user ? "authed" : "anon",
            hadFilters: Boolean(
              input.categories?.length ||
                input.neighborhoods?.length ||
                input.date ||
                input.free
            ),
            presented: result,
            intentType: annotated.intent.type,
            salt,
          });
        } catch (err) {
          console.warn(
            "search_events log failed",
            err instanceof Error ? err.message : err
          );
        }
      });

      return response;
    } catch (err) {
      console.error("search failed", err);
      return NextResponse.json(
        {
          error: "Search failed",
          detail: err instanceof Error ? err.message : "unknown",
        },
        { status: 500 }
      );
    }
  }
);
