"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { usePortal } from "@/lib/portal-context";

type Stats = {
  ownedSourcesCount: number;
  activeSubscriptionsCount: number;
  totalSubscribersCount: number;
};

export default function PortalAdminDashboard({ params }: { params: Promise<{ portal: string }> }) {
  const { portal: slug } = use(params);
  const { portal } = usePortal();

  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        // Load subscriptions data
        const subsRes = await fetch(`/api/admin/portals/${portal.id}/subscriptions`);
        if (subsRes.ok) {
          const subsData = await subsRes.json();

          // Load federation stats for owned sources
          const fedRes = await fetch("/api/admin/federation/stats");
          if (fedRes.ok) {
            const fedData = await fedRes.json();
            const ownedSources = (fedData.sources || []).filter(
              (s: { ownerPortalId: string | null }) => s.ownerPortalId === portal.id
            );

            // Calculate total subscribers across all owned sources
            const totalSubscribers = ownedSources.reduce(
              (sum: number, s: { subscriberCount?: number }) => sum + (s.subscriberCount || 0),
              0
            );

            setStats({
              ownedSourcesCount: ownedSources.length,
              activeSubscriptionsCount: subsData.subscriptions?.length || 0,
              totalSubscribersCount: totalSubscribers,
            });
          }
        }
      } catch (err) {
        console.error("Failed to load stats:", err);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, [portal.id]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-[var(--cream)] mb-1">
          {portal.name} Admin
        </h1>
        <p className="font-mono text-sm text-[var(--muted)]">
          Manage your portal&apos;s sources and subscriptions
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard
          label="Owned Sources"
          value={loading ? "..." : stats?.ownedSourcesCount || 0}
          href={`/${slug}/admin/sources`}
        />
        <StatCard
          label="Active Subscriptions"
          value={loading ? "..." : stats?.activeSubscriptionsCount || 0}
          href={`/${slug}/admin/subscriptions`}
        />
        <StatCard
          label="Total Subscribers"
          value={loading ? "..." : stats?.totalSubscribersCount || 0}
          color="green"
        />
      </div>

      {/* Quick Actions */}
      <div className="bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg p-6">
        <h2 className="text-lg font-semibold text-[var(--cream)] mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href={`/${slug}/admin/sources`}
            className="p-4 bg-[var(--night)] rounded-lg hover:bg-[var(--twilight)] transition-colors"
          >
            <h3 className="font-mono text-sm text-[var(--coral)] mb-1">Manage Sources</h3>
            <p className="font-mono text-xs text-[var(--muted)]">
              Configure sharing rules for sources you own
            </p>
          </Link>
          <Link
            href={`/${slug}/admin/subscriptions`}
            className="p-4 bg-[var(--night)] rounded-lg hover:bg-[var(--twilight)] transition-colors"
          >
            <h3 className="font-mono text-sm text-[var(--coral)] mb-1">Manage Subscriptions</h3>
            <p className="font-mono text-xs text-[var(--muted)]">
              Subscribe to sources shared by other portals
            </p>
          </Link>
          <Link
            href={`/${slug}`}
            className="p-4 bg-[var(--night)] rounded-lg hover:bg-[var(--twilight)] transition-colors"
          >
            <h3 className="font-mono text-sm text-[var(--coral)] mb-1">View Portal</h3>
            <p className="font-mono text-xs text-[var(--muted)]">
              See how your portal looks to visitors
            </p>
          </Link>
          <Link
            href={`/admin/portals/${portal.id}`}
            className="p-4 bg-[var(--night)] rounded-lg hover:bg-[var(--twilight)] transition-colors"
          >
            <h3 className="font-mono text-sm text-[var(--coral)] mb-1">Portal Settings</h3>
            <p className="font-mono text-xs text-[var(--muted)]">
              Update branding, filters, and configuration
            </p>
          </Link>
        </div>
      </div>

      {/* Help Text */}
      <div className="mt-8 p-4 bg-[var(--night)] border border-[var(--twilight)] rounded-lg">
        <h3 className="font-mono text-sm text-[var(--coral)] mb-2">About Source Federation</h3>
        <p className="font-mono text-xs text-[var(--muted)] leading-relaxed">
          As a portal owner, you can share your event sources with other portals.
          Configure sharing rules to control which categories other portals can access.
          You can also subscribe to sources shared by other portals to expand your event coverage.
        </p>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  href,
  color,
}: {
  label: string;
  value: number | string;
  href?: string;
  color?: "green";
}) {
  const content = (
    <div className="p-4 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg">
      <p className="font-mono text-xs text-[var(--muted)] uppercase mb-1">{label}</p>
      <p className={`font-mono text-3xl font-bold ${color === "green" ? "text-green-400" : "text-[var(--cream)]"}`}>
        {value}
      </p>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="hover:opacity-90 transition-opacity">
        {content}
      </Link>
    );
  }

  return content;
}
