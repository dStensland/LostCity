"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { trackInterestChannelSubscriptionAction } from "@/lib/analytics/interest-channels-tracking";

export type PortalChannel = {
  id: string;
  slug: string;
  name: string;
  channel_type: string;
  description: string | null;
  scope: "portal" | "global";
  is_subscribed: boolean;
  subscription: {
    id: string;
    delivery_mode: "feed_only" | "instant" | "digest";
    digest_frequency: "daily" | "weekly" | null;
  } | null;
};

const CHANNEL_TYPE_ORDER: Record<string, number> = {
  jurisdiction: 0,
  institution: 1,
  topic: 2,
  community: 3,
  intent: 4,
};

function sortChannelsForDisplay(channels: PortalChannel[]): PortalChannel[] {
  return [...channels].sort((a, b) => {
    if (a.is_subscribed !== b.is_subscribed) return a.is_subscribed ? -1 : 1;
    const typeOrderA = CHANNEL_TYPE_ORDER[a.channel_type] ?? 99;
    const typeOrderB = CHANNEL_TYPE_ORDER[b.channel_type] ?? 99;
    if (typeOrderA !== typeOrderB) return typeOrderA - typeOrderB;
    return a.name.localeCompare(b.name);
  });
}

type UsePortalInterestChannelsOptions = {
  portalSlug: string;
  onSubscriptionChange?: () => void;
  trackingContext?: {
    pageType: "feed" | "community";
    sectionKey: string;
    surface: string;
  };
};

export function usePortalInterestChannels({
  portalSlug,
  onSubscriptionChange,
  trackingContext,
}: UsePortalInterestChannelsOptions) {
  const router = useRouter();
  const { user } = useAuth();
  const [channels, setChannels] = useState<PortalChannel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDisabled, setIsDisabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingChannelId, setUpdatingChannelId] = useState<string | null>(null);

  const loadChannels = useCallback(async () => {
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch(`/api/portals/${portalSlug}/channels`, {
        credentials: "include",
      });

      if (response.status === 404) {
        setIsDisabled(true);
        setChannels([]);
        return;
      }

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to load groups");
      }

      const data = await response.json();
      setChannels((data.channels || []) as PortalChannel[]);
      setIsDisabled(false);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load groups");
    } finally {
      setIsLoading(false);
    }
  }, [portalSlug]);

  useEffect(() => {
    void loadChannels();
  }, [loadChannels, user?.id]);

  const subscribedCount = useMemo(
    () => channels.filter((channel) => channel.is_subscribed).length,
    [channels],
  );

  const orderedChannels = useMemo(
    () => sortChannelsForDisplay(channels),
    [channels],
  );

  const joinedChannels = useMemo(
    () => orderedChannels.filter((channel) => channel.is_subscribed),
    [orderedChannels],
  );

  const toggleSubscription = useCallback(async (channel: PortalChannel) => {
    if (!user) {
      const redirectPath = `${window.location.pathname}${window.location.search}`;
      router.push(`/auth/login?redirect=${encodeURIComponent(redirectPath)}`);
      return;
    }

    setUpdatingChannelId(channel.id);
    setError(null);

    try {
      if (channel.is_subscribed && channel.subscription?.id) {
        const response = await fetch(
          `/api/channels/subscriptions/${channel.subscription.id}`,
          { method: "DELETE" },
        );

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || "Failed to leave group");
        }

        setChannels((prev) =>
          prev.map((current) =>
            current.id === channel.id
              ? { ...current, is_subscribed: false, subscription: null }
              : current,
          ),
        );
        if (trackingContext) {
          trackInterestChannelSubscriptionAction(
            { ...trackingContext, portalSlug },
            "leave",
            channel,
          );
        }
      } else {
        const response = await fetch("/api/channels/subscriptions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            channel_id: channel.id,
            delivery_mode: "feed_only",
            portal_slug: portalSlug,
          }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || "Failed to join group");
        }

        const data = await response.json();
        setChannels((prev) =>
          prev.map((current) =>
            current.id === channel.id
              ? { ...current, is_subscribed: true, subscription: data.subscription || null }
              : current,
          ),
        );
        if (trackingContext) {
          trackInterestChannelSubscriptionAction(
            { ...trackingContext, portalSlug },
            "join",
            channel,
          );
        }
      }

      onSubscriptionChange?.();
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Failed to update group");
    } finally {
      setUpdatingChannelId(null);
    }
  }, [onSubscriptionChange, portalSlug, router, trackingContext, user]);

  return {
    channels,
    orderedChannels,
    joinedChannels,
    isLoading,
    isDisabled,
    error,
    updatingChannelId,
    subscribedCount,
    loadChannels,
    toggleSubscription,
  };
}
