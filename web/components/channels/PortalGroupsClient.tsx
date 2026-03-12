"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePortal } from "@/lib/portal-context";
import { getGroupsUnavailableCopy } from "@/lib/empty-state-copy";
import { usePortalInterestChannels, type PortalChannel } from "@/lib/hooks/usePortalInterestChannels";
import { getInterestChannelPresentation, getInterestChannelTypeLabel } from "@/lib/interest-channel-presentation";
import { getPortalVertical } from "@/lib/portal";
import {
  trackInterestChannelFilterUsage,
  trackInterestChannelPageView,
} from "@/lib/analytics/interest-channels-tracking";

type PortalGroupsClientProps = {
  portalSlug: string;
};

type PresetFilter = "all" | "city_county" | "school_board" | "volunteer" | "community";

const TYPE_ORDER = ["jurisdiction", "institution", "topic", "community", "intent"];

function isSchoolBoardChannel(channel: PortalChannel): boolean {
  const sourceText = `${channel.slug} ${channel.name} ${channel.description || ""}`.toLowerCase();
  return /school[\s-]*board|board of education|school district|public schools/.test(sourceText);
}

function matchesPreset(channel: PortalChannel, preset: PresetFilter): boolean {
  if (preset === "all") return true;

  const sourceText = `${channel.name} ${channel.description || ""}`.toLowerCase();
  if (preset === "city_county") {
    return /city|county|government|commission|council/.test(sourceText);
  }
  if (preset === "school_board") {
    return /school|board|district|education/.test(sourceText);
  }
  if (preset === "volunteer") {
    return /volunteer|service|community service|mutual aid/.test(sourceText);
  }
  if (preset === "community") {
    return /neighborhood|community|association|civic/.test(sourceText);
  }

  return true;
}

