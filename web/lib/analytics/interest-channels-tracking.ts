"use client";

import { trackPortalAction } from "@/lib/analytics/portal-action-tracker";

type ChannelTrackingPageType = "feed" | "community";

type ChannelTrackingContext = {
  portalSlug: string;
  pageType: ChannelTrackingPageType;
  sectionKey: string;
  surface: string;
};

type ChannelSnapshot = {
  id: string;
  slug: string;
  name: string;
  channel_type: string;
  scope: "portal" | "global";
};

export function trackInterestChannelSubscriptionAction(
  context: ChannelTrackingContext,
  action: "join" | "leave",
  channel: ChannelSnapshot,
) {
  trackPortalAction(context.portalSlug, {
    action_type: "resource_clicked",
    page_type: context.pageType,
    section_key: context.sectionKey,
    target_kind: action === "join" ? "interest_channel_join" : "interest_channel_leave",
    target_id: channel.id,
    target_label: channel.name,
    target_url: `/${context.portalSlug}/groups#${channel.slug}`,
    metadata: {
      channel_slug: channel.slug,
      channel_type: channel.channel_type,
      channel_scope: channel.scope,
      surface: context.surface,
    },
  });
}

export function trackInterestChannelFilterUsage(
  context: ChannelTrackingContext,
  filterType: "preset" | "type" | "joined_only",
  filterValue: string | boolean,
) {
  trackPortalAction(context.portalSlug, {
    action_type: "resource_clicked",
    page_type: context.pageType,
    section_key: context.sectionKey,
    target_kind: "interest_channel_filter",
    target_label: String(filterValue),
    metadata: {
      filter_type: filterType,
      filter_value: filterValue,
      surface: context.surface,
    },
  });
}

export function trackInterestChannelPageView(
  context: ChannelTrackingContext,
) {
  trackPortalAction(context.portalSlug, {
    action_type: "resource_clicked",
    page_type: context.pageType,
    section_key: context.sectionKey,
    target_kind: "interest_channel_page",
    target_label: "groups",
    metadata: {
      surface: context.surface,
    },
  });
}
