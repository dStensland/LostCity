"use client";

import { trackPortalAction } from "@/lib/analytics/portal-action-tracker";

type HangVisibility = "private" | "friends" | "public";
type HangSource = "venue_detail" | "event_detail" | "feed";
type ShareMethod = "native" | "clipboard";

export function trackHangCreated({
  portalSlug,
  venueId,
  venueName,
  visibility,
  durationHours,
  hasNote,
  hasEvent,
  source,
}: {
  portalSlug: string;
  venueId: number;
  venueName: string;
  visibility: HangVisibility;
  durationHours: number;
  hasNote: boolean;
  hasEvent: boolean;
  source: HangSource;
}) {
  trackPortalAction(portalSlug, {
    action_type: "resource_clicked",
    page_type: "feed",
    section_key: "hang_created",
    target_kind: "hang",
    target_id: String(venueId),
    target_label: venueName,
    metadata: {
      venue_id: venueId,
      venue_name: venueName,
      visibility,
      duration_hours: durationHours,
      has_note: hasNote,
      has_event: hasEvent,
      source,
    },
  });
}

export function trackHangEnded({
  portalSlug,
  venueId,
  durationMinutes,
}: {
  portalSlug: string;
  venueId: number;
  durationMinutes: number;
}) {
  trackPortalAction(portalSlug, {
    action_type: "resource_clicked",
    page_type: "feed",
    section_key: "hang_ended",
    target_kind: "hang",
    target_id: String(venueId),
    metadata: {
      venue_id: venueId,
      duration_minutes: durationMinutes,
    },
  });
}

export function trackHangShared({
  portalSlug,
  venueId,
  venueName,
  shareMethod,
}: {
  portalSlug: string;
  venueId: string;
  venueName: string;
  shareMethod: ShareMethod;
}) {
  trackPortalAction(portalSlug, {
    action_type: "resource_clicked",
    page_type: "feed",
    section_key: "hang_shared",
    target_kind: "hang",
    target_id: venueId,
    target_label: venueName,
    metadata: {
      venue_id: venueId,
      share_method: shareMethod,
    },
  });
}

export function trackHangVisibilityChanged({
  portalSlug,
  from,
  to,
}: {
  portalSlug: string;
  from: HangVisibility;
  to: HangVisibility;
}) {
  trackPortalAction(portalSlug, {
    action_type: "resource_clicked",
    page_type: "feed",
    section_key: "hang_visibility_changed",
    target_kind: "hang",
    metadata: {
      from,
      to,
    },
  });
}
