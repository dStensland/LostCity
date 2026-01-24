"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type FederationStats = {
  totalSources: number;
  sourcesWithOwners: number;
  globalSources: number;
  activeSharingRules: number;
  activeSubscriptions: number;
  portalsWithOwnedSources: number;
  portalsWithSubscriptions: number;
};

type PortalSummary = {
  portalId: string | null;
  portalName: string | null;
  portalSlug: string | null;
  sourceCount: number;
  sharedSourceCount: number;
};

type SourceWithOwnership = {
  id: number;
  name: string;
  slug: string;
  isActive: boolean;
  ownerPortalId: string | null;
  ownerPortal: { id: string; slug: string; name: string } | null;
  sharingRule: { shareScope: string } | null;
  subscriberCount: number;
};

export default function FederationDashboardPage() {
  const [stats, setStats] = useState<FederationStats | null>(null);
  const [portalSummaries, setPortalSummaries] = useState<PortalSummary[]>([]);
  const [sources, setSources] = useState<SourceWithOwnership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch("/api/admin/federation/stats");
        if (!res.ok) throw new Error("Failed to fetch federation data");
        const data = await res.json();
        setStats(data.stats);
        setPortalSummaries(data.portalSummaries || []);
        setSources(data.sources || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="py-12 text-center">
          <div className="w-8 h-8 border-2 border-[var(--coral)] border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  if (error) {
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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-2xl text-[var(--cream)] italic">Source Federation</h1>
          <p className="font-mono text-sm text-[var(--muted)] mt-1">
            Manage source ownership, sharing, and subscriptions across portals
          </p>
        </div>
        <Link
          href="/admin/sources"
          className="px-4 py-2 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg font-mono text-sm text-[var(--cream)] hover:border-[var(--coral)] transition-colors"
        >
          View All Sources
        </Link>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
          <StatCard label="Total Sources" value={stats.totalSources} />
          <StatCard label="With Owners" value={stats.sourcesWithOwners} color="blue" />
          <StatCard label="Global" value={stats.globalSources} color="purple" />
          <StatCard label="Sharing Rules" value={stats.activeSharingRules} color="green" />
          <StatCard label="Subscriptions" value={stats.activeSubscriptions} color="yellow" />
          <StatCard label="Owner Portals" value={stats.portalsWithOwnedSources} color="cyan" />
          <StatCard label="Subscriber Portals" value={stats.portalsWithSubscriptions} color="pink" />
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Portal Source Ownership */}
        <div className="bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg">
          <div className="p-4 border-b border-[var(--twilight)]">
            <h2 className="font-serif text-lg text-[var(--cream)] italic">Sources by Portal</h2>
            <p className="font-mono text-xs text-[var(--muted)] mt-1">
              Distribution of source ownership across portals
            </p>
          </div>
          <div className="divide-y divide-[var(--twilight)]">
            {portalSummaries.map((summary) => (
              <div key={summary.portalId || "global"} className="p-4 flex items-center justify-between">
                <div>
                  {summary.portalId ? (
                    <Link
                      href={`/admin/portals/${summary.portalId}/sources`}
                      className="font-mono text-sm text-[var(--cream)] hover:text-[var(--coral)]"
                    >
                      {summary.portalName}
                    </Link>
                  ) : (
                    <span className="font-mono text-sm text-[var(--muted)]">Global</span>
                  )}
                  {summary.portalSlug && (
                    <p className="font-mono text-xs text-[var(--muted)]">/{summary.portalSlug}</p>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-mono text-lg font-bold text-[var(--cream)]">
                      {summary.sourceCount}
                    </p>
                    <p className="font-mono text-xs text-[var(--muted)]">sources</p>
                  </div>
                  {summary.portalId && (
                    <div className="text-right">
                      <p className="font-mono text-lg font-bold text-green-400">
                        {summary.sharedSourceCount}
                      </p>
                      <p className="font-mono text-xs text-[var(--muted)]">shared</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {portalSummaries.length === 0 && (
              <div className="p-4 text-center">
                <p className="font-mono text-sm text-[var(--muted)]">No portal data available</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Sources */}
        <div className="bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg">
          <div className="p-4 border-b border-[var(--twilight)]">
            <h2 className="font-serif text-lg text-[var(--cream)] italic">Sources Overview</h2>
            <p className="font-mono text-xs text-[var(--muted)] mt-1">
              Source ownership and sharing status
            </p>
          </div>
          <div className="divide-y divide-[var(--twilight)] max-h-96 overflow-y-auto">
            {sources.map((source) => (
              <Link
                key={source.id}
                href={`/admin/sources/${source.id}`}
                className="p-4 flex items-center justify-between hover:bg-[var(--night)] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      source.isActive ? "bg-green-400" : "bg-[var(--muted)]"
                    }`}
                  />
                  <div>
                    <p className="font-mono text-sm text-[var(--cream)]">{source.name}</p>
                    <p className="font-mono text-xs text-[var(--muted)]">
                      {source.ownerPortal?.name || "Global"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {source.sharingRule && (
                    <span
                      className={`px-2 py-0.5 rounded font-mono text-[0.6rem] uppercase ${
                        source.sharingRule.shareScope === "all"
                          ? "bg-green-500/20 text-green-400"
                          : source.sharingRule.shareScope === "selected"
                          ? "bg-yellow-500/20 text-yellow-400"
                          : "bg-[var(--twilight)] text-[var(--muted)]"
                      }`}
                    >
                      {source.sharingRule.shareScope}
                    </span>
                  )}
                  {source.subscriberCount > 0 && (
                    <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded font-mono text-[0.6rem]">
                      {source.subscriberCount} sub{source.subscriberCount !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </Link>
            ))}
            {sources.length === 0 && (
              <div className="p-4 text-center">
                <p className="font-mono text-sm text-[var(--muted)]">No sources found</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Help Section */}
      <div className="mt-8 bg-[var(--night)] border border-[var(--twilight)] rounded-lg p-6">
        <h3 className="font-serif text-lg text-[var(--cream)] italic mb-4">How Federation Works</h3>
        <div className="grid md:grid-cols-3 gap-6">
          <div>
            <h4 className="font-mono text-sm text-[var(--coral)] mb-2">1. Source Ownership</h4>
            <p className="font-mono text-xs text-[var(--muted)]">
              Each source can be owned by a portal or be global. Global sources appear in all portals
              automatically.
            </p>
          </div>
          <div>
            <h4 className="font-mono text-sm text-[var(--coral)] mb-2">2. Sharing Rules</h4>
            <p className="font-mono text-xs text-[var(--muted)]">
              Portal owners configure which categories from their sources other portals can access:
              all, selected, or none.
            </p>
          </div>
          <div>
            <h4 className="font-mono text-sm text-[var(--coral)] mb-2">3. Subscriptions</h4>
            <p className="font-mono text-xs text-[var(--muted)]">
              Portals subscribe to shared sources to receive events. They can filter to specific
              categories within what&apos;s shared.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: "blue" | "green" | "yellow" | "purple" | "cyan" | "pink";
}) {
  const colorClasses: Record<string, string> = {
    blue: "text-blue-400",
    green: "text-green-400",
    yellow: "text-yellow-400",
    purple: "text-purple-400",
    cyan: "text-cyan-400",
    pink: "text-pink-400",
  };

  return (
    <div className="p-3 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg">
      <p className="font-mono text-[0.6rem] text-[var(--muted)] uppercase">{label}</p>
      <p
        className={`font-mono text-2xl font-bold ${
          color ? colorClasses[color] : "text-[var(--cream)]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
