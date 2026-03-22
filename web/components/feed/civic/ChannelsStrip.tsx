"use client";

import { memo } from "react";
import Link from "next/link";
import { Plus } from "@phosphor-icons/react";
import { usePortalInterestChannels, type PortalChannel } from "@/lib/hooks/usePortalInterestChannels";

interface ChannelsStripProps {
  portalSlug: string;
  variant?: "horizontal" | "vertical";
}

// The API type doesn't include event_count_this_week yet — handle gracefully
type ChannelWithCount = PortalChannel & { event_count_this_week?: number };

function getDisplayChannels(channels: ChannelWithCount[]): {
  displayChannels: ChannelWithCount[];
  hasSubscriptions: boolean;
} {
  const subscribed = channels.filter((ch) => ch.is_subscribed);

  if (subscribed.length > 0) {
    return { displayChannels: subscribed, hasSubscriptions: true };
  }

  // No subscriptions: show top 5 sorted by activity count, then alphabetically
  const top5 = [...channels]
    .sort((a, b) => {
      const countA = a.event_count_this_week ?? 0;
      const countB = b.event_count_this_week ?? 0;
      if (countB !== countA) return countB - countA;
      return a.name.localeCompare(b.name);
    })
    .slice(0, 5);

  return { displayChannels: top5, hasSubscriptions: false };
}

function ChannelPill({
  channel,
  portalSlug,
  isSuggestion,
  fullWidth,
}: {
  channel: ChannelWithCount;
  portalSlug: string;
  isSuggestion: boolean;
  fullWidth: boolean;
}) {
  const count = channel.event_count_this_week;
  const showCount = typeof count === "number" && count > 0;

  return (
    <Link
      href={`/${portalSlug}/happening`}
      className={[
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium",
        "border border-[var(--twilight)]/20 hover:border-[var(--twilight)]/40",
        "text-[var(--soft)] hover:text-[var(--cream)]",
        "transition-colors whitespace-nowrap",
        fullWidth ? "w-full" : "shrink-0",
      ].join(" ")}
    >
      {isSuggestion && (
        <Plus
          weight="bold"
          className="w-3 h-3 opacity-50 shrink-0"
        />
      )}
      <span>
        {channel.name}
        {showCount ? ` · ${count}` : ""}
      </span>
    </Link>
  );
}

function SkeletonPills({ count, fullWidth }: { count: number; fullWidth: boolean }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className={[
            "h-7 rounded-full animate-pulse bg-[var(--twilight)]/30",
            fullWidth ? "w-full" : "shrink-0",
          ].join(" ")}
          style={fullWidth ? undefined : { width: 72 + (i % 3) * 20 }}
        />
      ))}
    </>
  );
}

export const ChannelsStrip = memo(function ChannelsStrip({
  portalSlug,
  variant = "horizontal",
}: ChannelsStripProps) {
  const { channels, isLoading, error } = usePortalInterestChannels({ portalSlug });

  // Error or confirmed empty after load — render nothing
  if (error) return null;

  const typedChannels = channels as ChannelWithCount[];
  const { displayChannels, hasSubscriptions } = getDisplayChannels(typedChannels);

  // After load, nothing to show
  if (!isLoading && displayChannels.length === 0) return null;

  if (variant === "vertical") {
    return (
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider opacity-50 text-[var(--soft)]">
          {hasSubscriptions ? "Your Channels" : "Popular Channels"}
        </h3>
        <div className="flex flex-col gap-1.5">
          {isLoading ? (
            <SkeletonPills count={4} fullWidth />
          ) : (
            displayChannels.map((ch) => (
              <ChannelPill
                key={ch.id}
                channel={ch}
                portalSlug={portalSlug}
                isSuggestion={!hasSubscriptions}
                fullWidth
              />
            ))
          )}
        </div>
      </div>
    );
  }

  // Horizontal (default)
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {isLoading ? (
        <SkeletonPills count={5} fullWidth={false} />
      ) : (
        displayChannels.map((ch) => (
          <ChannelPill
            key={ch.id}
            channel={ch}
            portalSlug={portalSlug}
            isSuggestion={!hasSubscriptions}
            fullWidth={false}
          />
        ))
      )}
    </div>
  );
});

export type { ChannelsStripProps };
