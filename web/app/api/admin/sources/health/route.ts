import { supabase } from "@/lib/supabase";
import { isAdmin } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type SourceHealth = {
  id: number;
  name: string;
  slug: string;
  url: string;
  is_active: boolean;
  last_run: string | null;
  last_status: string | null;
  last_error: string | null;
  events_found_last: number;
  events_new_last: number;
  total_runs_7d: number;
  success_rate_7d: number;
  avg_events_found_7d: number;
  total_events: number;
};

type SourceRow = {
  id: number;
  name: string;
  slug: string;
  url: string;
  is_active: boolean;
};

export async function GET() {
  // Verify admin
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Get all sources
  const { data: sourcesData, error: sourcesError } = await supabase
    .from("sources")
    .select("id, name, slug, url, is_active")
    .order("name");

  if (sourcesError) {
    return NextResponse.json({ error: sourcesError.message }, { status: 500 });
  }

  const sources = (sourcesData || []) as SourceRow[];

  // Get crawl logs from last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: recentLogs } = await supabase
    .from("crawl_logs")
    .select("source_id, started_at, completed_at, status, events_found, events_new, error_message")
    .gte("started_at", sevenDaysAgo)
    .order("started_at", { ascending: false });

  // Get event counts per source
  const { data: eventCounts } = await supabase
    .from("events")
    .select("source_id")
    .eq("is_active", true);

  // Count events per source
  const eventCountMap = new Map<number, number>();
  if (eventCounts) {
    for (const e of eventCounts as { source_id: number | null }[]) {
      if (e.source_id) {
        eventCountMap.set(e.source_id, (eventCountMap.get(e.source_id) || 0) + 1);
      }
    }
  }

  // Process logs by source
  const logsBySource = new Map<number, typeof recentLogs>();
  if (recentLogs) {
    for (const log of recentLogs) {
      const sourceId = (log as { source_id: number }).source_id;
      if (!logsBySource.has(sourceId)) {
        logsBySource.set(sourceId, []);
      }
      logsBySource.get(sourceId)!.push(log);
    }
  }

  // Build health data for each source
  const healthData: SourceHealth[] = sources.map((source) => {
    const logs = logsBySource.get(source.id) || [];
    const lastLog = logs[0] as {
      started_at: string;
      status: string | null;
      error_message: string | null;
      events_found: number;
      events_new: number;
    } | undefined;

    const successfulRuns = logs.filter((l) => (l as { status: string | null }).status === "success").length;
    const totalRuns = logs.length;
    const successRate = totalRuns > 0 ? Math.round((successfulRuns / totalRuns) * 100) : 0;

    const totalEventsFound = logs.reduce((sum, l) => sum + ((l as { events_found: number }).events_found || 0), 0);
    const avgEventsFound = totalRuns > 0 ? Math.round(totalEventsFound / totalRuns) : 0;

    return {
      id: source.id,
      name: source.name,
      slug: source.slug,
      url: source.url,
      is_active: source.is_active,
      last_run: lastLog?.started_at || null,
      last_status: lastLog?.status || null,
      last_error: lastLog?.error_message || null,
      events_found_last: lastLog?.events_found || 0,
      events_new_last: lastLog?.events_new || 0,
      total_runs_7d: totalRuns,
      success_rate_7d: successRate,
      avg_events_found_7d: avgEventsFound,
      total_events: eventCountMap.get(source.id) || 0,
    };
  });

  // Sort: active first, then by last run (most recent first)
  healthData.sort((a, b) => {
    if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
    if (!a.last_run && !b.last_run) return 0;
    if (!a.last_run) return 1;
    if (!b.last_run) return -1;
    return new Date(b.last_run).getTime() - new Date(a.last_run).getTime();
  });

  return NextResponse.json({
    sources: healthData,
    summary: {
      total: healthData.length,
      active: healthData.filter((s) => s.is_active).length,
      healthy: healthData.filter((s) => s.is_active && s.success_rate_7d >= 80).length,
      warning: healthData.filter((s) => s.is_active && s.success_rate_7d > 0 && s.success_rate_7d < 80).length,
      failing: healthData.filter((s) => s.is_active && (s.success_rate_7d === 0 || s.last_status === "error")).length,
      never_run: healthData.filter((s) => s.is_active && !s.last_run).length,
    },
  });
}
