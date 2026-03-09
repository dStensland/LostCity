"use client";

import { useEffect, useState } from "react";
import { usePortal } from "@/lib/portal-context";

type Rule = {
  id: string;
  channel_id: string;
  rule_type: string;
  rule_payload: Record<string, unknown>;
  priority: number;
  is_active: boolean;
};

type Channel = {
  id: string;
  portal_id: string | null;
  slug: string;
  name: string;
  channel_type: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  is_active: boolean;
  sort_order: number;
  rule_count?: number;
  active_rule_count?: number;
  subscription_count?: number;
  matched_event_count?: number;
  last_matched_at?: string | null;
  quality_status?: "healthy" | "no_rules" | "no_matches" | "subscriber_gap";
  rules: Rule[];
};

type ChannelForm = {
  slug: string;
  name: string;
  channel_type: string;
  description: string;
  metadataJson: string;
  is_active: boolean;
  sort_order: string;
};

type RuleForm = {
  rule_type: string;
  priority: string;
  is_active: boolean;
  rule_payload_json: string;
};

type MatchMaterializationStatus = {
  total_matches: number;
  last_matched_at: string | null;
};

type RefreshSummary = {
  portalId: string;
  startDate: string;
  endDate: string;
  channelsConsidered: number;
  eventsScanned: number;
  matchesWritten: number;
  startedAt: string;
  completedAt: string;
};

type RefreshCadence = "hourly" | "daily" | "disabled";

type RefreshSchedule = {
  cadence: RefreshCadence;
  hour_utc: number | null;
};

type ChannelHealthSummary = {
  total_channels: number;
  active_channels: number;
  channels_with_matches: number;
  channels_without_matches: number;
  channels_without_rules: number;
  channels_with_inactive_rules_only: number;
  channels_with_subscribers_but_no_matches: number;
  total_distinct_events_matched: number;
  total_subscriptions: number;
  opportunities: string[];
};

type ChannelAnalyticsSummary = {
  group_page_views: number;
  total_joins: number;
  total_leaves: number;
  net_joins: number;
  join_rate_per_page_view: number | null;
  filter_interactions: number;
  unique_channels_engaged: number;
};

type ChannelAnalyticsTopChannel = {
  channel_id: string;
  channel_slug: string | null;
  channel_name: string;
  joins: number;
  leaves: number;
  net: number;
};

type ChannelAnalyticsTopFilter = {
  filter_type: string;
  filter_value: string;
  count: number;
};

type ChannelAnalyticsSurfaceBreakdown = {
  surface: string;
  joins: number;
  leaves: number;
  filters: number;
};

type ChannelAnalyticsTypeFunnel = {
  channel_type: string;
  total_channels: number;
  channels_engaged: number;
  joins: number;
  leaves: number;
  net_joins: number;
  join_share: number;
  join_rate_per_page_view: number | null;
};

type ChannelAnalytics = {
  period: {
    start: string;
    end: string;
    days: number;
  };
  summary: ChannelAnalyticsSummary;
  top_channels: ChannelAnalyticsTopChannel[];
  top_filters: ChannelAnalyticsTopFilter[];
  surface_breakdown: ChannelAnalyticsSurfaceBreakdown[];
  channel_type_funnel: ChannelAnalyticsTypeFunnel[];
  opportunities: string[];
};

const CHANNEL_TYPES = ["jurisdiction", "institution", "topic", "community", "intent"] as const;
const RULE_TYPES = ["source", "organization", "venue", "category", "tag", "geo", "expression"] as const;

const EMPTY_CHANNEL_FORM: ChannelForm = {
  slug: "",
  name: "",
  channel_type: "topic",
  description: "",
  metadataJson: "{}",
  is_active: true,
  sort_order: "0",
};

const EMPTY_RULE_FORM: RuleForm = {
  rule_type: "tag",
  priority: "100",
  is_active: true,
  rule_payload_json: "{}",
};

const DEFAULT_REFRESH_SCHEDULE: RefreshSchedule = {
  cadence: "hourly",
  hour_utc: null,
};

function toJsonText(value: unknown): string {
  return JSON.stringify(value ?? {}, null, 2);
}

