"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { usePortal } from "@/lib/portal-context";

type VolunteerQualityResponse = {
  portal: {
    id: string;
    slug: string;
    name: string;
  };
  summary: {
    total_opportunities: number;
    stale_count: number;
    low_conversion_count: number;
    no_interest_count: number;
    tracked_engagements: number;
    detail_views: number;
    interest_clicks: number;
    apply_clicks: number;
    detail_to_interest_rate: number | null;
    detail_to_apply_rate: number | null;
    interest_to_apply_rate: number | null;
    opportunities: string[];
  };
  opportunities: Array<{
    id: string;
    slug: string;
    title: string;
    commitment_level: string;
    organization_name: string;
    organization_slug: string;
    source_slug: string | null;
    source_name: string | null;
    updated_at: string;
    age_days: number;
    detail_views: number;
    tracked_count: number;
    interest_clicks: number;
    apply_clicks: number;
    detail_to_interest_rate: number | null;
    detail_to_apply_rate: number | null;
    interest_to_apply_rate: number | null;
    quality_status: "healthy" | "stale" | "low_conversion" | "no_interest";
  }>;
};

const STALE_DAY_OPTIONS = [14, 21, 30, 45] as const;

type VolunteerOpportunity = VolunteerQualityResponse["opportunities"][number];
type QualityFilter = "all" | "attention" | VolunteerOpportunity["quality_status"];
type SortMode = "needs_attention" | "most_apply" | "most_interest" | "most_views" | "oldest_updated";

const QUALITY_STATUS_PRIORITY: Record<VolunteerOpportunity["quality_status"], number> = {
  stale: 0,
  low_conversion: 1,
  no_interest: 2,
  healthy: 3,
};

const SORT_OPTIONS: Array<{ value: SortMode; label: string }> = [
  { value: "needs_attention", label: "Needs attention first" },
  { value: "most_apply", label: "Most apply clicks" },
  { value: "most_interest", label: "Most interest clicks" },
  { value: "most_views", label: "Most detail views" },
  { value: "oldest_updated", label: "Oldest updated" },
];

function formatRate(value: number | null): string {
  return value === null ? "n/a" : `${value.toFixed(1)}%`;
}

function qualityBadgeClass(status: VolunteerQualityResponse["opportunities"][number]["quality_status"]): string {
  switch (status) {
    case "stale":
      return "bg-red-500/20 text-red-300";
    case "low_conversion":
      return "bg-yellow-500/20 text-yellow-300";
    case "no_interest":
      return "bg-[var(--twilight)] text-[var(--muted)]";
    default:
      return "bg-green-500/20 text-green-300";
  }
}

function qualityLabel(status: VolunteerQualityResponse["opportunities"][number]["quality_status"]): string {
  switch (status) {
    case "stale":
      return "Stale";
    case "low_conversion":
      return "Low Conversion";
    case "no_interest":
      return "No Interest";
    default:
      return "Healthy";
  }
}

function recommendedAction(opportunity: VolunteerOpportunity): string {
  switch (opportunity.quality_status) {
    case "stale":
      return "Refresh the copy or signup flow. This role is aging past the freshness threshold.";
    case "low_conversion":
      return "Investigate friction between interest and apply. The role gets intent but not outbound action.";
    case "no_interest":
      return opportunity.detail_views > 0
        ? "The role is being seen but not acted on. Revisit positioning or fit signals."
        : "This role has not earned a first signal yet. Improve placement or wait for traffic.";
    default:
      return "Healthy role.";
  }
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--twilight)] bg-[var(--dusk)] p-4">
      <p className="font-mono text-xs uppercase text-[var(--muted)]">{label}</p>
      <p className="mt-2 font-mono text-3xl font-bold text-[var(--cream)]">{value}</p>
      {hint ? <p className="mt-1 font-mono text-xs text-[var(--muted)]">{hint}</p> : null}
    </div>
  );
}

