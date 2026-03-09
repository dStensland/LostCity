"use client";

import Link from "next/link";
import FeedSectionHeader from "@/components/feed/FeedSectionHeader";
import {
  usePortalInterestChannels,
  type PortalChannel,
} from "@/lib/hooks/usePortalInterestChannels";
import { usePortal } from "@/lib/portal-context";

type InterestChannelsSectionProps = {
  portalSlug: string;
  onSubscriptionChange?: () => void;
};

const CHANNEL_TYPE_LABELS: Record<string, string> = {
  jurisdiction: "Jurisdiction",
  institution: "Institution",
  topic: "Topic",
  community: "Community",
  intent: "Intent",
};

function getChannelTypeLabel(channelType: string): string {
  return CHANNEL_TYPE_LABELS[channelType] || channelType;
}

function isSchoolBoardChannel(channel: PortalChannel): boolean {
  const sourceText = `${channel.slug} ${channel.name} ${channel.description || ""}`.toLowerCase();
  return /school[\s-]*board|board of education|school district|public schools/.test(sourceText);
}

export default function InterestChannelsSection({
  portalSlug,
  onSubscriptionChange,
}: InterestChannelsSectionProps) {
  const { portal } = usePortal();
  const {
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
    onSubscriptionChange,
    trackingContext: {
      pageType: "feed",
      sectionKey: "interest_channels_feed",
      surface: "feed_card",
    },
  });

  if (isDisabled) return null;
  if (!isLoading && orderedChannels.length === 0) return null;

  const defaultSubtitle = typeof portal.settings.interest_channels_subtitle === "string"
    ? portal.settings.interest_channels_subtitle
    : "Follow city, county, school board, and civic groups";
  const subtitle = subscribedCount > 0
    ? `${subscribedCount} group${subscribedCount === 1 ? "" : "s"} joined`
    : defaultSubtitle;

  return (
    <section className="mt-6">
      <FeedSectionHeader
        title="Join Groups"
        subtitle={subtitle}
        priority="secondary"
        seeAllHref={`/${portalSlug}/groups`}
        seeAllLabel="All groups"
      />

      {joinedChannels.length > 0 && (
        <div className="mb-3 rounded-xl border border-[var(--twilight)]/75 bg-[var(--night)]/50 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="font-mono text-2xs uppercase tracking-[0.14em] text-[var(--muted)]">
              My Groups
            </p>
            <Link
              href={`/${portalSlug}/groups`}
              className="font-mono text-2xs text-[var(--action-primary)] hover:opacity-80"
            >
              Manage
            </Link>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {joinedChannels.slice(0, 8).map((channel) => (
              <Link
                key={channel.id}
                href={`/${portalSlug}/groups#${channel.slug}`}
                className="inline-flex items-center rounded-full border border-[var(--action-primary)]/35 bg-[var(--action-primary)]/15 px-2.5 py-1 font-mono text-2xs text-[var(--action-primary)]"
              >
                {channel.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="mt-3 rounded-xl border border-[var(--twilight)] bg-[var(--dusk)]/55">
        {isLoading ? (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            {Array.from({ length: 4 }, (_, index) => (
              <div
                key={index}
                className="h-20 rounded-lg bg-[var(--night)]/70 border border-[var(--twilight)]/50 animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            {orderedChannels.map((channel) => (
              <div
                key={channel.id}
                className="p-3 rounded-lg border border-[var(--twilight)]/60 bg-[var(--night)]/65 flex items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="font-mono text-xs uppercase tracking-[0.12em] text-[var(--muted)] flex items-center gap-1.5">
                    {getChannelTypeLabel(channel.channel_type)}
                    {channel.scope === "global" ? " • Global" : ""}
                    {isSchoolBoardChannel(channel) && (
                      <span className="rounded-full border border-cyan-400/45 bg-cyan-500/15 px-1.5 py-0.5 text-2xs text-cyan-300 normal-case tracking-normal">
                        Source-backed
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-sm font-medium text-[var(--cream)] truncate">
                    {channel.name}
                  </p>
                  {channel.description && (
                    <p className="mt-1 text-xs text-[var(--soft)] line-clamp-2">
                      {channel.description}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => void toggleSubscription(channel)}
                  disabled={updatingChannelId === channel.id}
                  className={`shrink-0 px-3 py-1.5 rounded-md font-mono text-xs border transition-colors disabled:opacity-60 ${
                    channel.is_subscribed
                      ? "bg-[var(--action-primary)]/15 border-[var(--action-primary)]/35 text-[var(--action-primary)] hover:bg-[var(--action-primary)]/25"
                      : "bg-[var(--action-primary)]/10 border-[var(--action-primary)]/30 text-[var(--action-primary)] hover:bg-[var(--action-primary)]/20"
                  }`}
                >
                  {updatingChannelId === channel.id
                    ? "Saving..."
                    : channel.is_subscribed
                      ? "Joined"
                      : "Join"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <p className="mt-2 font-mono text-xs text-red-300">{error}</p>
      )}
    </section>
  );
}
