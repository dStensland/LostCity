/**
 * Shared query for counting events that carry a given tag within a portal's
 * federated scope. Used by both `/api/events/tag-count` and the
 * HolidayHero feed loader, so RSC callers don't have to round-trip through
 * HTTP just to hit the same query.
 */
import { createClient } from "@/lib/supabase/server";
import { getPortalSourceAccess } from "@/lib/federation";
import { applyFederatedPortalScopeToQuery } from "@/lib/portal-scope";
import { resolvePortalQueryContext } from "@/lib/portal-query-context";

interface GetEventTagCountParams {
  tag: string;
  /** Optional portal slug — when present, scopes the count to that portal's federation. */
  portalSlug?: string | null;
}

export async function getEventTagCount({
  tag,
  portalSlug,
}: GetEventTagCountParams): Promise<number> {
  if (!tag || tag.length > 50) return 0;

  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];

  const search = new URLSearchParams();
  if (portalSlug) search.set("portal", portalSlug);
  const portalContext = await resolvePortalQueryContext(supabase, search);
  const portalId = portalContext.portalId || undefined;
  const sourceAccess = portalId ? await getPortalSourceAccess(portalId) : null;
  const sourceIds = sourceAccess?.sourceIds ?? [];

  let query = supabase
    .from("events")
    .select("id", { count: "exact", head: true })
    .filter("tags", "cs", `{"${tag}"}`)
    .eq("is_active", true)
    .gte("start_date", today)
    .is("canonical_event_id", null)
    .or("start_time.not.is.null,is_all_day.eq.true")
    .or("is_feed_ready.eq.true,is_feed_ready.is.null");

  query = applyFederatedPortalScopeToQuery(query, {
    portalId,
    sourceIds,
    sourceColumn: "source_id",
  });

  const { count } = await query;
  return count ?? 0;
}