export default function PortalVolunteerAdminPage() {
  const { portal } = usePortal();
  const [staleDays, setStaleDays] = useState<number>(21);
  const [data, setData] = useState<VolunteerQualityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [qualityFilter, setQualityFilter] = useState<QualityFilter>("attention");
  const [commitmentFilter, setCommitmentFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [sortMode, setSortMode] = useState<SortMode>("needs_attention");

  useEffect(() => {
    let cancelled = false;

    async function loadQuality() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/admin/portals/${portal.id}/volunteer/quality?stale_days=${staleDays}`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const payload = (await response.json()) as VolunteerQualityResponse;
        if (!cancelled) {
          setData(payload);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load volunteer quality.");
          setData(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadQuality();

    return () => {
      cancelled = true;
    };
  }, [portal.id, staleDays]);

  const allOpportunities = data?.opportunities || [];
  const sourceOptions = Array.from(
    new Set(
      allOpportunities
        .map((opportunity) => opportunity.source_slug)
        .filter((value): value is string => Boolean(value))
    )
  ).sort((a, b) => a.localeCompare(b));
  const commitmentOptions = Array.from(
    new Set(allOpportunities.map((opportunity) => opportunity.commitment_level))
  ).sort((a, b) => a.localeCompare(b));

  const normalizedQuery = query.trim().toLowerCase();
  const filteredOpportunities = [...allOpportunities]
    .filter((opportunity) => {
      if (qualityFilter === "attention" && opportunity.quality_status === "healthy") {
        return false;
      }
      if (qualityFilter !== "all" && qualityFilter !== "attention" && opportunity.quality_status !== qualityFilter) {
        return false;
      }
      if (commitmentFilter !== "all" && opportunity.commitment_level !== commitmentFilter) {
        return false;
      }
      if (sourceFilter !== "all" && opportunity.source_slug !== sourceFilter) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }

      const haystack = [
        opportunity.title,
        opportunity.organization_name,
        opportunity.source_name || "",
      ].join(" ").toLowerCase();
      return haystack.includes(normalizedQuery);
    })
    .sort((left, right) => {
      if (sortMode === "needs_attention") {
        const priorityDiff = QUALITY_STATUS_PRIORITY[left.quality_status] - QUALITY_STATUS_PRIORITY[right.quality_status];
        if (priorityDiff !== 0) return priorityDiff;
        if (left.quality_status === "low_conversion" && right.quality_status === "low_conversion") {
          return right.interest_clicks - left.interest_clicks || right.detail_views - left.detail_views;
        }
        return right.age_days - left.age_days || right.detail_views - left.detail_views;
      }
      if (sortMode === "most_apply") {
        return right.apply_clicks - left.apply_clicks || right.interest_clicks - left.interest_clicks;
      }
      if (sortMode === "most_interest") {
        return right.interest_clicks - left.interest_clicks || right.detail_views - left.detail_views;
      }
      if (sortMode === "most_views") {
        return right.detail_views - left.detail_views || right.interest_clicks - left.interest_clicks;
      }
      return right.age_days - left.age_days || QUALITY_STATUS_PRIORITY[left.quality_status] - QUALITY_STATUS_PRIORITY[right.quality_status];
    });

  const attentionQueue = filteredOpportunities.filter((opportunity) => opportunity.quality_status !== "healthy");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--cream)]">Volunteer Ops</h1>
          <p className="font-mono text-sm text-[var(--muted)]">
            Monitor structured volunteer opportunity freshness and the detail to apply funnel.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="stale-days" className="font-mono text-xs uppercase text-[var(--muted)]">
            Stale after
          </label>
          <select
            id="stale-days"
            value={staleDays}
            onChange={(event) => setStaleDays(Number(event.target.value))}
            className="rounded-md border border-[var(--twilight)] bg-[var(--dusk)] px-3 py-2 font-mono text-xs text-[var(--cream)]"
          >
            {STALE_DAY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option} days
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 font-mono text-sm text-red-300">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map((index) => (
              <div key={index} className="h-24 rounded-lg skeleton-shimmer" />
            ))}
          </div>
          <div className="h-48 rounded-lg skeleton-shimmer" />
        </div>
      ) : !data ? (
        <div className="rounded-lg border border-[var(--twilight)] bg-[var(--dusk)] p-8 text-center">
          <p className="font-mono text-sm text-[var(--muted)]">Volunteer quality data is unavailable.</p>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <StatCard label="Structured Roles" value={data.summary.total_opportunities} />
            <StatCard
              label="Needs Attention"
              value={data.summary.stale_count + data.summary.low_conversion_count}
              hint={`${data.summary.no_interest_count} still waiting for first signal`}
            />
            <StatCard label="Tracked Interest" value={data.summary.tracked_engagements} />
            <StatCard label="Apply Clicks" value={data.summary.apply_clicks} />
          </div>

          <section className="rounded-lg border border-[var(--twilight)] bg-[var(--dusk)] p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-mono text-sm text-[var(--cream)]">Volunteer Funnel</h2>
                <p className="mt-1 font-mono text-xs text-[var(--muted)]">
                  Structured opportunity detail views flowing into tracked interest and apply clicks.
                </p>
              </div>
              <Link
                href={`/${portal.slug}/volunteer/opportunities`}
                className="font-mono text-xs text-[var(--coral)] hover:underline"
              >
                Open volunteer browse
              </Link>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-[var(--twilight)] bg-[var(--night)] p-4">
                <p className="font-mono text-xs uppercase text-[var(--muted)]">Detail Views</p>
                <p className="mt-2 font-mono text-3xl font-bold text-[var(--cream)]">{data.summary.detail_views}</p>
              </div>
              <div className="rounded-lg border border-[var(--twilight)] bg-[var(--night)] p-4">
                <p className="font-mono text-xs uppercase text-[var(--muted)]">Track Interest</p>
                <p className="mt-2 font-mono text-3xl font-bold text-[var(--cream)]">{data.summary.interest_clicks}</p>
                <p className="mt-1 font-mono text-xs text-[var(--muted)]">
                  {formatRate(data.summary.detail_to_interest_rate)} from detail view
                </p>
              </div>
              <div className="rounded-lg border border-[var(--twilight)] bg-[var(--night)] p-4">
                <p className="font-mono text-xs uppercase text-[var(--muted)]">Apply Clicks</p>
                <p className="mt-2 font-mono text-3xl font-bold text-[var(--cream)]">{data.summary.apply_clicks}</p>
                <p className="mt-1 font-mono text-xs text-[var(--muted)]">
                  {formatRate(data.summary.interest_to_apply_rate)} from tracked interest
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-[var(--twilight)] bg-[var(--night)] p-4">
              <div className="flex flex-wrap gap-6">
                <div>
                  <p className="font-mono text-xs uppercase text-[var(--muted)]">Detail to Interest</p>
                  <p className="mt-1 font-mono text-lg text-[var(--cream)]">{formatRate(data.summary.detail_to_interest_rate)}</p>
                </div>
                <div>
                  <p className="font-mono text-xs uppercase text-[var(--muted)]">Detail to Apply</p>
                  <p className="mt-1 font-mono text-lg text-[var(--cream)]">{formatRate(data.summary.detail_to_apply_rate)}</p>
                </div>
              </div>
            </div>
          </section>

          {data.summary.opportunities.length > 0 ? (
            <section className="rounded-lg border border-[var(--twilight)] bg-[var(--dusk)] p-6">
              <h2 className="font-mono text-sm text-[var(--cream)]">Ops Notes</h2>
              <div className="mt-4 space-y-2">
                {data.summary.opportunities.map((opportunity) => (
                  <p key={opportunity} className="font-mono text-xs text-[var(--muted)]">
                    {opportunity}
                  </p>
                ))}
              </div>
            </section>
          ) : null}

          <section className="rounded-lg border border-[var(--twilight)] bg-[var(--dusk)] p-6">
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="font-mono text-sm text-[var(--cream)]">Role Queue</h2>
                <p className="mt-1 font-mono text-xs text-[var(--muted)]">
                  Filter and sort the structured role inventory to focus operator time on the weakest roles first.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <input
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search role or organization"
                  className="rounded-md border border-[var(--twilight)] bg-[var(--night)] px-3 py-2 font-mono text-xs text-[var(--cream)] placeholder:text-[var(--muted)]"
                />
                <select
                  value={qualityFilter}
                  onChange={(event) => setQualityFilter(event.target.value as QualityFilter)}
                  className="rounded-md border border-[var(--twilight)] bg-[var(--night)] px-3 py-2 font-mono text-xs text-[var(--cream)]"
                >
                  <option value="all">All quality states</option>
                  <option value="attention">Needs attention only</option>
                  <option value="stale">Stale only</option>
                  <option value="low_conversion">Low conversion only</option>
                  <option value="no_interest">No interest only</option>
                  <option value="healthy">Healthy only</option>
                </select>
                <select
                  value={commitmentFilter}
                  onChange={(event) => setCommitmentFilter(event.target.value)}
                  className="rounded-md border border-[var(--twilight)] bg-[var(--night)] px-3 py-2 font-mono text-xs text-[var(--cream)]"
                >
                  <option value="all">All commitment levels</option>
                  {commitmentOptions.map((option) => (
                    <option key={option} value={option}>
                      {option.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
                <select
                  value={sourceFilter}
                  onChange={(event) => setSourceFilter(event.target.value)}
                  className="rounded-md border border-[var(--twilight)] bg-[var(--night)] px-3 py-2 font-mono text-xs text-[var(--cream)]"
                >
                  <option value="all">All sources</option>
                  {sourceOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <select
                  value={sortMode}
                  onChange={(event) => setSortMode(event.target.value as SortMode)}
                  className="rounded-md border border-[var(--twilight)] bg-[var(--night)] px-3 py-2 font-mono text-xs text-[var(--cream)]"
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <p className="font-mono text-xs text-[var(--muted)]">
                Showing {filteredOpportunities.length} of {allOpportunities.length} roles.
              </p>
            </div>
          </section>

          <section className="rounded-lg border border-[var(--twilight)] bg-[var(--dusk)] p-6">
            <h2 className="font-mono text-sm text-[var(--cream)]">Needs Attention</h2>
            {attentionQueue.length === 0 ? (
              <p className="mt-4 font-mono text-xs text-[var(--muted)]">
                No roles match the current attention filters.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {attentionQueue.map((opportunity) => (
                  <div
                    key={opportunity.id}
                    className="rounded-lg border border-[var(--twilight)] bg-[var(--night)] p-4"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-2 py-1 font-mono text-2xs uppercase ${qualityBadgeClass(opportunity.quality_status)}`}>
                            {qualityLabel(opportunity.quality_status)}
                          </span>
                          <span className="font-mono text-2xs uppercase text-[var(--muted)]">
                            {opportunity.commitment_level.replace(/_/g, " ")}
                          </span>
                        </div>
                        <p className="mt-2 text-sm font-semibold text-[var(--cream)]">{opportunity.title}</p>
                        <p className="mt-1 font-mono text-xs text-[var(--muted)]">
                          {opportunity.organization_name}
                          {opportunity.source_name ? ` · ${opportunity.source_name}` : ""}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-4 font-mono text-xs text-[var(--muted)]">
                        <span>{opportunity.detail_views} views</span>
                        <span>{opportunity.interest_clicks} interest</span>
                        <span>{opportunity.apply_clicks} apply</span>
                        <span>{opportunity.age_days}d old</span>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-4 font-mono text-xs text-[var(--muted)]">
                      <span>View to interest: {formatRate(opportunity.detail_to_interest_rate)}</span>
                      <span>Interest to apply: {formatRate(opportunity.interest_to_apply_rate)}</span>
                      <span>Detail to apply: {formatRate(opportunity.detail_to_apply_rate)}</span>
                    </div>

                    <p className="mt-4 font-mono text-xs text-[var(--muted)]">
                      {recommendedAction(opportunity)}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-3">
                      <Link
                        href={`/${portal.slug}/volunteer/opportunities/${opportunity.slug}`}
                        className="font-mono text-xs text-[var(--coral)] hover:underline"
                      >
                        Open detail
                      </Link>
                      <Link
                        href={`/${portal.slug}/community/${opportunity.organization_slug}`}
                        className="font-mono text-xs text-[var(--coral)] hover:underline"
                      >
                        Open organization
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-lg border border-[var(--twilight)] bg-[var(--dusk)] p-6">
            <h2 className="font-mono text-sm text-[var(--cream)]">All Structured Volunteer Roles</h2>
            {filteredOpportunities.length === 0 ? (
              <p className="mt-4 font-mono text-xs text-[var(--muted)]">
                No structured volunteer roles match the current filters.
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full divide-y divide-[var(--twilight)]">
                  <thead>
                    <tr className="text-left font-mono text-2xs uppercase tracking-[0.14em] text-[var(--muted)]">
                      <th className="pb-3 pr-4">Role</th>
                      <th className="pb-3 pr-4">Quality</th>
                      <th className="pb-3 pr-4">Funnel</th>
                      <th className="pb-3 pr-4">Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--twilight)]">
                    {filteredOpportunities.map((opportunity) => (
                      <tr key={opportunity.id} className="align-top">
                        <td className="py-4 pr-4">
                          <div>
                            <p className="text-sm font-semibold text-[var(--cream)]">{opportunity.title}</p>
                            <p className="mt-1 font-mono text-xs text-[var(--muted)]">
                              {opportunity.organization_name}
                              {opportunity.source_name ? ` · ${opportunity.source_name}` : ""}
                            </p>
                          </div>
                        </td>
                        <td className="py-4 pr-4">
                          <span className={`rounded-full px-2 py-1 font-mono text-2xs uppercase ${qualityBadgeClass(opportunity.quality_status)}`}>
                            {qualityLabel(opportunity.quality_status)}
                          </span>
                        </td>
                        <td className="py-4 pr-4">
                          <div className="space-y-1 font-mono text-xs text-[var(--muted)]">
                            <p>{opportunity.detail_views} views</p>
                            <p>{opportunity.interest_clicks} interest</p>
                            <p>{opportunity.apply_clicks} apply</p>
                          </div>
                        </td>
                        <td className="py-4 pr-4">
                          <p className="font-mono text-xs text-[var(--muted)]">
                            {formatDistanceToNow(new Date(opportunity.updated_at), { addSuffix: true })}
                          </p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
