"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import dynamic from "next/dynamic";
import { setFeedVisible } from "@/lib/feed-visibility";
import { markOverlayPhase, overlayRef } from "@/lib/detail/overlay-perf";
import {
  peekEntityPreview,
  buildEntityRef,
  type EventSeed,
  type SpotSeed,
  type SeriesSeed,
  type FestivalSeed,
  type OrgSeed,
  type NeighborhoodSeed,
} from "@/lib/detail/entity-preview-store";
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

/**
 * Did the page initially load with an overlay param in the URL? If yes, the
 * first overlay-router mount is a cold-load-of-shared-link and the enter
 * animation should be skipped (otherwise the user sees the feed flash under
 * a sliding overlay).
 *
 * Captured at module evaluation time (before any render) from the actual URL
 * rather than from React state so it's stable across Strict-Mode double-
 * invocation, HMR, and client-side navigations. After the first mount, we
 * set `initialOverlayConsumed` so subsequent click-navigations animate.
 */
const initialHadOverlayParam =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).toString().length > 0 &&
  /[?&](event|spot|series|festival|org|artist|neighborhood)=/.test(
    window.location.search,
  );
let initialOverlayConsumed = false;

interface DetailOverlayRouterProps {
  portalSlug: string;
  children: React.ReactNode;
}

function AnimatedDetailWrapper({
  children,
  onNavigateClose,
  animateEnter,
}: {
  children: React.ReactNode;
  onNavigateClose: () => void;
  /**
   * When false, skips the enter animation — used on cold load of a shared
   * `?event=123` link so the user doesn't see the feed flash under a sliding
   * overlay. Animation still plays on swap and on subsequent click-to-open.
   */
  animateEnter: boolean;
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

  const animClass = closing
    ? "animate-detail-exit"
    : animateEnter
      ? "animate-detail-enter"
      : "";

  return (
    <div
      className={animClass}
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

  // Stamp target-resolved synchronously during render so seeded-paint (which
  // runs in the child's useLayoutEffect, i.e. *before* parent effects) always
  // has a baseline to measure against. markOverlayPhase is a perf-only
  // side-effect; duplicate stamps across re-renders are harmless (the measure
  // logic picks the most recent via getEntriesByName).
  if (detailTarget) {
    const ref = overlayRef(detailTarget);
    if (ref) markOverlayPhase("target-resolved", ref);
  }

  // Skip enter animation on cold load of a shared `?event=123` link — without
  // this guard the user sees the feed flash under a sliding-up overlay. The
  // first mount where `initialHadOverlayParam` is true (and not yet consumed)
  // is the cold-load case. Any later mount — whether the user closed and
  // reopened, or navigated in for the first time — should animate.
  const [isColdLoadMount] = useState(
    () => initialHadOverlayParam && !initialOverlayConsumed,
  );
  useEffect(() => {
    initialOverlayConsumed = true;
  }, []);

  useEffect(() => {
    if (!detailTarget) return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
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
    case "event": {
      const seed = peekEntityPreview(
        buildEntityRef("event", detailTarget.id),
      ) as EventSeed | null;
      detailView = (
        <AnimatedDetailWrapper
          key={`event-${detailTarget.id}`}
          onNavigateClose={navigateClose}
          animateEnter={!isColdLoadMount}
        >
          <EventDetailView
            eventId={detailTarget.id}
            portalSlug={portalSlug}
            onClose={handleClose}
            seedData={seed ?? undefined}
          />
        </AnimatedDetailWrapper>
      );
      break;
    }
    case "spot": {
      const seed = peekEntityPreview(
        buildEntityRef("spot", detailTarget.slug),
      ) as SpotSeed | null;
      detailView = (
        <AnimatedDetailWrapper
          key={`spot-${detailTarget.slug}`}
          onNavigateClose={navigateClose}
          animateEnter={!isColdLoadMount}
        >
          <PlaceDetailView
            slug={detailTarget.slug}
            portalSlug={portalSlug}
            onClose={handleClose}
            seedData={seed ?? undefined}
          />
        </AnimatedDetailWrapper>
      );
      break;
    }
    case "series": {
      const seed = peekEntityPreview(
        buildEntityRef("series", detailTarget.slug),
      ) as SeriesSeed | null;
      detailView = (
        <AnimatedDetailWrapper
          key={`series-${detailTarget.slug}`}
          onNavigateClose={navigateClose}
          animateEnter={!isColdLoadMount}
        >
          <SeriesDetailView
            slug={detailTarget.slug}
            portalSlug={portalSlug}
            onClose={handleClose}
            seedData={seed ?? undefined}
          />
        </AnimatedDetailWrapper>
      );
      break;
    }
    case "festival": {
      const seed = peekEntityPreview(
        buildEntityRef("festival", detailTarget.slug),
      ) as FestivalSeed | null;
      detailView = (
        <AnimatedDetailWrapper
          key={`festival-${detailTarget.slug}`}
          onNavigateClose={navigateClose}
          animateEnter={!isColdLoadMount}
        >
          <FestivalDetailView
            slug={detailTarget.slug}
            portalSlug={portalSlug}
            onClose={handleClose}
            seedData={seed ?? undefined}
          />
        </AnimatedDetailWrapper>
      );
      break;
    }
    case "org": {
      const seed = peekEntityPreview(
        buildEntityRef("org", detailTarget.slug),
      ) as OrgSeed | null;
      detailView = (
        <AnimatedDetailWrapper
          key={`org-${detailTarget.slug}`}
          onNavigateClose={navigateClose}
          animateEnter={!isColdLoadMount}
        >
          <OrgDetailView
            slug={detailTarget.slug}
            portalSlug={portalSlug}
            onClose={handleClose}
            seedData={seed ?? undefined}
          />
        </AnimatedDetailWrapper>
      );
      break;
    }
    case "artist":
      detailView = null;
      break;
    case "neighborhood": {
      const seed = peekEntityPreview(
        buildEntityRef("neighborhood", detailTarget.slug),
      ) as NeighborhoodSeed | null;
      detailView = (
        <AnimatedDetailWrapper
          key={`neighborhood-${detailTarget.slug}`}
          onNavigateClose={navigateClose}
          animateEnter={!isColdLoadMount}
        >
          <NeighborhoodDetailView
            slug={detailTarget.slug}
            portalSlug={portalSlug}
            onClose={handleClose}
            seedData={seed ?? undefined}
          />
        </AnimatedDetailWrapper>
      );
      break;
    }
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
