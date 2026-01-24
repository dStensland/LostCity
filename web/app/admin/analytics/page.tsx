"use client";

import { useState, useEffect, useCallback } from "react";
import AnalyticsKPICard from "@/components/admin/AnalyticsKPICard";
import AnalyticsChart from "@/components/admin/AnalyticsChart";
import PortalStatsTable from "@/components/admin/PortalStatsTable";
import APIKeyManager from "@/components/admin/APIKeyManager";

type TimeSeriesPoint = {
  date: string;
  value: number;
};

type PortalSummary = {
  portal_id: string;
  portal_name: string;
  portal_slug: string;
  total_views: number;
  total_rsvps: number;
  total_signups: number;
  avg_active_users: number;
};

type Portal = {
  id: string;
  name: string;
  slug: string;
};

type AnalyticsData = {
  period: {
    start: string;
    end: string;
    days: number;
  };
  kpis: {
    total_views: number;
    total_rsvps: number;
    total_signups: number;
    avg_active_users: number;
    trends: {
      views: number;
      rsvps: number;
      signups: number;
    };
  };
  time_series: {
    views: TimeSeriesPoint[];
    rsvps: TimeSeriesPoint[];
    signups: TimeSeriesPoint[];
    activeUsers: TimeSeriesPoint[];
  };
  portals: PortalSummary[];
  portal_count: number;
};

export default function AnalyticsDashboardPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [portals, setPortals] = useState<Portal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const [selectedPortal, setSelectedPortal] = useState<string>("");
  const [sortBy, setSortBy] = useState<"views" | "rsvps" | "signups" | "active">("views");
  const [activeTab, setActiveTab] = useState<"overview" | "portals" | "api">("overview");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ days: days.toString() });
      if (selectedPortal) {
        params.set("portal_id", selectedPortal);
      }

      const res = await fetch(`/api/admin/analytics?${params}`);
      if (!res.ok) throw new Error("Failed to fetch analytics");
      const result = await res.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [days, selectedPortal]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    async function loadPortals() {
      try {
        const res = await fetch("/api/admin/portals");
        if (res.ok) {
          const result = await res.json();
          setPortals(result.portals || []);
        }
      } catch {
        // Ignore - portals list is optional
      }
    }
    loadPortals();
  }, []);

  async function handleExport(format: "csv" | "json") {
    const params = new URLSearchParams({ format });
    if (selectedPortal) {
      params.set("portal_id", selectedPortal);
    }
    if (data?.period) {
      params.set("start_date", data.period.start);
      params.set("end_date", data.period.end);
    }

    const res = await fetch(`/api/admin/analytics/export?${params}`);
    if (!res.ok) {
      alert("Export failed");
      return;
    }

    if (format === "json") {
      const jsonData = await res.json();
      const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: "application/json" });
      downloadBlob(blob, `analytics_${data?.period.start}_${data?.period.end}.json`);
    } else {
      const blob = await res.blob();
      downloadBlob(blob, `analytics_${data?.period.start}_${data?.period.end}.csv`);
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

  return (
    <div className="min-h-screen">
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-serif text-2xl text-[var(--cream)] italic">Analytics Dashboard</h1>
            <p className="font-mono text-xs text-[var(--muted)] mt-1">
              Platform metrics and performance
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

            {/* Portal Filter */}
            <select
              value={selectedPortal}
              onChange={(e) => setSelectedPortal(e.target.value)}
              className="px-3 py-2 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
            >
              <option value="">All Portals</option>
              {portals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
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
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 border-b border-[var(--twilight)]">
          {(["overview", "portals", "api"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 font-mono text-sm transition-colors ${
                activeTab === tab
                  ? "text-[var(--coral)] border-b-2 border-[var(--coral)] -mb-px"
                  : "text-[var(--muted)] hover:text-[var(--cream)]"
              }`}
            >
              {tab === "overview" ? "Overview" : tab === "portals" ? "Portals" : "API Keys"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-12 text-center">
            <div className="w-8 h-8 border-2 border-[var(--coral)] border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : error ? (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="font-mono text-sm text-red-400">{error}</p>
          </div>
        ) : (
          <>
            {activeTab === "overview" && data && (
              <div className="space-y-8">
                {/* KPI Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
                    label="New Signups"
                    value={data.kpis.total_signups}
                    trend={data.kpis.trends.signups}
                    trendLabel="vs last 7d"
                  />
                  <AnalyticsKPICard
                    label="Avg Active Users"
                    value={data.kpis.avg_active_users}
                  />
                </div>

                {/* Charts */}
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
                    data={data.time_series.signups}
                    title="New Signups"
                    color="var(--neon-amber)"
                    height={200}
                  />
                  <AnalyticsChart
                    data={data.time_series.activeUsers}
                    title="Active Users"
                    color="var(--soft)"
                    height={200}
                  />
                </div>

                {/* Period Info */}
                <div className="text-center">
                  <p className="font-mono text-xs text-[var(--muted)]">
                    Showing data from {data.period.start} to {data.period.end} ({data.period.days} days)
                  </p>
                </div>
              </div>
            )}

            {activeTab === "portals" && data && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <p className="font-mono text-sm text-[var(--muted)]">
                    {data.portal_count} portal{data.portal_count !== 1 ? "s" : ""}
                  </p>
                </div>
                <PortalStatsTable
                  portals={data.portals}
                  sortBy={sortBy}
                  onSort={setSortBy}
                />
              </div>
            )}

            {activeTab === "api" && (
              <APIKeyManager portals={portals} />
            )}
          </>
        )}
      </main>
    </div>
  );
}
