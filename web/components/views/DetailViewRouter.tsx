"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import EventDetailView from "./EventDetailView";
import PlaceDetailView from "./PlaceDetailView";
import SeriesDetailView from "./SeriesDetailView";
import OrgDetailView from "./OrgDetailView";
import FestivalDetailView from "./FestivalDetailView";
import { setFeedVisible } from "@/lib/feed-visibility";

interface DetailViewRouterProps {
  portalSlug: string;
  children: React.ReactNode;
}

function AnimatedDetailWrapper({ children, onNavigateClose }: {
  children: React.ReactNode;
  onNavigateClose: () => void;
}) {
  const [closing, setClosing] = useState(false);
  const navigatingRef = useRef(false);

  const handleAnimatedClose = useCallback(() => {
    if (navigatingRef.current) return;
    setClosing(true);
  }, []);

  const handleAnimationEnd = useCallback(() => {
    if (closing && !navigatingRef.current) {
      navigatingRef.current = true;
      onNavigateClose();
    }
  }, [closing, onNavigateClose]);

  return (
    <div
      className={closing ? "animate-detail-exit" : "animate-detail-enter"}
      onAnimationEnd={handleAnimationEnd}
    >
      {/* Clone children with the animated close handler */}
      {typeof children === "object" && children !== null && "props" in (children as React.ReactElement)
        ? (() => {
            const child = children as React.ReactElement<{ onClose: () => void }>;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const Child = child.type as React.ComponentType<any>;
            return <Child {...child.props} onClose={handleAnimatedClose} />;
          })()
        : children}
    </div>
  );
}

export default function DetailViewRouter({ portalSlug, children }: DetailViewRouterProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Check for detail view params
  const eventId = searchParams.get("event");
  const spotSlug = searchParams.get("spot");
  const seriesSlug = searchParams.get("series");
  const festivalSlug = searchParams.get("festival");
  const orgSlug = searchParams.get("org");
  const artistSlug = searchParams.get("artist");

  // When a detail view opens via query params, we want to start at the top instead of preserving
  // the underlying feed scroll position.
  useEffect(() => {
    if (!eventId && !spotSlug && !seriesSlug && !festivalSlug && !orgSlug && !artistSlug) return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [eventId, spotSlug, seriesSlug, festivalSlug, orgSlug, artistSlug]);

  const closeFallbackUrl = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("event");
    params.delete("spot");
    params.delete("series");
    params.delete("festival");
    params.delete("org");
    params.delete("artist");
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, searchParams]);

  const navigateClose = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.replace(closeFallbackUrl, { scroll: false });
  }, [router, closeFallbackUrl]);

  // Close handler navigates back through the history chain
  const handleClose = useCallback(() => {
    navigateClose();
  }, [navigateClose]);

  // Determine which detail view to show (if any).
  // Each wrapper gets a unique key so React unmounts/remounts when switching
  // between detail types (e.g. event → venue → back to event). Without keys,
  // React reuses the AnimatedDetailWrapper instance and its stale closing state
  // causes the content to stay invisible after the exit animation.
  let detailView: React.ReactNode = null;

  if (eventId) {
    const id = parseInt(eventId, 10);
    if (!isNaN(id)) {
      detailView = (
        <AnimatedDetailWrapper key={`event-${id}`} onNavigateClose={navigateClose}>
          <EventDetailView
            eventId={id}
            portalSlug={portalSlug}
            onClose={handleClose}
          />
        </AnimatedDetailWrapper>
      );
    }
  } else if (spotSlug) {
    detailView = (
      <AnimatedDetailWrapper key={`spot-${spotSlug}`} onNavigateClose={navigateClose}>
        <PlaceDetailView
          slug={spotSlug}
          portalSlug={portalSlug}
          onClose={handleClose}
        />
      </AnimatedDetailWrapper>
    );
  } else if (seriesSlug) {
    detailView = (
      <AnimatedDetailWrapper key={`series-${seriesSlug}`} onNavigateClose={navigateClose}>
        <SeriesDetailView
          slug={seriesSlug}
          portalSlug={portalSlug}
          onClose={handleClose}
        />
      </AnimatedDetailWrapper>
    );
  } else if (festivalSlug) {
    detailView = (
      <AnimatedDetailWrapper key={`festival-${festivalSlug}`} onNavigateClose={navigateClose}>
        <FestivalDetailView
          slug={festivalSlug}
          portalSlug={portalSlug}
          onClose={handleClose}
        />
      </AnimatedDetailWrapper>
    );
  } else if (orgSlug) {
    detailView = (
      <AnimatedDetailWrapper key={`org-${orgSlug}`} onNavigateClose={navigateClose}>
        <OrgDetailView
          slug={orgSlug}
          portalSlug={portalSlug}
          onClose={handleClose}
        />
      </AnimatedDetailWrapper>
    );
  } else if (artistSlug) {
    // ArtistDetailView — will be implemented in Phase 2
    // For now, return null (no overlay for unimplemented entity)
    detailView = null;
  }

  const isDetailActive = detailView !== null;

  // Sync feed visibility to the external store so child components can pause
  // side effects (scroll listeners, polling, MutationObservers) while hidden.
  useEffect(() => {
    setFeedVisible(!isDetailActive);
  }, [isDetailActive]);

  // Always render children (the feed/find/community view) to avoid expensive
  // unmount/remount cycles. When a detail view is active, hide the underlying
  // content with display:none — this preserves component state, scroll position,
  // and loaded data while removing it from layout entirely (no intersection
  // observer callbacks, no layout cost).
  return (
    <>
      <div className={isDetailActive ? "hidden" : "contents"}>
        {children}
      </div>
      {detailView}
    </>
  );
}
