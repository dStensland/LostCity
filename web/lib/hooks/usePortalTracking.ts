"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import { PORTAL_CONTEXT_COOKIE } from "@/lib/auth-utils";
import { HOSPITAL_MODE_VALUES } from "@/lib/analytics/portal-action-types";

const HOSPITAL_MODE_SET = new Set(HOSPITAL_MODE_VALUES);

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

    // Set cookie with domain for cross-subdomain sharing
    const hostname = window.location.hostname;
    let domainAttr = "";
    if (hostname.endsWith(".lostcity.ai") || hostname === "lostcity.ai") {
      domainAttr = "; Domain=.lostcity.ai";
    } else if (hostname.endsWith(".lostcity.app") || hostname === "lostcity.app") {
      domainAttr = "; Domain=.lostcity.app";
    } else if (hostname.endsWith(".lvh.me") || hostname === "lvh.me") {
      domainAttr = "; Domain=.lvh.me";
    }
    document.cookie = `${PORTAL_CONTEXT_COOKIE}=${encodeURIComponent(portalSlug)}; Path=/; Max-Age=2592000; SameSite=Lax${domainAttr}`;
  }, [portalSlug]);

  useEffect(() => {
    const segments = pathname.split("/").filter(Boolean);
    const portalIndex = segments.indexOf(portalSlug);
    const routeSegments = portalIndex >= 0 ? segments.slice(portalIndex + 1) : segments;

    // Determine page type from route and URL params.
    let pageType: "feed" | "find" | "event" | "spot" | "series" | "community" | "hospital" = "feed";
    let entityId: number | undefined;

    if (routeSegments[0] === "events" && routeSegments[1]) {
      const routeEventId = parseInt(routeSegments[1], 10);
      pageType = "event";
      entityId = Number.isInteger(routeEventId) ? routeEventId : undefined;
    } else if (routeSegments[0] === "hospitals") {
      pageType = "hospital";
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

    const modeParam = searchParams.get("mode");
    const hasHospitalMode = !!modeParam && HOSPITAL_MODE_SET.has(modeParam as (typeof HOSPITAL_MODE_VALUES)[number]);
    const isHospitalVertical = document.querySelector('[data-vertical="hospital"]') !== null;
    if (isHospitalVertical && (pageType === "feed" || (hasHospitalMode && pageType === "find"))) {
      pageType = "hospital";
    }

    // Build a unique key for this navigation to avoid duplicate fires
    const trackingKey = `${pathname}:${pageType}:${entityId || ""}:${view || ""}`;
    if (hasFiredRef.current === trackingKey) return;
    hasFiredRef.current = trackingKey;

    // Read UTM params
    const utmSource = searchParams.get("utm_source");
    const utmMedium = searchParams.get("utm_medium");
    const utmCampaign = searchParams.get("utm_campaign");

    const payload: Record<string, unknown> = { page_type: pageType };
    if (entityId) payload.entity_id = entityId;
    if (utmSource) payload.utm_source = utmSource;
    if (utmMedium) payload.utm_medium = utmMedium;
    if (utmCampaign) payload.utm_campaign = utmCampaign;
    if (document.referrer) payload.referrer = document.referrer;

    const url = `/api/portals/${portalSlug}/track`;
    let cancelled = false;

    const send = () => {
      if (cancelled) return;

      const body = JSON.stringify(payload);
      try {
        if (navigator.sendBeacon) {
          const blob = new Blob([body], { type: "application/json" });
          if (navigator.sendBeacon(url, blob)) {
            return;
          }
        }
      } catch {
        // Fall through to fetch.
      }

      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {
        // Silently ignore tracking errors.
      });
    };

    let timeoutId: ReturnType<typeof globalThis.setTimeout> | null = null;
    let idleId: number | null = null;

    if ("requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(send, { timeout: 1500 });
    } else {
      timeoutId = globalThis.setTimeout(send, 1200);
    }

    // Dual-write to PostHog with structured portal metadata
    try {
      posthog.capture("portal_page_view", {
        portal: portalSlug,
        page_type: pageType,
        entity_id: entityId,
        utm_source: utmSource,
        utm_medium: utmMedium,
        utm_campaign: utmCampaign,
      });
    } catch {
      // PostHog not initialized or opted out — silently skip.
    }

    return () => {
      cancelled = true;
      if (idleId !== null && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId !== null) {
        globalThis.clearTimeout(timeoutId);
      }
    };
  }, [pathname, portalSlug, searchParams]);
}
