"use client";

import { useState, useEffect, use } from "react";
import { usePortal } from "@/lib/portal-context";

type AnalyticsData = {
  period: { days: number; since: string };
  kpis: {
    total_views: number;
    unique_visitors: number;
    qr_scans: number;
    views_by_type: Record<string, number>;
  };
  time_series: { date: string; count: number }[];
  top_events: { event_id: number; views: number }[];
  utm_sources: { source: string; count: number }[];
};

const DATE_RANGES = [
  { label: "7 days", value: 7 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
] as const;

export default function AnalyticsPage({ params }: { params: Promise<{ portal: string }> }) {
  const { portal: slug } = use(params);
  const { portal } = usePortal();

  const [days, setDays] = useState(30);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/portals/${slug}/analytics?days=${days}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [slug, days]);

  const maxDayViews = data?.time_series
    ? Math.max(...data.time_series.map((d) => d.count), 1)
    : 1;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--cream)] mb-1">
            Analytics
          </h1>
          <p className="font-mono text-sm text-[var(--muted)]">
            Portal traffic and engagement
          </p>
        </div>
        <div className="flex gap-1">
          {DATE_RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setDays(r.value)}
              className={`px-3 py-1.5 rounded-lg font-mono text-xs transition-colors ${
                days === r.value
                  ? "bg-[var(--coral)] text-[var(--void)]"
                  : "bg-[var(--dusk)] text-[var(--muted)] hover:text-[var(--cream)] border border-[var(--twilight)]"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 skeleton-shimmer rounded-lg" />
            ))}
          </div>
          <div className="h-48 skeleton-shimmer rounded-lg" />
        </div>
      ) : !data ? (
        <div className="p-8 text-center">
          <p className="font-mono text-sm text-[var(--muted)]">
            Unable to load analytics data
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <KPICard label="Total Views" value={data.kpis.total_views} />
            <KPICard label="Unique Visitors" value={data.kpis.unique_visitors} />
            <KPICard label="QR Scans" value={data.kpis.qr_scans} color="green" />
            <KPICard
              label="Top Page"
              value={
                Object.entries(data.kpis.views_by_type).sort(
                  ([, a], [, b]) => b - a
                )[0]?.[0] || "—"
              }
            />
          </div>

          {/* Daily Views Chart (CSS-only bar chart) */}
          <div className="bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg p-6">
            <h2 className="font-mono text-sm text-[var(--cream)] mb-4">
              Daily Views
            </h2>
            {data.time_series.length === 0 ? (
              <p className="font-mono text-xs text-[var(--muted)]">
                No views yet in this period
              </p>
            ) : (
              <div className="flex items-end gap-1 h-32">
                {data.time_series.map((day) => (
                  <div
                    key={day.date}
                    className="flex-1 min-w-[4px] group relative"
                    style={{ height: "100%" }}
                  >
                    <div
                      className="absolute bottom-0 w-full bg-[var(--coral)] rounded-t transition-all hover:opacity-80"
                      style={{
                        height: `${Math.max((day.count / maxDayViews) * 100, 4)}%`,
                      }}
                    />
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 hidden group-hover:block bg-[var(--night)] text-[var(--cream)] font-mono text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap z-10">
                      {day.date.slice(5)}: {day.count}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Views by Type */}
          <div className="bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg p-6">
            <h2 className="font-mono text-sm text-[var(--cream)] mb-4">
              Views by Page Type
            </h2>
            <div className="space-y-2">
              {Object.entries(data.kpis.views_by_type)
                .sort(([, a], [, b]) => b - a)
                .map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between">
                    <span className="font-mono text-xs text-[var(--muted)] capitalize">
                      {type}
                    </span>
                    <span className="font-mono text-xs text-[var(--cream)]">
                      {count}
                    </span>
                  </div>
                ))}
            </div>
          </div>

          {/* UTM Source Breakdown */}
          {data.utm_sources.length > 0 && (
            <div className="bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg p-6">
              <h2 className="font-mono text-sm text-[var(--cream)] mb-4">
                Traffic Sources (UTM)
              </h2>
              <div className="space-y-2">
                {data.utm_sources.map((utm) => (
                  <div key={utm.source} className="flex items-center justify-between">
                    <span className="font-mono text-xs text-[var(--muted)]">
                      {utm.source}
                    </span>
                    <span className="font-mono text-xs text-[var(--cream)]">
                      {utm.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top Events */}
          {data.top_events.length > 0 && (
            <div className="bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg p-6">
              <h2 className="font-mono text-sm text-[var(--cream)] mb-4">
                Top Events by Views
              </h2>
              <div className="space-y-2">
                {data.top_events.map((event) => (
                  <div key={event.event_id} className="flex items-center justify-between">
                    <span className="font-mono text-xs text-[var(--muted)]">
                      Event #{event.event_id}
                    </span>
                    <span className="font-mono text-xs text-[var(--cream)]">
                      {event.views} views
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function KPICard({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color?: "green";
}) {
  return (
    <div className="p-4 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg">
      <p className="font-mono text-xs text-[var(--muted)] uppercase mb-1">
        {label}
      </p>
      <p
        className={`font-mono text-2xl font-bold ${
          color === "green" ? "text-green-400" : "text-[var(--cream)]"
        }`}
      >
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
    </div>
  );
}
