"use client";

import { useState, useEffect, useMemo, use } from "react";
import Link from "next/link";
import SourceHealthBadge, { getHealthStatus } from "@/components/admin/SourceHealthBadge";
import HealthTagBadge from "@/components/admin/HealthTagBadge";
import SourceFiltersComponent, { SourceFilters } from "@/components/admin/SourceFilters";

type Portal = {
  id: string;
  slug: string;
  name: string;
};

type SourceWithHealth = {
  id: number;
  name: string;
  slug: string;
  url: string;
  is_active: boolean;
  source_type: string | null;
  health_tags: string[];
  active_months: number[] | null;
  last_run: string | null;
  last_status: string | null;
  last_error: string | null;
  success_rate_7d: number;
  events_found_last: number;
  total_events: number;
  is_owned: boolean;
  owner_portal?: { id: string; name: string; slug: string } | null;
};

type HealthSummary = {
  total: number;
  healthy: number;
  warning: number;
  failing: number;
};

type SortKey = "name" | "last_run" | "success_rate_7d" | "total_events";
type SortDirection = "asc" | "desc";

export default function PortalSourcesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [portal, setPortal] = useState<Portal | null>(null);
  const [ownedSources, setOwnedSources] = useState<SourceWithHealth[]>([]);
  const [subscribedSources, setSubscribedSources] = useState<SourceWithHealth[]>([]);
  const [ownedSummary, setOwnedSummary] = useState<HealthSummary>({ total: 0, healthy: 0, warning: 0, failing: 0 });
  const [subscribedSummary, setSubscribedSummary] = useState<HealthSummary>({ total: 0, healthy: 0, warning: 0, failing: 0 });
  const [activeTab, setActiveTab] = useState<"owned" | "subscribed">("owned");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [triggeringCrawl, setTriggeringCrawl] = useState<number | null>(null);
  const [expandedLogs, setExpandedLogs] = useState<number | null>(null);
  const [crawlLogs, setCrawlLogs] = useState<Record<number, unknown[]>>({});

  // Sorting
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  // Filters
  const [filters, setFilters] = useState<SourceFilters>({
    status: "all",
    healthTags: [],
    sourceType: "all",
    inSeason: false,
    search: "",
  });

  // Get current month for seasonal filtering
  const currentMonth = new Date().getMonth() + 1;

  useEffect(() => {
    async function loadData() {
      try {
        // Load portal info
        const portalRes = await fetch(`/api/admin/portals/${id}`);
        if (!portalRes.ok) throw new Error("Failed to fetch portal");
        const portalData = await portalRes.json();
        setPortal(portalData.portal);

        // Load health data
        const healthRes = await fetch(`/api/admin/portals/${id}/sources/health`);
        if (!healthRes.ok) throw new Error("Failed to fetch source health data");
        const healthData = await healthRes.json();

        setOwnedSources(healthData.ownedSources || []);
        setSubscribedSources(healthData.subscribedSources || []);
        setOwnedSummary(healthData.summary?.owned || { total: 0, healthy: 0, warning: 0, failing: 0 });
        setSubscribedSummary(healthData.summary?.subscribed || { total: 0, healthy: 0, warning: 0, failing: 0 });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  // Get unique source types for filter
  const sourceTypes = useMemo(() => {
    const types = new Set<string>();
    [...ownedSources, ...subscribedSources].forEach((s) => {
      if (s.source_type) types.add(s.source_type);
    });
    return Array.from(types).sort();
  }, [ownedSources, subscribedSources]);

  // Filter and sort sources
  const filteredSources = useMemo(() => {
    const sources = activeTab === "owned" ? ownedSources : subscribedSources;

    return sources
      .filter((source) => {
        // Status filter
        if (filters.status !== "all") {
          const status = getHealthStatus(
            source.is_active,
            source.success_rate_7d,
            source.last_run,
            source.last_status
          );
          if (status !== filters.status) return false;
        }

        // Health tags filter
        if (filters.healthTags.length > 0) {
          const hasMatchingTag = filters.healthTags.some((tag) =>
            source.health_tags.includes(tag)
          );
          if (!hasMatchingTag) return false;
        }

        // Source type filter
        if (filters.sourceType !== "all" && source.source_type !== filters.sourceType) {
          return false;
        }

        // In season filter
        if (filters.inSeason) {
          if (source.active_months && !source.active_months.includes(currentMonth)) {
            return false;
          }
        }

        // Search filter
        if (filters.search) {
          const searchLower = filters.search.toLowerCase();
          if (
            !source.name.toLowerCase().includes(searchLower) &&
            !source.slug.toLowerCase().includes(searchLower)
          ) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        let comparison = 0;

        switch (sortKey) {
          case "name":
            comparison = a.name.localeCompare(b.name);
            break;
          case "last_run":
            if (!a.last_run && !b.last_run) comparison = 0;
            else if (!a.last_run) comparison = 1;
            else if (!b.last_run) comparison = -1;
            else comparison = new Date(b.last_run).getTime() - new Date(a.last_run).getTime();
            break;
          case "success_rate_7d":
            comparison = b.success_rate_7d - a.success_rate_7d;
            break;
          case "total_events":
            comparison = b.total_events - a.total_events;
            break;
        }

        return sortDirection === "asc" ? comparison : -comparison;
      });
  }, [activeTab, ownedSources, subscribedSources, filters, sortKey, sortDirection, currentMonth]);

  async function handleTriggerCrawl(sourceId: number) {
    setTriggeringCrawl(sourceId);
    try {
      const res = await fetch(`/api/admin/sources/${sourceId}/crawl`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to trigger crawl");
      }

      // Reload health data
      const healthRes = await fetch(`/api/admin/portals/${id}/sources/health`);
      if (healthRes.ok) {
        const healthData = await healthRes.json();
        setOwnedSources(healthData.ownedSources || []);
        setSubscribedSources(healthData.subscribedSources || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to trigger crawl");
    } finally {
      setTriggeringCrawl(null);
    }
  }

  async function handleToggleActive(source: SourceWithHealth) {
    try {
      const res = await fetch(`/api/admin/sources/${source.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !source.is_active }),
      });

      if (!res.ok) {
        throw new Error("Failed to update source");
      }

      // Update local state
      const updateSource = (s: SourceWithHealth) =>
        s.id === source.id ? { ...s, is_active: !s.is_active } : s;

      if (activeTab === "owned") {
        setOwnedSources((prev) => prev.map(updateSource));
      } else {
        setSubscribedSources((prev) => prev.map(updateSource));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    }
  }

  async function loadCrawlLogs(sourceId: number) {
    if (expandedLogs === sourceId) {
      setExpandedLogs(null);
      return;
    }

    setExpandedLogs(sourceId);

    if (!crawlLogs[sourceId]) {
      try {
        const res = await fetch(`/api/admin/sources/${sourceId}/crawl`);
        if (res.ok) {
          const data = await res.json();
          setCrawlLogs((prev) => ({ ...prev, [sourceId]: data.logs || [] }));
        }
      } catch {
        // Ignore errors
      }
    }
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  }

  function SortHeader({ label, sortKeyName }: { label: string; sortKeyName: SortKey }) {
    const isActive = sortKey === sortKeyName;
    return (
      <button
        onClick={() => handleSort(sortKeyName)}
        className={`flex items-center gap-1 font-mono text-xs uppercase tracking-wide ${
          isActive ? "text-[var(--coral)]" : "text-[var(--muted)]"
        } hover:text-[var(--cream)]`}
      >
        {label}
        {isActive && (
          <span className="text-[0.6rem]">{sortDirection === "asc" ? "▲" : "▼"}</span>
        )}
      </button>
    );
  }

  function formatTimeAgo(dateStr: string | null): string {
    if (!dateStr) return "Never";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="py-12 text-center">
          <div className="w-8 h-8 border-2 border-[var(--coral)] border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  if (error && !portal) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="p-4 bg-red-500/10 border border-red-500 rounded-lg text-red-400">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-2 font-mono text-xs text-[var(--muted)]">
        <Link href="/admin/portals" className="hover:text-[var(--cream)]">
          Portals
        </Link>
        <span>/</span>
        <Link href={`/admin/portals/${id}`} className="hover:text-[var(--cream)]">
          {portal?.name || "Portal"}
        </Link>
        <span>/</span>
        <span className="text-[var(--cream)]">Sources</span>
      </nav>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[var(--cream)] mb-1">
          {portal?.name} Sources
        </h1>
        <p className="font-mono text-sm text-[var(--muted)]">
          Manage source health and monitor crawl activity
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500 rounded-lg text-red-400">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-4 text-sm underline hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="p-4 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg">
          <p className="font-mono text-xs text-[var(--muted)] uppercase mb-1">Owned</p>
          <p className="font-mono text-2xl font-bold text-[var(--coral)]">{ownedSummary.total}</p>
        </div>
        <div className="p-4 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg">
          <p className="font-mono text-xs text-[var(--muted)] uppercase mb-1">Subscribed</p>
          <p className="font-mono text-2xl font-bold text-[var(--coral)]">{subscribedSummary.total}</p>
        </div>
        <div className="p-4 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg">
          <p className="font-mono text-xs text-green-400 uppercase mb-1">Healthy</p>
          <p className="font-mono text-2xl font-bold text-green-400">
            {ownedSummary.healthy + subscribedSummary.healthy}
          </p>
        </div>
        <div className="p-4 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg">
          <p className="font-mono text-xs text-red-400 uppercase mb-1">Needs Attention</p>
          <p className="font-mono text-2xl font-bold text-red-400">
            {ownedSummary.warning + ownedSummary.failing + subscribedSummary.warning + subscribedSummary.failing}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {(["owned", "subscribed"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg font-mono text-sm transition-colors ${
              activeTab === tab
                ? "bg-[var(--coral)] text-[var(--void)]"
                : "bg-[var(--dusk)] text-[var(--muted)] hover:text-[var(--cream)]"
            }`}
          >
            {tab === "owned" ? `Owned (${ownedSources.length})` : `Subscribed (${subscribedSources.length})`}
          </button>
        ))}
      </div>

      {/* Filters */}
      <SourceFiltersComponent
        filters={filters}
        onFiltersChange={setFilters}
        sourceTypes={sourceTypes}
        showInSeasonFilter={true}
      />

      {/* Sources Table */}
      <div className="bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-[auto_2fr_1fr_1fr_1fr_1fr_auto] gap-4 p-4 border-b border-[var(--twilight)] bg-[var(--night)]">
          <div className="w-8" /> {/* Status indicator */}
          <SortHeader label="Name" sortKeyName="name" />
          <SortHeader label="Last Run" sortKeyName="last_run" />
          <SortHeader label="Success" sortKeyName="success_rate_7d" />
          <SortHeader label="Events" sortKeyName="total_events" />
          <div className="font-mono text-xs text-[var(--muted)] uppercase">Tags</div>
          <div className="w-24" /> {/* Actions */}
        </div>

        {/* Table Body */}
        <div className="divide-y divide-[var(--twilight)]">
          {filteredSources.length === 0 ? (
            <div className="p-8 text-center">
              <p className="font-mono text-sm text-[var(--muted)]">
                {filters.search || filters.status !== "all" || filters.healthTags.length > 0
                  ? "No sources match your filters."
                  : activeTab === "owned"
                  ? "This portal doesn't own any sources yet."
                  : "This portal hasn't subscribed to any sources yet."}
              </p>
            </div>
          ) : (
            filteredSources.map((source) => (
              <div key={source.id}>
                <div
                  className={`grid grid-cols-[auto_2fr_1fr_1fr_1fr_1fr_auto] gap-4 p-4 items-center hover:bg-[var(--night)] transition-colors ${
                    !source.is_owned ? "border-l-2 border-l-blue-500/50" : ""
                  }`}
                >
                  {/* Status */}
                  <SourceHealthBadge
                    isActive={source.is_active}
                    successRate={source.success_rate_7d}
                    lastRun={source.last_run}
                    lastStatus={source.last_status}
                    size="sm"
                  />

                  {/* Name */}
                  <div>
                    <Link
                      href={`/admin/sources/${source.id}`}
                      className="font-mono text-sm text-[var(--cream)] hover:text-[var(--coral)]"
                    >
                      {source.name}
                    </Link>
                    {!source.is_owned && source.owner_portal && (
                      <p className="font-mono text-xs text-blue-400">
                        From {source.owner_portal.name}
                      </p>
                    )}
                    {source.last_error && (
                      <p className="font-mono text-xs text-red-400 truncate max-w-[300px]" title={source.last_error}>
                        {source.last_error}
                      </p>
                    )}
                  </div>

                  {/* Last Run */}
                  <div className="font-mono text-sm text-[var(--muted)]">
                    {formatTimeAgo(source.last_run)}
                  </div>

                  {/* Success Rate */}
                  <div className="font-mono text-sm">
                    <span
                      className={
                        source.success_rate_7d >= 80
                          ? "text-green-400"
                          : source.success_rate_7d > 0
                          ? "text-yellow-400"
                          : "text-[var(--muted)]"
                      }
                    >
                      {source.success_rate_7d}%
                    </span>
                  </div>

                  {/* Events */}
                  <div className="font-mono text-sm text-[var(--cream)]">
                    {source.total_events.toLocaleString()}
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1">
                    {source.health_tags.slice(0, 3).map((tag) => (
                      <HealthTagBadge key={tag} tag={tag} size="sm" />
                    ))}
                    {source.health_tags.length > 3 && (
                      <span className="font-mono text-xs text-[var(--muted)]">
                        +{source.health_tags.length - 3}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {/* Toggle Active */}
                    <button
                      onClick={() => handleToggleActive(source)}
                      className={`px-2 py-1 rounded font-mono text-xs ${
                        source.is_active
                          ? "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                          : "bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)]"
                      }`}
                      title={source.is_active ? "Disable" : "Enable"}
                    >
                      {source.is_active ? "ON" : "OFF"}
                    </button>

                    {/* Actions menu */}
                    {source.is_owned ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleTriggerCrawl(source.id)}
                          disabled={triggeringCrawl === source.id || !source.is_active}
                          className="px-2 py-1 bg-[var(--coral)]/20 text-[var(--coral)] rounded font-mono text-xs hover:bg-[var(--coral)]/30 disabled:opacity-50"
                          title="Trigger Crawl"
                        >
                          {triggeringCrawl === source.id ? "..." : "Crawl"}
                        </button>
                        <button
                          onClick={() => loadCrawlLogs(source.id)}
                          className="px-2 py-1 bg-[var(--twilight)] text-[var(--muted)] rounded font-mono text-xs hover:text-[var(--cream)]"
                          title="View Logs"
                        >
                          Logs
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => loadCrawlLogs(source.id)}
                        className="px-2 py-1 bg-[var(--twilight)] text-[var(--muted)] rounded font-mono text-xs hover:text-[var(--cream)]"
                        title="View Logs"
                      >
                        Logs
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded Logs */}
                {expandedLogs === source.id && (
                  <div className="p-4 bg-[var(--night)] border-t border-[var(--twilight)]">
                    <h4 className="font-mono text-xs text-[var(--muted)] uppercase mb-2">
                      Recent Crawl Logs
                    </h4>
                    {crawlLogs[source.id] && crawlLogs[source.id].length > 0 ? (
                      <div className="space-y-2">
                        {(crawlLogs[source.id] as {
                          id: number;
                          started_at: string;
                          status: string;
                          events_found: number;
                          events_new: number;
                          error_message: string | null;
                        }[]).slice(0, 5).map((log) => (
                          <div
                            key={log.id}
                            className="flex items-center gap-4 font-mono text-xs"
                          >
                            <span className="text-[var(--muted)]">
                              {new Date(log.started_at).toLocaleString()}
                            </span>
                            <span
                              className={
                                log.status === "success"
                                  ? "text-green-400"
                                  : log.status === "error"
                                  ? "text-red-400"
                                  : "text-yellow-400"
                              }
                            >
                              {log.status}
                            </span>
                            <span className="text-[var(--cream)]">
                              {log.events_found} found, {log.events_new} new
                            </span>
                            {log.error_message && (
                              <span className="text-red-400 truncate max-w-[300px]">
                                {log.error_message}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="font-mono text-xs text-[var(--muted)]">
                        No crawl logs found.
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
