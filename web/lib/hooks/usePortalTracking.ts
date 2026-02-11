"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { PORTAL_CONTEXT_COOKIE } from "@/lib/auth-utils";

/**
 * Tracks portal page views. Fires once per page navigation.
 * Reads page type and UTM params from URL search params.
 */
export function usePortalTracking(portalSlug: string) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const hasFiredRef = useRef<string | null>(null);

  useEffect(() => {
    if (!portalSlug) return;

    try {
      window.localStorage.setItem(PORTAL_CONTEXT_COOKIE, portalSlug);
    } catch {
      // Ignore localStorage failures.
    }

    document.cookie = `${PORTAL_CONTEXT_COOKIE}=${encodeURIComponent(portalSlug)}; Path=/; Max-Age=2592000; SameSite=Lax`;
  }, [portalSlug]);

  useEffect(() => {
    const segments = pathname.split("/").filter(Boolean);
    const portalIndex = segments.indexOf(portalSlug);
    const routeSegments = portalIndex >= 0 ? segments.slice(portalIndex + 1) : segments;

    // Determine page type from route and URL params.
    let pageType = "feed";
    let entityId: number | undefined;

    if (routeSegments[0] === "events" && routeSegments[1]) {
      const routeEventId = parseInt(routeSegments[1], 10);
      pageType = "event";
      entityId = Number.isInteger(routeEventId) ? routeEventId : undefined;
    } else if (routeSegments[0] === "spots") {
      pageType = "spot";
    } else if (routeSegments[0] === "series") {
      pageType = "series";
    } else if (routeSegments[0] === "community") {
      pageType = "community";
    }

    // Overlay states can override page type when IDs are present in query params.
    const view = searchParams.get("view");
    const eventId = searchParams.get("event");
    const spotId = searchParams.get("spot");
    const seriesId = searchParams.get("series");

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
    const trackingKey = `${pathname}:${pageType}:${entityId || ""}:${view || ""}`;
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
  }, [pathname, portalSlug, searchParams]);
}
