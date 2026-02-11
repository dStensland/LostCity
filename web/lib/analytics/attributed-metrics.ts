import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types";
import type { AnySupabase } from "@/lib/api-utils";

export type DailyMetric = {
  date: string;
  portal_id: string;
  event_views: number;
  event_rsvps: number;
  event_saves: number;
  event_shares: number;
  new_signups: number;
  active_users: number;
  events_total: number;
  events_created: number;
  sources_active: number;
  crawl_runs: number;
  crawl_success_rate: number;
};

type MetricAccumulator = Omit<DailyMetric, "date" | "portal_id">;

const EMPTY_METRIC: MetricAccumulator = {
  event_views: 0,
  event_rsvps: 0,
  event_saves: 0,
  event_shares: 0,
  new_signups: 0,
  active_users: 0,
  events_total: 0,
  events_created: 0,
  sources_active: 0,
  crawl_runs: 0,
  crawl_success_rate: 0,
};

const PAGE_SIZE = 5000;

function keyFor(portalId: string, date: string): string {
  return `${portalId}:${date}`;
}

function parseDate(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.split("T")[0] || null;
}

function addToMetric(
  metrics: Map<string, MetricAccumulator>,
  portalId: string,
  date: string,
  field: keyof MetricAccumulator,
  amount: number
) {
  const key = keyFor(portalId, date);
  const existing = metrics.get(key);
  if (!existing) return;
  existing[field] += amount;
}

function buildDateRange(startDate: string, endDate: string): string[] {
  const range: string[] = [];
  const current = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  while (current <= end) {
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, "0");
    const day = String(current.getDate()).padStart(2, "0");
    range.push(`${year}-${month}-${day}`);
    current.setDate(current.getDate() + 1);
  }

  return range;
}

type PageResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

