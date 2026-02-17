"use client";

import type { HospitalAudienceMode } from "@/lib/hospital-modes";
import type { PortalInteractionActionType } from "@/lib/analytics/portal-action-types";

export type PortalActionType = PortalInteractionActionType;

export type PortalActionPayload = {
  action_type: PortalActionType;
  page_type?: "hospital" | "feed" | "find" | "community";
  hospital_slug?: string;
  mode_context?: HospitalAudienceMode;
  section_key?: string;
  target_kind?: string;
  target_id?: string;
  target_label?: string;
  target_url?: string;
  metadata?: Record<string, unknown>;
};

const endpointFor = (portalSlug: string) => `/api/portals/${portalSlug}/track/action`;

function toSafeString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength);
}

export function trackPortalAction(portalSlug: string, payload: PortalActionPayload) {
  if (typeof window === "undefined") return;
  if (!portalSlug) return;

  const searchParams = new URLSearchParams(window.location.search);
  const utmSource = searchParams.get("utm_source");
  const utmMedium = searchParams.get("utm_medium");
  const utmCampaign = searchParams.get("utm_campaign");

  const body = {
    ...payload,
    page_type: payload.page_type || "hospital",
    referrer: document.referrer || undefined,
    utm_source: utmSource || undefined,
    utm_medium: utmMedium || undefined,
    utm_campaign: utmCampaign || undefined,
    target_label: toSafeString(payload.target_label, 180),
    target_url: toSafeString(payload.target_url, 700),
    metadata: {
      ...(payload.metadata || {}),
      path: window.location.pathname,
      query: window.location.search || undefined,
    },
  };

  const bodyJson = JSON.stringify(body);
  const endpoint = endpointFor(portalSlug);

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([bodyJson], { type: "application/json" });
      navigator.sendBeacon(endpoint, blob);
      return;
    }
  } catch {
    // Fall through to fetch.
  }

  fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: bodyJson,
    keepalive: true,
  }).catch(() => {
    // Non-blocking analytics event.
  });
}
