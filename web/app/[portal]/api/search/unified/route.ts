import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { resolvePortalRequest } from "@/lib/portal-runtime/resolvePortalRequest";
import { parseSearchInput } from "@/lib/search/input-schema";
import { search } from "@/lib/search";
import { logSearchEvent, getTodaySalt } from "@/lib/search/observability";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

const IS_PRODUCTION = process.env.NODE_ENV === "production";

interface RouteContext {
  params: Promise<{ portal: string }>;
}

/**
 * Public unified search endpoint.
 *
 * GET /{portal}/api/search/unified?q=...
 *
 * Portal is derived from the [portal] route segment — NEVER from query
 * params. Per security spec §3.1 and the architect review, any
 * client-supplied `portal_id` is silently stripped by the Zod schema.
 *
 * Response shape: { annotated, presented } where presented is the
 * PresentedResults payload (see lib/search/presenting/types.ts). Callers
 * should render `presented`; `annotated` is exposed for clients that need
 * intent/normalized-query information. Diagnostics are omitted in prod.
 *
 * Caching: short-ttl public cache for unauthenticated or non-time-sensitive
 * queries. Time-sensitive queries (date=today, date=tomorrow) get a tighter
 * s-maxage to avoid stale results at boundary crossings. Personalization
 * data is NEVER in this response — clients call /personalize separately.
 *
 * Observability: fires logSearchEvent via after() (Next 16 stable) so it
 * never blocks the response. The logged row has user_segment but NEVER
 * user_id (GDPR cascade prevention — see spec §3.6). The intent_type comes
 * off the SearchResult that `search()` returned — annotate() runs exactly
 * once per request (no double-annotation).
 *
 * Auth: this route uses the inline Supabase client instead of the
 * withOptionalAuth wrapper so the handler can receive Next.js route params
 * via context — specifically `params.portal` instead of splitting the URL
 * pathname. The auth behavior matches withOptionalAuth (user may be null).
 */
export async function GET(request: NextRequest, context: RouteContext) {
  // Layer 1: per-IP rate limit
  const ip = getClientIdentifier(request);
  const rl = await applyRateLimit(request, RATE_LIMITS.read, ip);
  if (rl) return rl;

  // Resolve portal from the [portal] route segment. Using params.portal
  // directly is the Next.js idiomatic path — splitting request.nextUrl.pathname
  // was an anti-pattern that broke if the route got nested under another
  // dynamic segment.
  const { portal: portalSlugFromPath } = await context.params;
  const url = new URL(request.url);
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

  // Optional auth — parallels withOptionalAuth. user may be null.
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  const effectiveUser = authError ? null : user;

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

  // Run search — pass all filter fields so they reach the SQL function.
  // Prior to this fix, only q + limit were forwarded; categories/neighborhoods/
  // date/free/types were parsed by Zod then silently dropped.
  try {
    const { annotated, presented } = await search(input.q, {
      portal_id: portal.id,
      portal_slug: portal.slug,
      limit: input.limit,
      filters: {
        categories: input.categories,
        neighborhoods: input.neighborhoods,
        tags: input.tags,
        date: input.date ?? undefined,
        free: input.free,
        price: input.price ?? undefined,
        types: input.types,
      },
    });

    // Strip diagnostics from the public payload in production. Useful in
    // dev for debugging; never exposed to end users so they can't infer
    // backend timing / cache internals from API responses.
    const publicPayload = IS_PRODUCTION
      ? { ...presented, diagnostics: undefined }
      : presented;

    const response = NextResponse.json(publicPayload);

    // Tighter cache for time-sensitive queries to avoid stale boundary crossings
    const isTimeSensitive =
      input.date === "today" || input.date === "tomorrow";
    const sMaxAge = isTimeSensitive ? 15 : 30;
    const swr = isTimeSensitive ? 30 : 120;
    response.headers.set(
      "Cache-Control",
      `public, s-maxage=${sMaxAge}, stale-while-revalidate=${swr}`
    );

    // Fire-and-forget observability — never blocks response. Critically,
    // we use the `annotated` that `search()` already computed — NO second
    // annotate() call. (Regression guard: search-service.test.ts pins
    // annotate is called exactly once per search().)
    after(async () => {
      try {
        const salt = await getTodaySalt();
        await logSearchEvent({
          query: input.q,
          portalSlug: portal.slug,
          segment: effectiveUser ? "authed" : "anon",
          hadFilters: Boolean(
            input.categories?.length ||
              input.neighborhoods?.length ||
              input.date ||
              input.free
          ),
          presented,
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
    // Server-side full detail for debugging, generic response to avoid
    // leaking DB internals (Supabase error messages often include function
    // names, argument types, column names, or SQL state).
    console.error("search failed", err);
    const body: { error: string; detail?: string } = { error: "Search failed" };
    if (process.env.NODE_ENV !== "production") {
      body.detail = err instanceof Error ? err.message : "unknown";
    }
    return NextResponse.json(body, { status: 500 });
  }
}