async function fetchAllPages<T>(
  fetchPage: (offset: number, limit: number) => Promise<PageResult<T>>
): Promise<T[]> {
  const rows: T[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await fetchPage(offset, PAGE_SIZE);
    if (error) {
      throw new Error(error.message);
    }

    const page = data || [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return rows;
}

function initializeMetricMap(portalIds: string[], dates: string[]): Map<string, MetricAccumulator> {
  const metrics = new Map<string, MetricAccumulator>();
  for (const portalId of portalIds) {
    for (const date of dates) {
      metrics.set(keyFor(portalId, date), { ...EMPTY_METRIC });
    }
  }
  return metrics;
}

type ComputeOptions = {
  portalIds: string[];
  startDate: string;
  endDate: string;
};

export async function computeAttributedDailyMetrics(
  supabase: SupabaseClient<Database>,
  options: ComputeOptions
): Promise<DailyMetric[]> {
  const { portalIds, startDate, endDate } = options;
  if (portalIds.length === 0) return [];

  const portalIdSet = new Set(portalIds);
  const dates = buildDateRange(startDate, endDate);
  const metrics = initializeMetricMap(portalIds, dates);
  const activeVisitorSets = new Map<string, Set<string>>();
  const rawSupabase = supabase as unknown as AnySupabase;

  const startTimestamp = `${startDate}T00:00:00`;
  const endTimestamp = `${endDate}T23:59:59.999`;

  const pageViews = await fetchAllPages<{
    portal_id: string;
    created_at: string;
    user_agent: string | null;
  }>(async (offset, limit) => {
    const query = supabase
      .from("portal_page_views")
      .select("portal_id, created_at, user_agent")
      .in("portal_id", portalIds)
      .gte("created_at", startTimestamp)
      .lte("created_at", endTimestamp)
      .order("created_at", { ascending: true })
      .range(offset, offset + limit - 1);
    return query;
  });

  for (const row of pageViews) {
    const date = parseDate(row.created_at);
    if (!date || !portalIdSet.has(row.portal_id)) continue;
    addToMetric(metrics, row.portal_id, date, "event_views", 1);

    if (row.user_agent) {
      const visitorKey = keyFor(row.portal_id, date);
      if (!activeVisitorSets.has(visitorKey)) {
        activeVisitorSets.set(visitorKey, new Set<string>());
      }
      activeVisitorSets.get(visitorKey)!.add(row.user_agent);
    }
  }

  const rsvps = await fetchAllPages<{
    created_at: string | null;
    event: { portal_id: string | null } | { portal_id: string | null }[] | null;
  }>(async (offset, limit) => {
    const query = supabase
      .from("event_rsvps")
      .select("created_at, event:events!event_rsvps_event_id_fkey(portal_id)")
      .gte("created_at", startTimestamp)
      .lte("created_at", endTimestamp)
      .order("created_at", { ascending: true })
      .range(offset, offset + limit - 1);
    return query;
  });

  for (const row of rsvps) {
    const date = parseDate(row.created_at);
    const eventRelation = row.event;
    const relatedEvent = Array.isArray(eventRelation) ? eventRelation[0] : eventRelation;
    const portalId = relatedEvent?.portal_id || null;
    if (!date || !portalId || !portalIdSet.has(portalId)) continue;
    addToMetric(metrics, portalId, date, "event_rsvps", 1);
  }

  const saves = await fetchAllPages<{
    created_at: string | null;
    event: { portal_id: string | null } | { portal_id: string | null }[] | null;
  }>(async (offset, limit) => {
    const query = supabase
      .from("saved_items")
      .select("created_at, event:events!saved_items_event_id_fkey(portal_id)")
      .not("event_id", "is", null)
      .gte("created_at", startTimestamp)
      .lte("created_at", endTimestamp)
      .order("created_at", { ascending: true })
      .range(offset, offset + limit - 1);
    return query;
  });

  for (const row of saves) {
    const date = parseDate(row.created_at);
    const eventRelation = row.event;
    const relatedEvent = Array.isArray(eventRelation) ? eventRelation[0] : eventRelation;
    const portalId = relatedEvent?.portal_id || null;
    if (!date || !portalId || !portalIdSet.has(portalId)) continue;
    addToMetric(metrics, portalId, date, "event_saves", 1);
  }

  const shares = await fetchAllPages<{
    portal_id: string;
    created_at: string;
  }>(async (offset, limit) => {
    const query = rawSupabase
      .from("portal_event_shares")
      .select("portal_id, created_at")
      .in("portal_id", portalIds)
      .gte("created_at", startTimestamp)
      .lte("created_at", endTimestamp)
      .order("created_at", { ascending: true })
      .range(offset, offset + limit - 1);
    return query;
  });

  for (const row of shares) {
    const date = parseDate(row.created_at);
    if (!date || !portalIdSet.has(row.portal_id)) continue;
    addToMetric(metrics, row.portal_id, date, "event_shares", 1);
  }

  const signups = await fetchAllPages<{
    signup_portal_id: string;
    created_at: string;
  }>(async (offset, limit) => {
    const query = rawSupabase
      .from("profiles")
      .select("signup_portal_id, created_at")
      .not("signup_portal_id", "is", null)
      .in("signup_portal_id", portalIds)
      .gte("created_at", startTimestamp)
      .lte("created_at", endTimestamp)
      .order("created_at", { ascending: true })
      .range(offset, offset + limit - 1);
    return query;
  });

  for (const row of signups) {
    const date = parseDate(row.created_at);
    if (!date || !portalIdSet.has(row.signup_portal_id)) continue;
    addToMetric(metrics, row.signup_portal_id, date, "new_signups", 1);
  }

  const createdEvents = await fetchAllPages<{ portal_id: string | null; created_at: string | null }>(
    async (offset, limit) => {
      const query = supabase
        .from("events")
        .select("portal_id, created_at")
        .in("portal_id", portalIds)
        .gte("created_at", startTimestamp)
        .lte("created_at", endTimestamp)
        .order("created_at", { ascending: true })
        .range(offset, offset + limit - 1);
      return query;
    }
  );

  for (const row of createdEvents) {
    const portalId = row.portal_id;
    const date = parseDate(row.created_at);
    if (!portalId || !date || !portalIdSet.has(portalId)) continue;
    addToMetric(metrics, portalId, date, "events_created", 1);
  }

  const upcomingEvents = await fetchAllPages<{ portal_id: string | null; start_date: string }>(
    async (offset, limit) => {
      const query = supabase
        .from("events")
        .select("portal_id, start_date")
        .in("portal_id", portalIds)
        .gte("start_date", startDate)
        .is("canonical_event_id", null)
        .order("start_date", { ascending: true })
        .range(offset, offset + limit - 1);
      return query;
    }
  );

  const startsByPortal = new Map<string, Map<string, number>>();
  for (const row of upcomingEvents) {
    if (!row.portal_id || !portalIdSet.has(row.portal_id)) continue;
    const portalStartMap = startsByPortal.get(row.portal_id) || new Map<string, number>();
    portalStartMap.set(row.start_date, (portalStartMap.get(row.start_date) || 0) + 1);
    startsByPortal.set(row.portal_id, portalStartMap);
  }

  for (const portalId of portalIds) {
    const portalStarts = startsByPortal.get(portalId) || new Map<string, number>();
    let runningTotal = 0;
    for (let i = dates.length - 1; i >= 0; i -= 1) {
      const date = dates[i];
      runningTotal += portalStarts.get(date) || 0;
      addToMetric(metrics, portalId, date, "events_total", runningTotal);
    }
  }

  const { data: activeSources, error: sourceError } = await supabase
    .from("sources")
    .select("owner_portal_id")
    .eq("is_active", true)
    .in("owner_portal_id", portalIds);

  if (sourceError) {
    throw new Error(sourceError.message);
  }

  const sourcesByPortal = new Map<string, number>();
  for (const source of (activeSources || []) as { owner_portal_id: string | null }[]) {
    const portalId = source.owner_portal_id;
    if (!portalId || !portalIdSet.has(portalId)) continue;
    sourcesByPortal.set(portalId, (sourcesByPortal.get(portalId) || 0) + 1);
  }

  for (const portalId of portalIds) {
    const sourceCount = sourcesByPortal.get(portalId) || 0;
    for (const date of dates) {
      addToMetric(metrics, portalId, date, "sources_active", sourceCount);
    }
  }

  const crawlLogs = await fetchAllPages<{
    started_at: string;
    status: string | null;
    source: { owner_portal_id: string | null } | { owner_portal_id: string | null }[] | null;
  }>(async (offset, limit) => {
    const query = supabase
      .from("crawl_logs")
      .select("started_at, status, source:sources!crawl_logs_source_id_fkey(owner_portal_id)")
      .gte("started_at", startTimestamp)
      .lte("started_at", endTimestamp)
      .order("started_at", { ascending: true })
      .range(offset, offset + limit - 1);
    return query;
  });

  const crawlSuccessByKey = new Map<string, { runs: number; success: number }>();
  for (const row of crawlLogs) {
    const date = parseDate(row.started_at);
    const sourceRelation = row.source;
    const source = Array.isArray(sourceRelation) ? sourceRelation[0] : sourceRelation;
    const portalId = source?.owner_portal_id || null;
    if (!date || !portalId || !portalIdSet.has(portalId)) continue;

    const key = keyFor(portalId, date);
    const existing = crawlSuccessByKey.get(key) || { runs: 0, success: 0 };
    existing.runs += 1;
    if (row.status === "success") {
      existing.success += 1;
    }
    crawlSuccessByKey.set(key, existing);
  }

  for (const [key, summary] of crawlSuccessByKey.entries()) {
    const [portalId, date] = key.split(":");
    addToMetric(metrics, portalId, date, "crawl_runs", summary.runs);
    const metric = metrics.get(keyFor(portalId, date));
    if (!metric) continue;
    metric.crawl_success_rate = summary.runs > 0
      ? (summary.success / summary.runs) * 100
      : 0;
  }

  for (const [key, visitors] of activeVisitorSets.entries()) {
    const [portalId, date] = key.split(":");
    const metric = metrics.get(keyFor(portalId, date));
    if (!metric) continue;
    metric.active_users = visitors.size;
  }

  const result: DailyMetric[] = [];
  for (const date of dates) {
    for (const portalId of portalIds) {
      const metric = metrics.get(keyFor(portalId, date)) || { ...EMPTY_METRIC };
      result.push({
        date,
        portal_id: portalId,
        ...metric,
      });
    }
  }

  return result;
}
