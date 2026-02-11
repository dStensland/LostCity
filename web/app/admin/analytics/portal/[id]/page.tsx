"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import AnalyticsKPICard from "@/components/admin/AnalyticsKPICard";
import AnalyticsChart from "@/components/admin/AnalyticsChart";

type TimeSeriesPoint = {
  date: string;
  value: number;
};

type PortalAnalytics = {
  portal: {
    id: string;
    name: string;
    slug: string;
    status: string;
    created_at: string;
  };
  period: {
    start: string;
    end: string;
    days: number;
  };
  kpis: {
    total_views: number;
    total_rsvps: number;
    total_saves: number;
    total_shares: number;
    total_signups: number;
    avg_active_users: number;
    trends: {
      views: number;
      rsvps: number;
      signups: number;
      active_users: number;
    };
  };
  attribution: {
    tracked_event_shares: number;
    shares_per_1k_views: number;
    attributed_signups: number;
  };
  interaction_kpis: {
    total_interactions: number;
    mode_selected: number;
    wayfinding_opened: number;
    resource_clicked: number;
    wayfinding_open_rate: number;
    resource_click_rate: number;
    mode_breakdown: { mode: string; count: number }[];
  };
  content: {
    events_total: number;
    sources_active: number;
    crawl_runs_total: number;
    avg_success_rate: number;
  };
  time_series: {
    views: TimeSeriesPoint[];
    rsvps: TimeSeriesPoint[];
    signups: TimeSeriesPoint[];
    activeUsers: TimeSeriesPoint[];
    crawlSuccess: TimeSeriesPoint[];
    interactions: TimeSeriesPoint[];
  };
};

type Props = {
  params: Promise<{ id: string }>;
};