function parseJsonObject(text: string): { value: Record<string, unknown> | null; error: string | null } {
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { value: null, error: "JSON must be an object" };
    }
    return { value: parsed as Record<string, unknown>, error: null };
  } catch {
    return { value: null, error: "Invalid JSON" };
  }
}

function qualityBadgeClass(status: Channel["quality_status"]): string {
  switch (status) {
    case "healthy":
      return "bg-green-500/20 text-green-300";
    case "subscriber_gap":
      return "bg-orange-500/20 text-orange-300";
    case "no_matches":
      return "bg-yellow-500/20 text-yellow-300";
    case "no_rules":
      return "bg-red-500/20 text-red-300";
    default:
      return "bg-[var(--night)] text-[var(--muted)]";
  }
}

export default function PortalChannelsPage() {
  const { portal } = usePortal();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disabled, setDisabled] = useState(false);
  const [materializationStatus, setMaterializationStatus] =
    useState<MatchMaterializationStatus | null>(null);
  const [refreshSummary, setRefreshSummary] = useState<RefreshSummary | null>(null);
  const [refreshSchedule, setRefreshSchedule] =
    useState<RefreshSchedule>(DEFAULT_REFRESH_SCHEDULE);
  const [refreshScheduleDirty, setRefreshScheduleDirty] = useState(false);
  const [channelHealth, setChannelHealth] = useState<ChannelHealthSummary | null>(null);
  const [channelAnalytics, setChannelAnalytics] = useState<ChannelAnalytics | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<ChannelForm>(EMPTY_CHANNEL_FORM);
  const [editingChannelId, setEditingChannelId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ChannelForm>(EMPTY_CHANNEL_FORM);
  const [newRuleByChannel, setNewRuleByChannel] = useState<Record<string, RuleForm>>({});

  useEffect(() => {
    void loadChannels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portal.id]);

  async function loadChannels() {
    setLoading(true);
    setError(null);
    setRefreshSchedule(DEFAULT_REFRESH_SCHEDULE);
    setRefreshScheduleDirty(false);
    setChannelHealth(null);
    setChannelAnalytics(null);

    try {
      const [channelsResponse, statusResponse, scheduleResponse, analyticsResponse] = await Promise.all([
        fetch(`/api/admin/portals/${portal.id}/channels`),
        fetch(`/api/admin/portals/${portal.id}/channels/refresh-matches`),
        fetch(`/api/admin/portals/${portal.id}/channels/refresh-schedule`),
        fetch(`/api/admin/portals/${portal.id}/channels/analytics?days=30`),
      ]);

      if (channelsResponse.status === 404) {
        setDisabled(true);
        setChannels([]);
        return;
      }
      if (!channelsResponse.ok) {
        const data = await channelsResponse.json().catch(() => ({}));
        throw new Error(data.error || "Failed to load channels");
      }

      const data = await channelsResponse.json();
      setDisabled(false);
      setChannels((data.channels || []) as Channel[]);
      setChannelHealth((data.health || null) as ChannelHealthSummary | null);

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        setMaterializationStatus({
          total_matches: statusData.total_matches || 0,
          last_matched_at: statusData.last_matched_at || null,
        });
      }

      if (scheduleResponse.ok) {
        const scheduleData = await scheduleResponse.json();
        const cadence = scheduleData?.schedule?.cadence;
        const hourUtcRaw = scheduleData?.schedule?.hour_utc;
        setRefreshSchedule({
          cadence: cadence === "daily" || cadence === "disabled" ? cadence : "hourly",
          hour_utc: typeof hourUtcRaw === "number" ? hourUtcRaw : null,
        });
        setRefreshScheduleDirty(false);
      }

      if (analyticsResponse.ok) {
        const analyticsData = await analyticsResponse.json();
        setChannelAnalytics((analyticsData || null) as ChannelAnalytics | null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load channels");
    } finally {
      setLoading(false);
    }
  }

  async function refreshMatches() {
    setRefreshing(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/admin/portals/${portal.id}/channels/refresh-matches`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to refresh channel matches");
      }

      const data = await response.json();
      const refresh = data.refresh as RefreshSummary;
      setRefreshSummary(refresh);
      setMaterializationStatus(() => ({
        total_matches: refresh.matchesWritten,
        last_matched_at: refresh.completedAt,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh channel matches");
    } finally {
      setRefreshing(false);
    }
  }

  async function saveRefreshSchedule() {
    setSavingSchedule(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/admin/portals/${portal.id}/channels/refresh-schedule`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            refreshSchedule.cadence === "daily"
              ? {
                cadence: "daily",
                hour_utc: refreshSchedule.hour_utc ?? 0,
              }
              : {
                cadence: refreshSchedule.cadence,
              },
          ),
        },
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save refresh schedule");
      }

      const data = await response.json();
      const cadence = data?.schedule?.cadence;
      const hourUtcRaw = data?.schedule?.hour_utc;
      setRefreshSchedule({
        cadence: cadence === "daily" || cadence === "disabled" ? cadence : "hourly",
        hour_utc: typeof hourUtcRaw === "number" ? hourUtcRaw : null,
      });
      setRefreshScheduleDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save refresh schedule");
    } finally {
      setSavingSchedule(false);
    }
  }

  function startEditChannel(channel: Channel) {
    setEditingChannelId(channel.id);
    setEditForm({
      slug: channel.slug,
      name: channel.name,
      channel_type: channel.channel_type,
      description: channel.description || "",
      metadataJson: toJsonText(channel.metadata || {}),
      is_active: channel.is_active,
      sort_order: String(channel.sort_order ?? 0),
    });
  }

  function cancelEditChannel() {
    setEditingChannelId(null);
    setEditForm(EMPTY_CHANNEL_FORM);
  }

  async function createChannel() {
    const parsedMetadata = parseJsonObject(createForm.metadataJson);
    if (parsedMetadata.error) {
      setError(`Create channel: ${parsedMetadata.error}`);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/portals/${portal.id}/channels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: createForm.slug,
          name: createForm.name,
          channel_type: createForm.channel_type,
          description: createForm.description || null,
          metadata: parsedMetadata.value || {},
          is_active: createForm.is_active,
          sort_order: Number.parseInt(createForm.sort_order, 10) || 0,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create channel");
      }

      setCreateForm(EMPTY_CHANNEL_FORM);
      setShowCreate(false);
      await loadChannels();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create channel");
    } finally {
      setSaving(false);
    }
  }

  async function updateChannel(channelId: string) {
    const parsedMetadata = parseJsonObject(editForm.metadataJson);
    if (parsedMetadata.error) {
      setError(`Update channel: ${parsedMetadata.error}`);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/portals/${portal.id}/channels/${channelId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: editForm.slug,
          name: editForm.name,
          channel_type: editForm.channel_type,
          description: editForm.description || null,
          metadata: parsedMetadata.value || {},
          is_active: editForm.is_active,
          sort_order: Number.parseInt(editForm.sort_order, 10) || 0,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update channel");
      }

      cancelEditChannel();
      await loadChannels();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update channel");
    } finally {
      setSaving(false);
    }
  }

  async function deleteChannel(channelId: string) {
    if (!window.confirm("Delete this channel and all rules?")) return;

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/portals/${portal.id}/channels/${channelId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete channel");
      }

      await loadChannels();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete channel");
    } finally {
      setSaving(false);
    }
  }

  function setRuleDraft(channelId: string, updates: Partial<RuleForm>) {
    setNewRuleByChannel((prev) => ({
      ...prev,
      [channelId]: {
        ...(prev[channelId] || EMPTY_RULE_FORM),
        ...updates,
      },
    }));
  }

  function getRuleDraft(channelId: string): RuleForm {
    return newRuleByChannel[channelId] || EMPTY_RULE_FORM;
  }

  async function addRule(channelId: string) {
    const draft = getRuleDraft(channelId);
    const parsedPayload = parseJsonObject(draft.rule_payload_json);
    if (parsedPayload.error) {
      setError(`Add rule: ${parsedPayload.error}`);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/portals/${portal.id}/channels/${channelId}/rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rule_type: draft.rule_type,
          rule_payload: parsedPayload.value || {},
          priority: Number.parseInt(draft.priority, 10) || 100,
          is_active: draft.is_active,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to add rule");
      }

      setNewRuleByChannel((prev) => ({ ...prev, [channelId]: EMPTY_RULE_FORM }));
      await loadChannels();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add rule");
    } finally {
      setSaving(false);
    }
  }

  async function deleteRule(channelId: string, ruleId: string) {
    if (!window.confirm("Delete this rule?")) return;

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/admin/portals/${portal.id}/channels/${channelId}/rules/${ruleId}`,
        { method: "DELETE" },
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete rule");
      }

      await loadChannels();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete rule");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="py-12 text-center">
          <div className="w-8 h-8 border-2 border-[var(--coral)] border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  if (disabled) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-semibold text-[var(--cream)] mb-2">Interest Channels</h1>
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/40 rounded-lg font-mono text-sm text-yellow-300">
          Interest Channels are disabled for this environment. Set `ENABLE_INTEREST_CHANNELS_V1=true` to enable.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--cream)] mb-1">Interest Channels</h1>
          <p className="font-mono text-sm text-[var(--muted)]">
            Define follow/join groups for portal-specific civic and community feeds.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void refreshMatches()}
            disabled={refreshing}
            className="px-4 py-2 bg-[var(--night)] border border-[var(--twilight)] text-[var(--cream)] rounded-lg font-mono text-sm hover:bg-[var(--twilight)] disabled:opacity-60"
          >
            {refreshing ? "Refreshing..." : "Refresh Matches"}
          </button>
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="px-4 py-2 bg-[var(--coral)] text-[var(--void)] rounded-lg font-mono text-sm hover:opacity-90"
          >
            {showCreate ? "Close" : "New Channel"}
          </button>
        </div>
      </div>

      <div className="p-3 bg-[var(--night)] border border-[var(--twilight)] rounded-lg">
        <p className="font-mono text-xs text-[var(--muted)]">
          Materialized matches: {materializationStatus?.total_matches || 0}
          {materializationStatus?.last_matched_at
            ? ` • Last refresh ${new Date(materializationStatus.last_matched_at).toLocaleString()}`
            : " • Never refreshed"}
        </p>
        {refreshSummary && (
          <p className="font-mono text-xs text-[var(--soft)] mt-1">
            Last run scanned {refreshSummary.eventsScanned} events, considered {refreshSummary.channelsConsidered} channels, wrote {refreshSummary.matchesWritten} matches.
          </p>
        )}
        {channelHealth && (
          <p className="font-mono text-xs text-[var(--soft)] mt-1">
            Channel coverage: {channelHealth.channels_with_matches}/{channelHealth.total_channels} channels have matches, {channelHealth.total_distinct_events_matched} distinct events matched.
          </p>
        )}
        <div className="mt-3 pt-3 border-t border-[var(--twilight)] flex flex-wrap items-end gap-3">
          <label className="font-mono text-xs text-[var(--muted)] space-y-1">
            <span className="block">Auto-refresh cadence</span>
            <select
              value={refreshSchedule.cadence}
              onChange={(e) => {
                const nextCadence = e.target.value as RefreshCadence;
                setRefreshSchedule((prev) => ({
                  cadence: nextCadence,
                  hour_utc: nextCadence === "daily" ? (prev.hour_utc ?? 0) : null,
                }));
                setRefreshScheduleDirty(true);
              }}
              className="px-2 py-1 bg-[var(--dusk)] border border-[var(--twilight)] rounded font-mono text-xs text-[var(--cream)]"
            >
              <option value="hourly">hourly</option>
              <option value="daily">daily</option>
              <option value="disabled">disabled</option>
            </select>
          </label>
          {refreshSchedule.cadence === "daily" && (
            <label className="font-mono text-xs text-[var(--muted)] space-y-1">
              <span className="block">Hour (UTC)</span>
              <select
                value={refreshSchedule.hour_utc ?? 0}
                onChange={(e) => {
                  setRefreshSchedule((prev) => ({
                    ...prev,
                    hour_utc: Number.parseInt(e.target.value, 10),
                  }));
                  setRefreshScheduleDirty(true);
                }}
                className="px-2 py-1 bg-[var(--dusk)] border border-[var(--twilight)] rounded font-mono text-xs text-[var(--cream)]"
              >
                {Array.from({ length: 24 }, (_, hour) => (
                  <option key={hour} value={hour}>{String(hour).padStart(2, "0")}:00</option>
                ))}
              </select>
            </label>
          )}
          <button
            onClick={() => void saveRefreshSchedule()}
            disabled={savingSchedule || !refreshScheduleDirty}
            className="px-3 py-1.5 bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] rounded font-mono text-xs hover:bg-[var(--twilight)] disabled:opacity-60"
          >
            {savingSchedule ? "Saving..." : "Save cadence"}
          </button>
          <p className="font-mono text-2xs text-[var(--muted)]">
            Hourly runs each cron tick, daily runs at selected UTC hour, disabled skips this portal.
          </p>
        </div>
      </div>

      {channelHealth && (
        <div className="p-3 bg-[var(--night)] border border-[var(--twilight)] rounded-lg">
          <p className="font-mono text-xs uppercase tracking-wider text-[var(--muted)]">
            Gaps & Opportunities
          </p>
          <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
            <p className="font-mono text-xs text-[var(--soft)]">
              Active channels: {channelHealth.active_channels}/{channelHealth.total_channels}
            </p>
            <p className="font-mono text-xs text-[var(--soft)]">
              Total subscriptions: {channelHealth.total_subscriptions}
            </p>
            <p className="font-mono text-xs text-[var(--soft)]">
              Channels without rules: {channelHealth.channels_without_rules}
            </p>
            <p className="font-mono text-xs text-[var(--soft)]">
              Inactive-rules-only channels: {channelHealth.channels_with_inactive_rules_only}
            </p>
            <p className="font-mono text-xs text-[var(--soft)]">
              No-match channels: {channelHealth.channels_without_matches}
            </p>
            <p className="font-mono text-xs text-[var(--soft)]">
              Subscriber gaps (followers but no matches): {channelHealth.channels_with_subscribers_but_no_matches}
            </p>
          </div>
          {(channelHealth.opportunities || []).length > 0 && (
            <div className="mt-3 pt-3 border-t border-[var(--twilight)] space-y-1">
              {(channelHealth.opportunities || []).map((item) => (
                <p key={item} className="font-mono text-xs text-orange-300">{item}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {channelAnalytics && (
        <div className="p-3 bg-[var(--night)] border border-[var(--twilight)] rounded-lg space-y-3">
          <div>
            <p className="font-mono text-xs uppercase tracking-wider text-[var(--muted)]">
              Adoption Analytics ({channelAnalytics.period.days} days)
            </p>
            <p className="font-mono text-xs text-[var(--soft)] mt-1">
              Joins {channelAnalytics.summary.total_joins} • Leaves {channelAnalytics.summary.total_leaves} • Net {channelAnalytics.summary.net_joins}
              {channelAnalytics.summary.join_rate_per_page_view !== null
                ? ` • Join/Page ${channelAnalytics.summary.join_rate_per_page_view}`
                : ""}
            </p>
            <p className="font-mono text-xs text-[var(--soft)]">
              Groups page views {channelAnalytics.summary.group_page_views} • Filter interactions {channelAnalytics.summary.filter_interactions} • Channels engaged {channelAnalytics.summary.unique_channels_engaged}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-2 border border-[var(--twilight)] rounded bg-[var(--dusk)]/40">
              <p className="font-mono text-2xs uppercase tracking-wider text-[var(--muted)] mb-1">
                Top Joined Channels
              </p>
              {channelAnalytics.top_channels.length === 0 ? (
                <p className="font-mono text-xs text-[var(--muted)]">No join/leave events yet.</p>
              ) : (
                <div className="space-y-1">
                  {channelAnalytics.top_channels.slice(0, 5).map((entry) => (
                    <p key={entry.channel_id} className="font-mono text-xs text-[var(--soft)]">
                      {entry.channel_name}: +{entry.joins} / -{entry.leaves} (net {entry.net})
                    </p>
                  ))}
                </div>
              )}
            </div>
            <div className="p-2 border border-[var(--twilight)] rounded bg-[var(--dusk)]/40">
              <p className="font-mono text-2xs uppercase tracking-wider text-[var(--muted)] mb-1">
                Top Filter Signals
              </p>
              {channelAnalytics.top_filters.length === 0 ? (
                <p className="font-mono text-xs text-[var(--muted)]">No filter events yet.</p>
              ) : (
                <div className="space-y-1">
                  {channelAnalytics.top_filters.slice(0, 5).map((entry) => (
                    <p key={`${entry.filter_type}:${entry.filter_value}`} className="font-mono text-xs text-[var(--soft)]">
                      {entry.filter_type}={entry.filter_value} ({entry.count})
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="p-2 border border-[var(--twilight)] rounded bg-[var(--dusk)]/40">
            <p className="font-mono text-2xs uppercase tracking-wider text-[var(--muted)] mb-1">
              Surface Breakdown
            </p>
            {channelAnalytics.surface_breakdown.length === 0 ? (
              <p className="font-mono text-xs text-[var(--muted)]">No surface events yet.</p>
            ) : (
              <div className="space-y-1">
                {channelAnalytics.surface_breakdown.slice(0, 4).map((entry) => (
                  <p key={entry.surface} className="font-mono text-xs text-[var(--soft)]">
                    {entry.surface}: +{entry.joins} / -{entry.leaves} • filters {entry.filters}
                  </p>
                ))}
              </div>
            )}
          </div>

          <div className="p-2 border border-[var(--twilight)] rounded bg-[var(--dusk)]/40">
            <p className="font-mono text-2xs uppercase tracking-wider text-[var(--muted)] mb-1">
              Conversion Funnel By Type
            </p>
            {channelAnalytics.channel_type_funnel.length === 0 ? (
              <p className="font-mono text-xs text-[var(--muted)]">No type funnel data yet.</p>
            ) : (
              <div className="space-y-1">
                {channelAnalytics.channel_type_funnel.slice(0, 6).map((entry) => (
                  <p key={entry.channel_type} className="font-mono text-xs text-[var(--soft)]">
                    {entry.channel_type}: +{entry.joins} / -{entry.leaves} (net {entry.net_joins}) • engaged {entry.channels_engaged}/{entry.total_channels}
                    {entry.join_rate_per_page_view !== null ? ` • join/page ${entry.join_rate_per_page_view}` : ""}
                  </p>
                ))}
              </div>
            )}
          </div>

          <div className="p-2 border border-[var(--twilight)] rounded bg-[var(--dusk)]/40 md:col-span-2">
            <p className="font-mono text-2xs uppercase tracking-wider text-[var(--muted)] mb-1">
              Funnel Opportunities
            </p>
            {(channelAnalytics.opportunities || []).length === 0 ? (
              <p className="font-mono text-xs text-[var(--muted)]">No major funnel issues detected in this window.</p>
            ) : (
              <div className="space-y-1">
                {(channelAnalytics.opportunities || []).slice(0, 6).map((item) => (
                  <p key={item} className="font-mono text-xs text-orange-300">{item}</p>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500 rounded-lg text-red-400 font-mono text-sm">
          {error}
        </div>
      )}

      {showCreate && (
        <section className="bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg p-4 space-y-4">
          <h2 className="font-mono text-xs uppercase tracking-wider text-[var(--muted)]">Create Channel</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              value={createForm.name}
              onChange={(e) => setCreateForm((s) => ({ ...s, name: e.target.value }))}
              placeholder="Name"
              className="px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)]"
            />
            <input
              value={createForm.slug}
              onChange={(e) => setCreateForm((s) => ({ ...s, slug: e.target.value }))}
              placeholder="slug (kebab-case)"
              className="px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)]"
            />
            <select
              value={createForm.channel_type}
              onChange={(e) => setCreateForm((s) => ({ ...s, channel_type: e.target.value }))}
              className="px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)]"
            >
              {CHANNEL_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            <input
              value={createForm.sort_order}
              onChange={(e) => setCreateForm((s) => ({ ...s, sort_order: e.target.value }))}
              placeholder="Sort order"
              className="px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)]"
            />
          </div>
          <input
            value={createForm.description}
            onChange={(e) => setCreateForm((s) => ({ ...s, description: e.target.value }))}
            placeholder="Description (optional)"
            className="w-full px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)]"
          />
          <textarea
            value={createForm.metadataJson}
            onChange={(e) => setCreateForm((s) => ({ ...s, metadataJson: e.target.value }))}
            rows={4}
            className="w-full px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-xs text-[var(--cream)]"
          />
          <label className="inline-flex items-center gap-2 font-mono text-xs text-[var(--muted)]">
            <input
              type="checkbox"
              checked={createForm.is_active}
              onChange={(e) => setCreateForm((s) => ({ ...s, is_active: e.target.checked }))}
              className="accent-[var(--coral)]"
            />
            Active
          </label>
          <div>
            <button
              onClick={createChannel}
              disabled={saving}
              className="px-4 py-2 bg-[var(--coral)] text-[var(--void)] rounded font-mono text-sm hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Create Channel"}
            </button>
          </div>
        </section>
      )}

      {channels.length === 0 ? (
        <div className="bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg p-8 text-center">
          <p className="font-mono text-sm text-[var(--muted)]">
            No channels yet. Create one to start segmenting events by civic/community interests.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {channels.map((channel) => (
            <section
              key={channel.id}
              className="bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg overflow-hidden"
            >
              <div className="p-4 flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-mono text-sm text-[var(--cream)]">{channel.name}</h2>
                  <p className="font-mono text-xs text-[var(--muted)]">
                    {channel.slug} • {channel.channel_type} • {channel.subscription_count || 0} subscriber
                    {(channel.subscription_count || 0) === 1 ? "" : "s"} • {channel.matched_event_count || 0} matched event
                    {(channel.matched_event_count || 0) === 1 ? "" : "s"} • {channel.active_rule_count || 0}/{channel.rule_count || 0} active rules
                  </p>
                  {channel.last_matched_at && (
                    <p className="font-mono text-2xs text-[var(--muted)] mt-1">
                      Last matched {new Date(channel.last_matched_at).toLocaleString()}
                    </p>
                  )}
                  {channel.description && (
                    <p className="font-mono text-xs text-[var(--soft)] mt-1">{channel.description}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <span
                    className={`px-2 py-1 rounded font-mono text-2xs ${
                      channel.is_active ? "bg-green-500/20 text-green-300" : "bg-[var(--night)] text-[var(--muted)]"
                    }`}
                  >
                    {channel.is_active ? "active" : "inactive"}
                  </span>
                  <span
                    className={`px-2 py-1 rounded font-mono text-2xs ${qualityBadgeClass(channel.quality_status)}`}
                  >
                    {channel.quality_status || "unknown"}
                  </span>
                  {editingChannelId === channel.id ? (
                    <button
                      onClick={cancelEditChannel}
                      className="px-3 py-1 bg-[var(--night)] text-[var(--muted)] rounded font-mono text-xs"
                    >
                      Cancel
                    </button>
                  ) : (
                    <button
                      onClick={() => startEditChannel(channel)}
                      className="px-3 py-1 bg-[var(--night)] text-[var(--cream)] rounded font-mono text-xs"
                    >
                      Edit
                    </button>
                  )}
                  <button
                    onClick={() => void deleteChannel(channel.id)}
                    disabled={saving}
                    className="px-3 py-1 bg-red-500/20 text-red-400 rounded font-mono text-xs"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {editingChannelId === channel.id && (
                <div className="p-4 border-t border-[var(--twilight)] bg-[var(--night)] space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      value={editForm.name}
                      onChange={(e) => setEditForm((s) => ({ ...s, name: e.target.value }))}
                      className="px-3 py-2 bg-[var(--dusk)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)]"
                    />
                    <input
                      value={editForm.slug}
                      onChange={(e) => setEditForm((s) => ({ ...s, slug: e.target.value }))}
                      className="px-3 py-2 bg-[var(--dusk)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)]"
                    />
                    <select
                      value={editForm.channel_type}
                      onChange={(e) => setEditForm((s) => ({ ...s, channel_type: e.target.value }))}
                      className="px-3 py-2 bg-[var(--dusk)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)]"
                    >
                      {CHANNEL_TYPES.map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                    <input
                      value={editForm.sort_order}
                      onChange={(e) => setEditForm((s) => ({ ...s, sort_order: e.target.value }))}
                      className="px-3 py-2 bg-[var(--dusk)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)]"
                    />
                  </div>
                  <input
                    value={editForm.description}
                    onChange={(e) => setEditForm((s) => ({ ...s, description: e.target.value }))}
                    className="w-full px-3 py-2 bg-[var(--dusk)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)]"
                  />
                  <textarea
                    value={editForm.metadataJson}
                    onChange={(e) => setEditForm((s) => ({ ...s, metadataJson: e.target.value }))}
                    rows={4}
                    className="w-full px-3 py-2 bg-[var(--dusk)] border border-[var(--twilight)] rounded font-mono text-xs text-[var(--cream)]"
                  />
                  <label className="inline-flex items-center gap-2 font-mono text-xs text-[var(--muted)]">
                    <input
                      type="checkbox"
                      checked={editForm.is_active}
                      onChange={(e) => setEditForm((s) => ({ ...s, is_active: e.target.checked }))}
                      className="accent-[var(--coral)]"
                    />
                    Active
                  </label>
                  <div>
                    <button
                      onClick={() => void updateChannel(channel.id)}
                      disabled={saving}
                      className="px-4 py-2 bg-[var(--coral)] text-[var(--void)] rounded font-mono text-sm hover:opacity-90 disabled:opacity-50"
                    >
                      {saving ? "Saving..." : "Save Channel"}
                    </button>
                  </div>
                </div>
              )}

              <div className="p-4 border-t border-[var(--twilight)] space-y-3">
                <div className="font-mono text-xs uppercase tracking-wider text-[var(--muted)]">Rules</div>
                {channel.rules.length === 0 ? (
                  <p className="font-mono text-xs text-[var(--muted)]">No rules configured.</p>
                ) : (
                  <div className="space-y-2">
                    {channel.rules.map((rule) => (
                      <div
                        key={rule.id}
                        className="p-2 bg-[var(--night)] border border-[var(--twilight)] rounded flex items-start justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="font-mono text-xs text-[var(--soft)]">
                            {rule.rule_type} • priority {rule.priority} • {rule.is_active ? "active" : "inactive"}
                          </p>
                          <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-2xs text-[var(--muted)]">
                            {toJsonText(rule.rule_payload)}
                          </pre>
                        </div>
                        <button
                          onClick={() => void deleteRule(channel.id, rule.id)}
                          disabled={saving}
                          className="px-2 py-1 bg-red-500/20 text-red-400 rounded font-mono text-2xs shrink-0"
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="p-3 bg-[var(--night)] border border-[var(--twilight)] rounded space-y-2">
                  <p className="font-mono text-xs text-[var(--muted)]">Add Rule</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <select
                      value={getRuleDraft(channel.id).rule_type}
                      onChange={(e) => setRuleDraft(channel.id, { rule_type: e.target.value })}
                      className="px-2 py-1 bg-[var(--dusk)] border border-[var(--twilight)] rounded font-mono text-xs text-[var(--cream)]"
                    >
                      {RULE_TYPES.map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                    <input
                      value={getRuleDraft(channel.id).priority}
                      onChange={(e) => setRuleDraft(channel.id, { priority: e.target.value })}
                      className="px-2 py-1 bg-[var(--dusk)] border border-[var(--twilight)] rounded font-mono text-xs text-[var(--cream)]"
                    />
                    <label className="inline-flex items-center gap-2 font-mono text-xs text-[var(--muted)]">
                      <input
                        type="checkbox"
                        checked={getRuleDraft(channel.id).is_active}
                        onChange={(e) => setRuleDraft(channel.id, { is_active: e.target.checked })}
                        className="accent-[var(--coral)]"
                      />
                      Active
                    </label>
                  </div>
                  <textarea
                    value={getRuleDraft(channel.id).rule_payload_json}
                    onChange={(e) => setRuleDraft(channel.id, { rule_payload_json: e.target.value })}
                    rows={3}
                    className="w-full px-2 py-1 bg-[var(--dusk)] border border-[var(--twilight)] rounded font-mono text-2xs text-[var(--cream)]"
                  />
                  <button
                    onClick={() => void addRule(channel.id)}
                    disabled={saving}
                    className="px-3 py-1 bg-[var(--coral)] text-[var(--void)] rounded font-mono text-xs hover:opacity-90 disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Add Rule"}
                  </button>
                </div>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
