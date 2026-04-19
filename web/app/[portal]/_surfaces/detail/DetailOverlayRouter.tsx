"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import dynamic from "next/dynamic";
import { setFeedVisible } from "@/lib/feed-visibility";
import { markOverlayPhase, overlayRef } from "@/lib/detail/overlay-perf";
import {
  buildDetailCloseFallbackUrl,
  resolveDetailOverlayTarget,
} from "./detail-entry-contract";

const EventDetailView = dynamic(() => import("@/components/views/EventDetailView"));
const PlaceDetailView = dynamic(() => import("@/components/views/PlaceDetailView"));
const SeriesDetailView = dynamic(() => import("@/components/views/SeriesDetailView"));
const OrgDetailView = dynamic(() => import("@/components/views/OrgDetailView"));
const FestivalDetailView = dynamic(() => import("@/components/views/FestivalDetailView"));
const NeighborhoodDetailView = dynamic(
  () => import("@/components/views/NeighborhoodDetailView"),
);

interface DetailOverlayRouterProps {
  portalSlug: string;
  children: React.ReactNode;
}

function AnimatedDetailWrapper({
  children,
  onNavigateClose,
}: {
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

export default function DetailOverlayRouter({
  portalSlug,
  children,
}: DetailOverlayRouterProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const detailTarget = useMemo(
    () => resolveDetailOverlayTarget(searchParams),
    [searchParams],
  );

  useEffect(() => {
    if (!detailTarget) return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    const ref = overlayRef(detailTarget);
    if (ref) markOverlayPhase("target-resolved", ref);
  }, [detailTarget]);

  const closeFallbackUrl = useMemo(
    () => buildDetailCloseFallbackUrl(pathname, searchParams),
    [pathname, searchParams],
  );

  const navigateClose = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.replace(closeFallbackUrl, { scroll: false });
  }, [router, closeFallbackUrl]);

  const handleClose = useCallback(() => {
    navigateClose();
  }, [navigateClose]);

  let detailView: React.ReactNode = null;

  switch (detailTarget?.kind) {
    case "event":
      detailView = (
        <AnimatedDetailWrapper
          key={`event-${detailTarget.id}`}
          onNavigateClose={navigateClose}
        >
          <EventDetailView
            eventId={detailTarget.id}
            portalSlug={portalSlug}
            onClose={handleClose}
          />
        </AnimatedDetailWrapper>
      );
      break;
    case "spot":
      detailView = (
        <AnimatedDetailWrapper
          key={`spot-${detailTarget.slug}`}
          onNavigateClose={navigateClose}
        >
          <PlaceDetailView
            slug={detailTarget.slug}
            portalSlug={portalSlug}
            onClose={handleClose}
          />
        </AnimatedDetailWrapper>
      );
      break;
    case "series":
      detailView = (
        <AnimatedDetailWrapper
          key={`series-${detailTarget.slug}`}
          onNavigateClose={navigateClose}
        >
          <SeriesDetailView
            slug={detailTarget.slug}
            portalSlug={portalSlug}
            onClose={handleClose}
          />
        </AnimatedDetailWrapper>
      );
      break;
    case "festival":
      detailView = (
        <AnimatedDetailWrapper
          key={`festival-${detailTarget.slug}`}
          onNavigateClose={navigateClose}
        >
          <FestivalDetailView
            slug={detailTarget.slug}
            portalSlug={portalSlug}
            onClose={handleClose}
          />
        </AnimatedDetailWrapper>
      );
      break;
    case "org":
      detailView = (
        <AnimatedDetailWrapper
          key={`org-${detailTarget.slug}`}
          onNavigateClose={navigateClose}
        >
          <OrgDetailView
            slug={detailTarget.slug}
            portalSlug={portalSlug}
            onClose={handleClose}
          />
        </AnimatedDetailWrapper>
      );
      break;
    case "artist":
      detailView = null;
      break;
    case "neighborhood":
      detailView = (
        <AnimatedDetailWrapper
          key={`neighborhood-${detailTarget.slug}`}
          onNavigateClose={navigateClose}
        >
          <NeighborhoodDetailView
            slug={detailTarget.slug}
            portalSlug={portalSlug}
            onClose={handleClose}
          />
        </AnimatedDetailWrapper>
      );
      break;
    default:
      detailView = null;
  }

  const isDetailActive = detailView !== null;

  useEffect(() => {
    setFeedVisible(!isDetailActive);
  }, [isDetailActive]);

  return (
    <>
      <div className={isDetailActive ? "hidden" : "contents"}>{children}</div>
      {detailView}
    </>
  );
}
