"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Tracks portal page views. Fires once per page navigation.
 * Reads page type and UTM params from URL search params.
 */
export function usePortalTracking(portalSlug: string) {
  const searchParams = useSearchParams();
  const hasFiredRef = useRef<string | null>(null);

  useEffect(() => {
    // Determine page type from URL
    const view = searchParams.get("view");
    const eventId = searchParams.get("event");
    const spotId = searchParams.get("spot");
    const seriesId = searchParams.get("series");

    let pageType = "feed";
    let entityId: number | undefined;

    if (eventId) {
      pageType = "event";
      entityId = parseInt(eventId, 10) || undefined;
    } else if (spotId) {
      pageType = "spot";
      entityId = parseInt(spotId, 10) || undefined;
    } else if (seriesId) {
      pageType = "series";
    } else if (view === "find" || view === "events" || view === "spots" || view === "map" || view === "calendar") {
      pageType = "find";
    } else if (view === "community") {
      pageType = "community";
    }

    // Build a unique key for this navigation to avoid duplicate fires
    const trackingKey = `${pageType}:${entityId || ""}:${view || ""}`;
    if (hasFiredRef.current === trackingKey) return;
    hasFiredRef.current = trackingKey;

    // Read UTM params
    const utmSource = searchParams.get("utm_source");
    const utmMedium = searchParams.get("utm_medium");
    const utmCampaign = searchParams.get("utm_campaign");

    // Fire tracking request (fire-and-forget)
    const payload: Record<string, unknown> = { page_type: pageType };
    if (entityId) payload.entity_id = entityId;
    if (utmSource) payload.utm_source = utmSource;
    if (utmMedium) payload.utm_medium = utmMedium;
    if (utmCampaign) payload.utm_campaign = utmCampaign;
    if (document.referrer) payload.referrer = document.referrer;

    fetch(`/api/portals/${portalSlug}/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {
      // Silently ignore tracking errors
    });
  }, [portalSlug, searchParams]);
}