export default function PortalGroupsClient({ portalSlug }: PortalGroupsClientProps) {
  const { portal } = usePortal();
  const presentation = getInterestChannelPresentation(portal);
  const groupsLabel = presentation.channelsLabel;
  const isCivicPortal = getPortalVertical(portal) === "community";
  const trackingContext = useMemo(
    () => ({
      portalSlug,
      pageType: "community" as const,
      sectionKey: "interest_channels_groups",
      surface: "groups_page",
    }),
    [portalSlug],
  );

  const {
    channels,
    orderedChannels,
    joinedChannels,
    isLoading,
    isDisabled,
    error,
    updatingChannelId,
    subscribedCount,
    toggleSubscription,
  } = usePortalInterestChannels({
    portalSlug,
    trackingContext,
  });

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [presetFilter, setPresetFilter] = useState<PresetFilter>("all");
  const [joinedOnly, setJoinedOnly] = useState(false);

  useEffect(() => {
    trackInterestChannelPageView(trackingContext);
  }, [trackingContext]);

  function applyPresetFilter(nextPreset: PresetFilter) {
    if (nextPreset === presetFilter) return;
    setPresetFilter(nextPreset);
    trackInterestChannelFilterUsage(trackingContext, "preset", nextPreset);
  }

  function applyTypeFilter(nextType: string) {
    if (nextType === typeFilter) return;
    setTypeFilter(nextType);
    trackInterestChannelFilterUsage(trackingContext, "type", nextType);
  }

  function toggleJoinedOnlyFilter() {
    const nextValue = !joinedOnly;
    setJoinedOnly(nextValue);
    trackInterestChannelFilterUsage(trackingContext, "joined_only", nextValue);
  }

  const availableTypes = useMemo(() => {
    const types = new Set(orderedChannels.map((channel) => channel.channel_type));
    return TYPE_ORDER.filter((type) => types.has(type));
  }, [orderedChannels]);

  const filteredChannels = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return orderedChannels
      .filter((channel) => !joinedOnly || channel.is_subscribed)
      .filter((channel) => typeFilter === "all" || channel.channel_type === typeFilter)
      .filter((channel) => matchesPreset(channel, presetFilter))
      .filter((channel) => {
        if (!normalizedQuery) return true;
        const searchable = `${channel.name} ${channel.description || ""} ${channel.channel_type}`.toLowerCase();
        return searchable.includes(normalizedQuery);
      })
      .sort((a, b) => {
        if (a.is_subscribed !== b.is_subscribed) return a.is_subscribed ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }, [joinedOnly, orderedChannels, presetFilter, query, typeFilter]);

  if (isDisabled) {
    const emptyState = getGroupsUnavailableCopy(groupsLabel);
    return (
      <div className="text-center py-16">
        <p className="text-lg font-semibold text-[var(--cream)]">{emptyState.headline}</p>
        <p className="text-sm text-[var(--muted)] mt-2">{emptyState.subline}</p>
        <Link
          href={`/${portalSlug}`}
          className="inline-flex mt-4 px-4 py-2 rounded-lg bg-[var(--twilight)]/30 font-mono text-sm text-[var(--cream)] hover:bg-[var(--twilight)]/50 transition-colors"
        >
          {emptyState.actionLabel}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--twilight)] bg-[var(--dusk)]/55 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-mono text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
            {groupsLabel}
          </p>
          <p className="font-mono text-xs text-[var(--soft)]">
            {subscribedCount} joined • {channels.length} total
          </p>
        </div>

        {joinedChannels.length > 0 && (
          <div>
          <p className="font-mono text-2xs uppercase tracking-[0.14em] text-[var(--muted)]">
            {presentation.joinedGroupsLabel}
          </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {joinedChannels.slice(0, 8).map((channel) => (
                <Link
                  key={channel.id}
                  href={`/${portalSlug}/groups/${channel.slug}`}
                  className="inline-flex items-center rounded-full border border-[var(--action-primary)]/35 bg-[var(--action-primary)]/15 px-2.5 py-1 font-mono text-2xs text-[var(--action-primary)]"
                >
                  {channel.name}
                </Link>
              ))}
            </div>
          </div>
        )}

        {isCivicPortal && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => applyPresetFilter("city_county")}
              className={`px-2.5 py-1 rounded-md border font-mono text-xs ${
                presetFilter === "city_county"
                  ? "border-[var(--action-primary)]/50 bg-[var(--action-primary)]/15 text-[var(--action-primary)]"
                  : "border-[var(--twilight)] text-[var(--muted)] hover:text-[var(--soft)]"
              }`}
            >
              City + County
            </button>
            <button
              onClick={() => applyPresetFilter("school_board")}
              className={`px-2.5 py-1 rounded-md border font-mono text-xs ${
                presetFilter === "school_board"
                  ? "border-[var(--action-primary)]/50 bg-[var(--action-primary)]/15 text-[var(--action-primary)]"
                  : "border-[var(--twilight)] text-[var(--muted)] hover:text-[var(--soft)]"
              }`}
            >
              School Board
            </button>
            <button
              onClick={() => applyPresetFilter("volunteer")}
              className={`px-2.5 py-1 rounded-md border font-mono text-xs ${
                presetFilter === "volunteer"
                  ? "border-[var(--action-primary)]/50 bg-[var(--action-primary)]/15 text-[var(--action-primary)]"
                  : "border-[var(--twilight)] text-[var(--muted)] hover:text-[var(--soft)]"
              }`}
            >
              Volunteer
            </button>
          </div>
        )}

        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={presentation.searchPlaceholder}
          className="w-full px-3 py-2 rounded-lg bg-[var(--night)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm"
        />

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => applyPresetFilter("all")}
            className={`px-2.5 py-1 rounded-md border font-mono text-xs ${
              presetFilter === "all"
                ? "border-[var(--action-primary)]/50 bg-[var(--action-primary)]/15 text-[var(--action-primary)]"
                : "border-[var(--twilight)] text-[var(--muted)] hover:text-[var(--soft)]"
            }`}
          >
            All
          </button>
          <button
            onClick={() => applyPresetFilter("city_county")}
            className={`px-2.5 py-1 rounded-md border font-mono text-xs ${
              presetFilter === "city_county"
                ? "border-[var(--action-primary)]/50 bg-[var(--action-primary)]/15 text-[var(--action-primary)]"
                : "border-[var(--twilight)] text-[var(--muted)] hover:text-[var(--soft)]"
            }`}
          >
            City + County
          </button>
          <button
            onClick={() => applyPresetFilter("school_board")}
            className={`px-2.5 py-1 rounded-md border font-mono text-xs ${
              presetFilter === "school_board"
                ? "border-[var(--action-primary)]/50 bg-[var(--action-primary)]/15 text-[var(--action-primary)]"
                : "border-[var(--twilight)] text-[var(--muted)] hover:text-[var(--soft)]"
            }`}
          >
            School Board
          </button>
          <button
            onClick={() => applyPresetFilter("volunteer")}
            className={`px-2.5 py-1 rounded-md border font-mono text-xs ${
              presetFilter === "volunteer"
                ? "border-[var(--action-primary)]/50 bg-[var(--action-primary)]/15 text-[var(--action-primary)]"
                : "border-[var(--twilight)] text-[var(--muted)] hover:text-[var(--soft)]"
            }`}
          >
            Volunteer
          </button>
          <button
            onClick={() => applyPresetFilter("community")}
            className={`px-2.5 py-1 rounded-md border font-mono text-xs ${
              presetFilter === "community"
                ? "border-[var(--action-primary)]/50 bg-[var(--action-primary)]/15 text-[var(--action-primary)]"
                : "border-[var(--twilight)] text-[var(--muted)] hover:text-[var(--soft)]"
            }`}
          >
            Community
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => applyTypeFilter("all")}
            className={`px-2.5 py-1 rounded-md border font-mono text-xs ${
              typeFilter === "all"
                ? "border-[var(--action-primary)]/45 bg-[var(--action-primary)]/15 text-[var(--action-primary)]"
                : "border-[var(--twilight)] text-[var(--muted)] hover:text-[var(--soft)]"
            }`}
          >
            All Types
          </button>
          {availableTypes.map((type) => (
            <button
              key={type}
              onClick={() => applyTypeFilter(type)}
              className={`px-2.5 py-1 rounded-md border font-mono text-xs ${
                typeFilter === type
                  ? "border-[var(--action-primary)]/45 bg-[var(--action-primary)]/15 text-[var(--action-primary)]"
                  : "border-[var(--twilight)] text-[var(--muted)] hover:text-[var(--soft)]"
              }`}
            >
              {getInterestChannelTypeLabel(portal, type)}
            </button>
          ))}
          <button
            onClick={toggleJoinedOnlyFilter}
            className={`px-2.5 py-1 rounded-md border font-mono text-xs ${
              joinedOnly
                ? "border-[var(--action-primary)]/45 bg-[var(--action-primary)]/15 text-[var(--action-primary)]"
                : "border-[var(--twilight)] text-[var(--muted)] hover:text-[var(--soft)]"
            }`}
          >
            Joined Only
          </button>
        </div>
      </div>

      {error && (
        <p className="font-mono text-xs text-red-300">{error}</p>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Array.from({ length: 8 }, (_, index) => (
            <div
              key={index}
              className="h-24 rounded-xl border border-[var(--twilight)] bg-[var(--night)]/60 animate-pulse"
            />
          ))}
        </div>
      ) : filteredChannels.length === 0 ? (
        <div className="rounded-xl border border-[var(--twilight)] bg-[var(--night)]/45 p-6 text-center">
          <p className="font-mono text-sm text-[var(--muted)]">No groups match your filters.</p>
          <div className="mt-3">
            <Link
              href={`/${portalSlug}`}
              className="font-mono text-xs text-[var(--action-primary)] hover:opacity-80"
            >
              Back to feed
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredChannels.map((channel) => (
            <article
              key={channel.id}
              id={channel.slug}
              className="rounded-xl border border-[var(--twilight)] bg-[var(--night)]/60 p-4 flex items-start justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="font-mono text-xs uppercase tracking-[0.12em] text-[var(--muted)] flex items-center gap-1.5">
                  {getInterestChannelTypeLabel(portal, channel.channel_type)}
                  {channel.scope === "global" ? " • Global" : ""}
                  {isSchoolBoardChannel(channel) && (
                    <span className="rounded-full border border-cyan-400/45 bg-cyan-500/15 px-1.5 py-0.5 text-2xs text-cyan-300 normal-case tracking-normal">
                      Auto-updated
                    </span>
                  )}
                </p>
                <Link
                  href={`/${portalSlug}/groups/${channel.slug}`}
                  className="mt-1 block text-sm font-semibold text-[var(--cream)] truncate hover:text-[var(--action-primary)] transition-colors"
                >
                  {channel.name}
                </Link>
                {channel.description && (
                  <p className="mt-1 text-xs text-[var(--soft)] line-clamp-3">
                    {channel.description}
                  </p>
                )}
              </div>
              <button
                onClick={() => void toggleSubscription(channel)}
                disabled={updatingChannelId === channel.id}
                className={`shrink-0 px-3 py-1.5 rounded-md border font-mono text-xs transition-colors disabled:opacity-60 ${
                  channel.is_subscribed
                    ? "border-[var(--action-primary)]/40 bg-[var(--action-primary)]/15 text-[var(--action-primary)] hover:bg-[var(--action-primary)]/25"
                    : "border-[var(--action-primary)]/30 bg-[var(--action-primary)]/10 text-[var(--action-primary)] hover:bg-[var(--action-primary)]/20"
                }`}
              >
                {updatingChannelId === channel.id
                  ? "Saving..."
                  : channel.is_subscribed
                    ? "Joined"
                    : "Join"}
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