export default function PortalAnalyticsPage({ params }: Props) {
  const resolvedParams = use(params);
  const portalId = resolvedParams.id;

  const [data, setData] = useState<PortalAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/analytics/portal/${portalId}?days=${days}`);
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error("Portal not found");
        }
        throw new Error("Failed to fetch analytics");
      }
      const result = await res.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [portalId, days]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleExport(format: "csv" | "json") {
    if (!data) return;

    const params = new URLSearchParams({
      format,
      portal_id: portalId,
      start_date: data.period.start,
      end_date: data.period.end,
    });

    const res = await fetch(`/api/admin/analytics/export?${params}`);
    if (!res.ok) {
      alert("Export failed");
      return;
    }

    if (format === "json") {
      const jsonData = await res.json();
      const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: "application/json" });
      downloadBlob(blob, `analytics_${data.portal.slug}_${data.period.start}_${data.period.end}.json`);
    } else {
      const blob = await res.blob();
      downloadBlob(blob, `analytics_${data.portal.slug}_${data.period.start}_${data.period.end}.csv`);
    }
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--coral)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen">
        <main className="max-w-7xl mx-auto px-4 py-8">
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="font-mono text-sm text-red-400">{error}</p>
            <Link
              href="/admin/analytics"
              className="mt-4 inline-block font-mono text-sm text-[var(--coral)] hover:underline"
            >
              &larr; Back to Analytics
            </Link>
          </div>
        </main>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen">
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Link
                href="/admin/analytics"
                className="font-mono text-sm text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
              >
                &larr; Analytics
              </Link>
              <span className="text-[var(--twilight)]">/</span>
              <span className="font-mono text-sm text-[var(--cream)]">{data.portal.name}</span>
            </div>
            <h1 className="text-2xl font-semibold text-[var(--cream)]">
              {data.portal.name} Analytics
            </h1>
            <p className="font-mono text-xs text-[var(--muted)] mt-1">
              /{data.portal.slug}
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* Date Range */}
            <select
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value, 10))}
              className="px-3 py-2 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>

            {/* Export Dropdown */}
            <div className="relative group">
              <button className="px-4 py-2 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg font-mono text-sm text-[var(--cream)] hover:border-[var(--coral)] transition-colors">
                Export
              </button>
              <div className="absolute right-0 mt-1 w-32 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                <button
                  onClick={() => handleExport("csv")}
                  className="w-full px-4 py-2 text-left font-mono text-sm text-[var(--cream)] hover:bg-[var(--night)] transition-colors rounded-t-lg"
                >
                  CSV
                </button>
                <button
                  onClick={() => handleExport("json")}
                  className="w-full px-4 py-2 text-left font-mono text-sm text-[var(--cream)] hover:bg-[var(--night)] transition-colors rounded-b-lg"
                >
                  JSON
                </button>
              </div>
            </div>

            {/* Visit Portal */}
            <Link
              href={`/${data.portal.slug}`}
              target="_blank"
              className="px-4 py-2 bg-[var(--coral)] text-[var(--void)] font-mono text-sm font-medium rounded-lg hover:bg-[var(--coral)]/90 transition-colors"
            >
              Visit Portal
            </Link>
          </div>
        </div>

        {/* Engagement KPIs */}
        <div className="mb-8">
          <h2 className="font-mono text-xs text-[var(--muted)] uppercase tracking-wide mb-4">
            Engagement
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <AnalyticsKPICard
              label="Total Views"
              value={data.kpis.total_views}
              trend={data.kpis.trends.views}
              trendLabel="vs last 7d"
            />
            <AnalyticsKPICard
              label="RSVPs"
              value={data.kpis.total_rsvps}
              trend={data.kpis.trends.rsvps}
              trendLabel="vs last 7d"
            />
            <AnalyticsKPICard
              label="Saves"
              value={data.kpis.total_saves}
            />
            <AnalyticsKPICard
              label="Shares"
              value={data.kpis.total_shares}
            />
            <AnalyticsKPICard
              label="Shares / 1K Views"
              value={data.attribution.shares_per_1k_views.toFixed(1)}
            />
          </div>
        </div>

        {/* Growth KPIs */}
        <div className="mb-8">
          <h2 className="font-mono text-xs text-[var(--muted)] uppercase tracking-wide mb-4">
            Growth
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <AnalyticsKPICard
              label="New Signups"
              value={data.kpis.total_signups}
              trend={data.kpis.trends.signups}
              trendLabel="vs last 7d"
            />
            <AnalyticsKPICard
              label="Avg Active Users"
              value={data.kpis.avg_active_users}
              trend={data.kpis.trends.active_users}
              trendLabel="vs last 7d"
            />
            <AnalyticsKPICard
              label="Total Events"
              value={data.content.events_total}
            />
            <AnalyticsKPICard
              label="Active Sources"
              value={data.content.sources_active}
            />
          </div>
        </div>

        {/* Content Stats */}
        <div className="mb-8">
          <h2 className="font-mono text-xs text-[var(--muted)] uppercase tracking-wide mb-4">
            Content Health
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <AnalyticsKPICard
              label="Crawl Runs"
              value={data.content.crawl_runs_total}
            />
            <AnalyticsKPICard
              label="Avg Success Rate"
              value={data.content.avg_success_rate}
              format="percentage"
            />
            <AnalyticsKPICard
              label="Active Sources"
              value={data.content.sources_active}
            />
          </div>
        </div>

        {/* Interaction KPIs */}
        <div className="mb-8">
          <h2 className="font-mono text-xs text-[var(--muted)] uppercase tracking-wide mb-4">
            Interaction Health
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <AnalyticsKPICard
              label="Mode Selections"
              value={data.interaction_kpis.mode_selected}
            />
            <AnalyticsKPICard
              label="Wayfinding Opens"
              value={data.interaction_kpis.wayfinding_opened}
            />
            <AnalyticsKPICard
              label="Resource Clicks"
              value={data.interaction_kpis.resource_clicked}
            />
            <AnalyticsKPICard
              label="Wayfinding / 100 Views"
              value={data.interaction_kpis.wayfinding_open_rate}
            />
          </div>
        </div>

        {/* Charts */}
        <div className="mb-8">
          <h2 className="font-mono text-xs text-[var(--muted)] uppercase tracking-wide mb-4">
            Trends
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <AnalyticsChart
              data={data.time_series.views}
              title="Event Views"
              color="var(--coral)"
              height={200}
            />
            <AnalyticsChart
              data={data.time_series.rsvps}
              title="RSVPs"
              color="var(--rose)"
              height={200}
            />
            <AnalyticsChart
              data={data.time_series.activeUsers}
              title="Active Users"
              color="var(--soft)"
              height={200}
            />
            <AnalyticsChart
              data={data.time_series.crawlSuccess}
              title="Crawl Success Rate"
              color="var(--neon-amber)"
              height={200}
              format="percentage"
            />
            <AnalyticsChart
              data={data.time_series.interactions}
              title="Tracked Interactions"
              color="var(--neon-cyan)"
              height={200}
            />
          </div>
        </div>

        {/* Period Info */}
        <div className="text-center">
          <p className="font-mono text-xs text-[var(--muted)]">
            Showing data from {data.period.start} to {data.period.end} ({data.period.days} days)
          </p>
        </div>
      </main>
    </div>
  );
}
