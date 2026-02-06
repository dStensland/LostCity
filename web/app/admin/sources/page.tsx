"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

type SourceHealth = {
  id: number;
  name: string;
  slug: string;
  url: string;
  is_active: boolean;
  integration_method: string | null;
  last_run: string | null;
  last_status: string | null;
  last_error: string | null;
  events_found_last: number;
  events_new_last: number;
  total_runs_7d: number;
  success_rate_7d: number;
  avg_events_found_7d: number;
  total_events: number;
  owner_portal_id: string | null;
  owner_portal: { id: string; name: string; slug: string } | null;
};

type Summary = {
  total: number;
  active: number;
  healthy: number;
  warning: number;
  failing: number;
  never_run: number;
};

export default function SourceHealthPage() {
  const [sources, setSources] = useState<SourceHealth[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "failing">("active");
  const [integrationFilter, setIntegrationFilter] = useState<string>("all");

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch("/api/admin/sources/health");
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        setSources(data.sources);
        setSummary(data.summary);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const filteredSources = sources.filter((s) => {
    if (filter === "active") return s.is_active;
    if (filter === "failing") return s.is_active && (s.success_rate_7d === 0 || s.last_status === "error");
    return true;
  }).filter((s) => {
    if (integrationFilter === "all") return true;
    return (s.integration_method || "unknown") === integrationFilter;
  });

  const integrationMethods = Array.from(
    new Set(sources.map((s) => s.integration_method || "unknown"))
  ).sort();

  const integrationSummary = (() => {
    const summary = new Map<
      string,
      { total: number; active: number; healthy: number; warning: number; failing: number; successRates: number[] }
    >();

    filteredSources.forEach((source) => {
      const method = source.integration_method || "unknown";
      if (!summary.has(method)) {
        summary.set(method, { total: 0, active: 0, healthy: 0, warning: 0, failing: 0, successRates: [] });
      }
      const entry = summary.get(method)!;
      entry.total += 1;
      if (source.is_active) {
        entry.active += 1;
        if (source.last_run) {
          entry.successRates.push(source.success_rate_7d);
        }
        if (source.success_rate_7d >= 80 && source.last_run) entry.healthy += 1;
        else if (source.success_rate_7d > 0) entry.warning += 1;
        else entry.failing += 1;
      }
    });

    return Array.from(summary.entries())
      .map(([method, data]) => {
        const avgSuccess =
          data.successRates.length > 0
            ? Math.round(data.successRates.reduce((sum, v) => sum + v, 0) / data.successRates.length)
            : 0;
        const healthyRate = data.active > 0 ? Math.round((data.healthy / data.active) * 100) : 0;
        return { method, ...data, avgSuccessRate: avgSuccess, healthyRate };
      })
      .sort((a, b) => b.total - a.total);
  })();

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-[var(--cream)]">Source Health</h1>
          <Link
            href="/admin/federation"
            className="px-4 py-2 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg font-mono text-sm text-[var(--cream)] hover:border-[var(--coral)] transition-colors"
          >
            Federation Dashboard
          </Link>
        </div>

        {loading ? (
          <div className="py-12 text-center">
            <div className="w-8 h-8 border-2 border-[var(--coral)] border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : error ? (
          <div className="p-4 bg-red-500/10 border border-red-500 rounded-lg text-red-400">
            {error}
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            {summary && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
                <SummaryCard label="Total" value={summary.total} />
                <SummaryCard label="Active" value={summary.active} color="blue" />
                <SummaryCard label="Healthy" value={summary.healthy} color="green" />
                <SummaryCard label="Warning" value={summary.warning} color="yellow" />
                <SummaryCard label="Failing" value={summary.failing} color="red" />
                <SummaryCard label="Never Run" value={summary.never_run} color="gray" />
              </div>
            )}

            {/* Filter Tabs */}
            <div className="flex gap-2 mb-4">
              {(["all", "active", "failing"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-lg font-mono text-xs transition-colors ${
                    filter === f
                      ? "bg-[var(--coral)] text-[var(--void)]"
                      : "bg-[var(--dusk)] text-[var(--muted)] hover:text-[var(--cream)]"
                  }`}
                >
                  {f === "all" ? "All Sources" : f === "active" ? "Active Only" : "Failing"}
                </button>
              ))}
              {integrationMethods.length > 0 && (
                <select
                  value={integrationFilter}
                  onChange={(e) => setIntegrationFilter(e.target.value)}
                  className="ml-auto px-3 py-1.5 bg-[var(--night)] border border-[var(--twilight)] rounded-lg font-mono text-xs text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
                >
                  <option value="all">All Methods</option>
                  {integrationMethods.map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Integration Summary */}
            {integrationSummary.length > 0 && (
              <div className="mb-6">
                <div className="font-mono text-xs text-[var(--muted)] uppercase mb-2">
                  Integration Methods (filtered)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {integrationSummary.map((entry) => (
                    <div
                      key={entry.method}
                      className="p-3 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-xs text-[var(--muted)] uppercase">
                          {entry.method}
                        </span>
                        <span className="font-mono text-xs text-[var(--cream)]">{entry.total}</span>
                      </div>
                      <div className="flex items-center gap-3 font-mono text-xs text-[var(--soft)]">
                        <span>Healthy {entry.healthyRate}%</span>
                        <span>Avg Success {entry.avgSuccessRate}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Source Table */}
            <div className="bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[var(--twilight)] bg-[var(--night)]">
                      <th className="text-left px-4 py-3 font-mono text-xs text-[var(--muted)] uppercase">Source</th>
                      <th className="text-left px-4 py-3 font-mono text-xs text-[var(--muted)] uppercase">Owner</th>
                      <th className="text-left px-4 py-3 font-mono text-xs text-[var(--muted)] uppercase">Method</th>
                      <th className="text-left px-4 py-3 font-mono text-xs text-[var(--muted)] uppercase">Status</th>
                      <th className="text-left px-4 py-3 font-mono text-xs text-[var(--muted)] uppercase">Last Run</th>
                      <th className="text-right px-4 py-3 font-mono text-xs text-[var(--muted)] uppercase">7d Runs</th>
                      <th className="text-right px-4 py-3 font-mono text-xs text-[var(--muted)] uppercase">Success</th>
                      <th className="text-right px-4 py-3 font-mono text-xs text-[var(--muted)] uppercase">Avg Found</th>
                      <th className="text-right px-4 py-3 font-mono text-xs text-[var(--muted)] uppercase">Total Events</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSources.map((source) => (
                      <SourceRow key={source.id} source={source} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {filteredSources.length === 0 && (
              <p className="text-center py-8 text-[var(--muted)] font-mono text-sm">
                No sources match this filter
              </p>
            )}
          </>
        )}
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: number; color?: string }) {
  const colorClasses: Record<string, string> = {
    blue: "text-blue-400",
    green: "text-green-400",
    yellow: "text-yellow-400",
    red: "text-red-400",
    gray: "text-[var(--muted)]",
  };

  return (
    <div className="p-3 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg">
      <p className="font-mono text-[0.65rem] text-[var(--muted)] uppercase">{label}</p>
      <p className={`font-mono text-2xl font-bold ${color ? colorClasses[color] : "text-[var(--cream)]"}`}>
        {value}
      </p>
    </div>
  );
}

function SourceRow({ source }: { source: SourceHealth }) {
  const [expanded, setExpanded] = useState(false);

  const statusColor =
    !source.is_active
      ? "text-[var(--muted)]"
      : source.last_status === "error" || source.success_rate_7d === 0
      ? "text-red-400"
      : source.success_rate_7d < 80
      ? "text-yellow-400"
      : "text-green-400";

  const statusText =
    !source.is_active
      ? "Inactive"
      : !source.last_run
      ? "Never run"
      : source.last_status === "error"
      ? "Error"
      : source.last_status === "success"
      ? "Healthy"
      : source.last_status || "Unknown";

  return (
    <>
      <tr
        className={`border-b border-[var(--twilight)] hover:bg-[var(--night)] cursor-pointer ${
          !source.is_active ? "opacity-50" : ""
        }`}
        onClick={() => setExpanded(!expanded)}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${statusColor.replace("text-", "bg-")}`} />
            <div>
              <Link
                href={`/admin/sources/${source.id}`}
                onClick={(e) => e.stopPropagation()}
                className="font-mono text-sm text-[var(--cream)] hover:text-[var(--coral)]"
              >
                {source.name}
              </Link>
              <p className="font-mono text-[0.6rem] text-[var(--muted)]">{source.slug}</p>
            </div>
          </div>
        </td>
        <td className="px-4 py-3">
          {source.owner_portal ? (
            <Link
              href={`/admin/portals/${source.owner_portal.id}`}
              onClick={(e) => e.stopPropagation()}
              className="font-mono text-xs text-[var(--coral)] hover:underline"
            >
              {source.owner_portal.name}
            </Link>
          ) : (
            <span className="font-mono text-xs text-[var(--muted)]">Global</span>
          )}
        </td>
        <td className="px-4 py-3">
          <span className="font-mono text-xs text-[var(--soft)]">
            {source.integration_method || "unknown"}
          </span>
        </td>
        <td className="px-4 py-3">
          <span className={`font-mono text-xs ${statusColor}`}>{statusText}</span>
        </td>
        <td className="px-4 py-3">
          <span className="font-mono text-xs text-[var(--soft)]">
            {source.last_run
              ? formatDistanceToNow(new Date(source.last_run), { addSuffix: true })
              : "—"}
          </span>
        </td>
        <td className="px-4 py-3 text-right">
          <span className="font-mono text-xs text-[var(--soft)]">{source.total_runs_7d}</span>
        </td>
        <td className="px-4 py-3 text-right">
          <span className={`font-mono text-xs ${source.success_rate_7d >= 80 ? "text-green-400" : source.success_rate_7d > 0 ? "text-yellow-400" : "text-[var(--muted)]"}`}>
            {source.total_runs_7d > 0 ? `${source.success_rate_7d}%` : "—"}
          </span>
        </td>
        <td className="px-4 py-3 text-right">
          <span className="font-mono text-xs text-[var(--soft)]">
            {source.total_runs_7d > 0 ? source.avg_events_found_7d : "—"}
          </span>
        </td>
        <td className="px-4 py-3 text-right">
          <span className="font-mono text-xs text-[var(--soft)]">{source.total_events}</span>
        </td>
      </tr>

      {/* Expanded Details */}
      {expanded && (
        <tr className="bg-[var(--night)]">
          <td colSpan={9} className="px-4 py-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-mono text-xs text-[var(--muted)] mb-1">Source URL</p>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs text-[var(--coral)] hover:underline break-all"
                >
                  {source.url}
                </a>
              </div>
              <div>
                <p className="font-mono text-xs text-[var(--muted)] mb-1">Last Run Results</p>
                <p className="font-mono text-xs text-[var(--soft)]">
                  Found: {source.events_found_last} | New: {source.events_new_last}
                </p>
              </div>
              {source.last_error && (
                <div className="col-span-2">
                  <p className="font-mono text-xs text-[var(--muted)] mb-1">Last Error</p>
                  <p className="font-mono text-xs text-red-400 bg-red-500/10 p-2 rounded">
                    {source.last_error}
                  </p>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
